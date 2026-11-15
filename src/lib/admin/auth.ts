import "server-only";

import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { getAdminPrismaClient } from "@/lib/db/admin-prisma";

import { getAdminSecurityConfig } from "./config";
import { verifyAdminPassword } from "./password";
import {
  hashAdminUserAgent,
  hashAdminValue,
  normalizeAdminEmail,
} from "./security";

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_ATTEMPTS = 5;
const ACCOUNT_LOCK_SECONDS = 15 * 60;

interface LoginRateRow {
  readonly requestCount: number;
  readonly blockedUntil: Date | null;
}

export interface AdminIdentity {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: "OWNER" | "MANAGER" | "VIEWER";
}

export interface CreatedAdminSession {
  readonly expiresAt: Date;
  readonly identity: AdminIdentity;
  readonly token: string;
}

export class AdminLoginRejectedError extends Error {
  constructor(readonly retryAfterSeconds?: number) {
    super("ADMIN_LOGIN_REJECTED");
    this.name = "AdminLoginRejectedError";
  }
}

function secondsUntil(value: Date): number {
  return Math.max(1, Math.ceil((value.getTime() - Date.now()) / 1000));
}

async function consumeLoginRateLimit(keyHash: string): Promise<void> {
  const rows = await getAdminPrismaClient().$queryRaw<LoginRateRow[]>(
    Prisma.sql`
      INSERT INTO "admin_login_rate_limits" (
        "key_hash", "window_started_at", "request_count", "updated_at"
      )
      VALUES (${keyHash}, clock_timestamp(), 1, clock_timestamp())
      ON CONFLICT ("key_hash") DO UPDATE
      SET
        "request_count" = CASE
          WHEN "admin_login_rate_limits"."window_started_at" <=
            clock_timestamp() - make_interval(secs => ${LOGIN_WINDOW_SECONDS})
          THEN 1
          ELSE LEAST("admin_login_rate_limits"."request_count" + 1, 1000000)
        END,
        "window_started_at" = CASE
          WHEN "admin_login_rate_limits"."window_started_at" <=
            clock_timestamp() - make_interval(secs => ${LOGIN_WINDOW_SECONDS})
          THEN clock_timestamp()
          ELSE "admin_login_rate_limits"."window_started_at"
        END,
        "blocked_until" = CASE
          WHEN "admin_login_rate_limits"."window_started_at" <=
            clock_timestamp() - make_interval(secs => ${LOGIN_WINDOW_SECONDS})
          THEN NULL
          WHEN "admin_login_rate_limits"."request_count" + 1 >= ${LOGIN_MAX_ATTEMPTS}
          THEN clock_timestamp() + make_interval(secs => ${LOGIN_WINDOW_SECONDS})
          ELSE "admin_login_rate_limits"."blocked_until"
        END,
        "updated_at" = clock_timestamp()
      RETURNING
        "request_count" AS "requestCount",
        "blocked_until" AS "blockedUntil"
    `,
  );

  const result = rows[0];
  if (!result) {
    throw new AdminLoginRejectedError();
  }
  if (result.blockedUntil && result.blockedUntil.getTime() > Date.now()) {
    throw new AdminLoginRejectedError(secondsUntil(result.blockedUntil));
  }
}

export async function authenticateAdmin(input: {
  readonly clientToken: string;
  readonly email: string;
  readonly password: string;
  readonly userAgent: string | null;
}): Promise<CreatedAdminSession> {
  const config = getAdminSecurityConfig();
  const prisma = getAdminPrismaClient();
  const email = normalizeAdminEmail(input.email);
  const ipHash = hashAdminValue(
    "client-ip",
    input.clientToken,
    config.ipHashPepper,
  );
  const rateKeyHash = hashAdminValue(
    "login-key",
    `${email}\0${input.clientToken}`,
    config.ipHashPepper,
  );

  await consumeLoginRateLimit(rateKeyHash);

  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: {
      id: true,
      displayName: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) ||
    !(await verifyAdminPassword(input.password, user.passwordHash))
  ) {
    if (user?.isActive) {
      const failedLoginCount = Math.min(user.failedLoginCount + 1, 1_000_000);
      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= LOGIN_MAX_ATTEMPTS
              ? new Date(Date.now() + ACCOUNT_LOCK_SECONDS * 1000)
              : user.lockedUntil,
        },
        select: { id: true },
      });
    }

    await prisma.adminAuditLog.create({
      data: {
        actorUserId: user?.id,
        action: "LOGIN_FAILURE",
        entityType: "ADMIN_SESSION",
        ipHash,
      },
      select: { id: true },
    });
    throw new AdminLoginRejectedError();
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashAdminValue(
    "session",
    token,
    config.sessionHashPepper,
  );
  const expiresAt = new Date(
    Date.now() + config.sessionTtlHours * 60 * 60 * 1000,
  );
  const userAgentHash = hashAdminUserAgent(input.userAgent);

  await prisma.$transaction(async (transaction) => {
    await transaction.adminSession.deleteMany({
      where: { OR: [{ expiresAt: { lte: new Date() } }, { userId: user.id }] },
    });
    await transaction.adminSession.create({
      data: { userId: user.id, tokenHash, userAgentHash, expiresAt },
      select: { id: true },
    });
    await transaction.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
      select: { id: true },
    });
    await transaction.adminLoginRateLimit.deleteMany({ where: { keyHash: rateKeyHash } });
    await transaction.adminAuditLog.create({
      data: {
        actorUserId: user.id,
        action: "LOGIN_SUCCESS",
        entityType: "ADMIN_SESSION",
        ipHash,
      },
      select: { id: true },
    });
  });

  return {
    token,
    expiresAt,
    identity: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    },
  };
}

export async function findAdminSession(
  token: string,
  userAgent: string | null,
): Promise<AdminIdentity | null> {
  const config = getAdminSecurityConfig();
  const tokenHash = hashAdminValue(
    "session",
    token,
    config.sessionHashPepper,
  );
  const session = await getAdminPrismaClient().adminSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      userAgentHash: true,
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !session ||
    !session.user.isActive ||
    session.expiresAt.getTime() <= Date.now() ||
    (session.userAgentHash &&
      session.userAgentHash !== hashAdminUserAgent(userAgent))
  ) {
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await getAdminPrismaClient().adminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
      select: { id: true },
    });
  }

  return {
    id: session.user.id,
    displayName: session.user.displayName,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function revokeAdminSession(token: string): Promise<void> {
  const config = getAdminSecurityConfig();
  const tokenHash = hashAdminValue(
    "session",
    token,
    config.sessionHashPepper,
  );
  const prisma = getAdminPrismaClient();
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.adminSession.deleteMany({ where: { tokenHash } });
    if (session) {
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: session.userId,
          action: "LOGOUT",
          entityType: "ADMIN_SESSION",
        },
        select: { id: true },
      });
    }
  });
}
