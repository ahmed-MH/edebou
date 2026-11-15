import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import {
  ForbiddenCheckoutRequestError,
  InvalidCheckoutRequestError,
} from "@/lib/checkout/errors";

export const CHECKOUT_CSRF_HEADER = "x-edebou-csrf";
export const CHECKOUT_CSRF_VALUE = "1";
export const MAX_CHECKOUT_BODY_BYTES = 16 * 1024;

interface RequestSecurityOptions {
  readonly allowedOrigins: ReadonlySet<string>;
  readonly trustedProxyHops: number;
}

function assertJsonContentType(value: string | null): void {
  if (!value) {
    throw new InvalidCheckoutRequestError();
  }

  const parts = value.split(";").map((part) => part.trim().toLowerCase());
  const [mediaType, ...parameters] = parts;

  if (
    mediaType !== "application/json" ||
    parameters.some((parameter) => parameter !== "charset=utf-8")
  ) {
    throw new InvalidCheckoutRequestError();
  }
}

export function assertCheckoutRequestSecurity(
  request: Request,
  options: RequestSecurityOptions,
): void {
  const originHeader = request.headers.get("origin");

  if (!originHeader || originHeader.includes(",")) {
    throw new ForbiddenCheckoutRequestError();
  }

  let origin: string;
  try {
    const originUrl = new URL(originHeader);
    if (originUrl.origin !== originHeader || originUrl.pathname !== "/") {
      throw new Error("Non-canonical origin");
    }
    origin = originUrl.origin;
  } catch {
    throw new ForbiddenCheckoutRequestError();
  }

  if (!options.allowedOrigins.has(origin)) {
    throw new ForbiddenCheckoutRequestError();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    fetchSite !== null &&
    fetchSite !== "same-origin" &&
    fetchSite !== "same-site"
  ) {
    throw new ForbiddenCheckoutRequestError();
  }

  if (request.headers.get(CHECKOUT_CSRF_HEADER) !== CHECKOUT_CSRF_VALUE) {
    throw new ForbiddenCheckoutRequestError();
  }

  assertJsonContentType(request.headers.get("content-type"));

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/u.test(contentLength)) {
      throw new InvalidCheckoutRequestError();
    }

    if (Number(contentLength) > MAX_CHECKOUT_BODY_BYTES) {
      throw new InvalidCheckoutRequestError();
    }
  }
}

export function resolveCheckoutClientToken(
  request: Request,
  trustedProxyHops: number,
): string {
  if (trustedProxyHops === 0) {
    return "unattributed-direct-client";
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    throw new ForbiddenCheckoutRequestError();
  }

  const chain = forwardedFor.split(",").map((value) => value.trim());
  const candidateIndex = chain.length - trustedProxyHops;

  if (
    candidateIndex < 0 ||
    chain.some((value) => !value || isIP(value) === 0)
  ) {
    throw new ForbiddenCheckoutRequestError();
  }

  return chain[candidateIndex];
}

export function hmacCheckoutValue(
  domain:
    | "idempotency"
    | "request"
    | "client-ip"
    | "intent-token"
    | "intent-client-ip",
  value: string,
  pepper: string,
): string {
  return createHmac("sha256", pepper)
    .update(`edebou:${domain}:v1\0`, "utf8")
    .update(value, "utf8")
    .digest("hex");
}

function assertJsonComplexity(value: unknown): void {
  const pending: Array<{ readonly value: unknown; readonly depth: number }> = [
    { value, depth: 0 },
  ];
  let visitedNodes = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      break;
    }

    visitedNodes += 1;
    if (visitedNodes > 200 || current.depth > 6) {
      throw new InvalidCheckoutRequestError();
    }

    if (Array.isArray(current.value)) {
      for (const child of current.value) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    } else if (current.value !== null && typeof current.value === "object") {
      for (const child of Object.values(current.value)) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
}

export async function readBoundedCheckoutJson(request: Request): Promise<unknown> {
  if (!request.body) {
    throw new InvalidCheckoutRequestError();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_CHECKOUT_BODY_BYTES) {
        await reader.cancel();
        throw new InvalidCheckoutRequestError();
      }

      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof InvalidCheckoutRequestError) {
      throw error;
    }
    throw new InvalidCheckoutRequestError();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const value: unknown = JSON.parse(decoded);
    assertJsonComplexity(value);
    return value;
  } catch (error) {
    if (error instanceof InvalidCheckoutRequestError) {
      throw error;
    }
    throw new InvalidCheckoutRequestError();
  }
}
