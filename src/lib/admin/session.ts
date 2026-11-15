import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type { AdminIdentity } from "./auth";
import { findAdminSession } from "./auth";

const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-edebou_admin_session"
    : "edebou_admin_session";

export async function setAdminSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    priority: "high",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

export async function readAdminSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export const getOptionalAdminSession = cache(
  async (): Promise<AdminIdentity | null> => {
    const token = await readAdminSessionToken();
    if (!token || token.length > 128) {
      return null;
    }
    const requestHeaders = await headers();
    return findAdminSession(token, requestHeaders.get("user-agent"));
  },
);

export const requireAdminSession = cache(async (): Promise<AdminIdentity> => {
  const session = await getOptionalAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
});
