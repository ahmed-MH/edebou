import "server-only";

import { headers } from "next/headers";

import { normalizeForwardedHost } from "@/lib/host-policy";

import { getAdminSecurityConfig } from "./config";

export class AdminRequestRejectedError extends Error {
  constructor() {
    super("ADMIN_REQUEST_REJECTED");
    this.name = "AdminRequestRejectedError";
  }
}

export function isSecureAdminMutationHeaders(
  requestHeaders: Pick<Headers, "get">,
  expectedOrigin: string,
): boolean {
  const origin = requestHeaders.get("origin");
  if (!origin || origin.includes(",")) return false;

  let expectedHost: string;
  try {
    const parsedOrigin = new URL(origin);
    const parsedExpected = new URL(expectedOrigin);
    if (parsedOrigin.origin !== origin || parsedOrigin.pathname !== "/") {
      return false;
    }
    if (parsedOrigin.origin !== parsedExpected.origin) return false;
    expectedHost = parsedExpected.host.toLowerCase();
  } catch {
    return false;
  }

  const forwardedHost = normalizeForwardedHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );
  const fetchSite = requestHeaders.get("sec-fetch-site");
  return (
    forwardedHost === expectedHost &&
    (fetchSite === null || fetchSite === "same-origin")
  );
}

export async function assertAdminMutationRequest(): Promise<void> {
  const requestHeaders = await headers();
  if (
    !isSecureAdminMutationHeaders(
      requestHeaders,
      getAdminSecurityConfig().appOrigin,
    )
  ) {
    throw new AdminRequestRejectedError();
  }
}
