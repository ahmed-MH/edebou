"use server";

import { redirect } from "next/navigation";

import { revokeAdminSession } from "@/lib/admin/auth";
import { assertAdminMutationRequest } from "@/lib/admin/request-security";
import {
  clearAdminSessionCookie,
  readAdminSessionToken,
} from "@/lib/admin/session";

export async function logoutAdminAction(): Promise<void> {
  await assertAdminMutationRequest();
  const token = await readAdminSessionToken();
  if (token) {
    await revokeAdminSession(token);
  }
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
