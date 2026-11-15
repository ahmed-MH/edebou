import "server-only";

import { createHmac, createHash } from "node:crypto";
import { isIP } from "node:net";

import { AdminConfigurationError } from "./config";

export function normalizeAdminEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function hashAdminValue(
  domain: "session" | "client-ip" | "login-key",
  value: string,
  pepper: string,
): string {
  return createHmac("sha256", pepper)
    .update(`edebou:admin:${domain}:v1\0`, "utf8")
    .update(value, "utf8")
    .digest("hex");
}

export function hashAdminUserAgent(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return createHash("sha256").update(value.slice(0, 512), "utf8").digest("hex");
}

export function resolveAdminClientToken(
  headers: Pick<Headers, "get">,
  trustedProxyHops: number,
): string {
  if (trustedProxyHops === 0) {
    return "unattributed-direct-admin";
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) {
    throw new AdminConfigurationError();
  }

  const chain = forwardedFor.split(",").map((value) => value.trim());
  const candidateIndex = chain.length - trustedProxyHops;
  if (
    candidateIndex < 0 ||
    chain.some((value) => !value || isIP(value) === 0)
  ) {
    throw new AdminConfigurationError();
  }

  return chain[candidateIndex];
}
