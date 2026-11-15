"use server";

import { redirect } from "next/navigation";

import { revokeAdminSession } from "@/lib/admin/auth";
import {
  clearAdminSessionCookie,
  readAdminSessionToken,
} from "@/lib/admin/session";

export async function logoutAdminAction(): Promise<void> {
  const token = await readAdminSessionToken();
  if (token) {
    await revokeAdminSession(token);
  }
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
