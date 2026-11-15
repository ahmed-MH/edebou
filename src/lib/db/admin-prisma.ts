import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

interface AdminPrismaGlobalState {
  __edebouAdminPrismaClient?: PrismaClient;
}

const adminPrismaGlobal = globalThis as typeof globalThis &
  AdminPrismaGlobalState;

function createAdminPrismaClient(): PrismaClient {
  const connectionString = process.env.ADMIN_DATABASE_URL;

  if (!connectionString) {
    throw new Error("Admin database configuration is unavailable.");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 8_000,
    application_name: "edebou-backoffice",
  });

  return new PrismaClient({ adapter });
}

export function getAdminPrismaClient(): PrismaClient {
  adminPrismaGlobal.__edebouAdminPrismaClient ??=
    createAdminPrismaClient();
  return adminPrismaGlobal.__edebouAdminPrismaClient;
}

/** Intended for finite scripts and graceful process shutdown only. */
export async function disconnectAdminPrismaClient(): Promise<void> {
  const client = adminPrismaGlobal.__edebouAdminPrismaClient;

  if (!client) {
    return;
  }

  try {
    await client.$disconnect();
  } finally {
    delete adminPrismaGlobal.__edebouAdminPrismaClient;
  }
}
