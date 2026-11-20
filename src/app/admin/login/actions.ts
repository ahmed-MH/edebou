"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  AdminLoginRejectedError,
  authenticateAdmin,
} from "@/lib/admin/auth";
import { getAdminSecurityConfig } from "@/lib/admin/config";
import { resolveAdminClientToken } from "@/lib/admin/security";
import { assertAdminMutationRequest } from "@/lib/admin/request-security";
import { setAdminSessionCookie } from "@/lib/admin/session";

const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export interface AdminLoginState {
  readonly message?: string;
}

export async function loginAdminAction(
  _state: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { message: "Identifiants incorrects." };
  }

  try {
    await assertAdminMutationRequest();
    const requestHeaders = await headers();
    const config = getAdminSecurityConfig();
    const session = await authenticateAdmin({
      email: parsed.data.email,
      password: parsed.data.password,
      clientToken: resolveAdminClientToken(
        requestHeaders,
        config.trustedProxyHops,
      ),
      userAgent: requestHeaders.get("user-agent"),
    });
    await setAdminSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    if (
      error instanceof AdminLoginRejectedError &&
      error.retryAfterSeconds !== undefined
    ) {
      return {
        message:
          "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
      };
    }
    return { message: "Identifiants incorrects ou service indisponible." };
  }

  redirect("/admin");
}
