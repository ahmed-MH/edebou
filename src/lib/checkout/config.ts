import "server-only";

import { CheckoutServiceUnavailableError } from "@/lib/checkout/errors";

const MINIMUM_PEPPER_LENGTH = 32;
const MAXIMUM_TRUSTED_PROXY_HOPS = 5;

export interface CheckoutSecurityConfig {
  readonly allowedOrigins: ReadonlySet<string>;
  readonly idempotencyPepper: string;
  readonly ipHashPepper: string;
  readonly trustedProxyHops: number;
}

function requiredSecret(name: string): string {
  const value = process.env[name];

  if (!value || value.length < MINIMUM_PEPPER_LENGTH) {
    throw new CheckoutServiceUnavailableError();
  }

  return value;
}

export function parseAllowedCheckoutOrigins(
  rawValue: string | undefined,
  production = process.env.NODE_ENV === "production",
): ReadonlySet<string> {
  if (!rawValue) {
    throw new CheckoutServiceUnavailableError();
  }

  const origins = new Set<string>();

  for (const rawOrigin of rawValue.split(",")) {
    const candidate = rawOrigin.trim();

    if (!candidate) {
      throw new CheckoutServiceUnavailableError();
    }

    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new CheckoutServiceUnavailableError();
    }

    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && (production || !isLocalHttp))
    ) {
      throw new CheckoutServiceUnavailableError();
    }

    origins.add(url.origin);
  }

  if (origins.size === 0) {
    throw new CheckoutServiceUnavailableError();
  }

  return origins;
}

export function parseTrustedProxyHops(
  rawValue: string | undefined,
  production = process.env.NODE_ENV === "production",
): number {
  if (rawValue === undefined || !/^\d$/u.test(rawValue)) {
    throw new CheckoutServiceUnavailableError();
  }

  const value = Number(rawValue);
  if (value > MAXIMUM_TRUSTED_PROXY_HOPS || (production && value === 0)) {
    throw new CheckoutServiceUnavailableError();
  }

  return value;
}

export function getCheckoutSecurityConfig(): CheckoutSecurityConfig {
  const idempotencyPepper = requiredSecret("CHECKOUT_IDEMPOTENCY_PEPPER");
  const ipHashPepper = requiredSecret("CHECKOUT_IP_HASH_PEPPER");

  if (idempotencyPepper === ipHashPepper) {
    throw new CheckoutServiceUnavailableError();
  }

  return {
    allowedOrigins: parseAllowedCheckoutOrigins(
      process.env.CHECKOUT_ALLOWED_ORIGINS,
    ),
    idempotencyPepper,
    ipHashPepper,
    trustedProxyHops: parseTrustedProxyHops(
      process.env.CHECKOUT_TRUSTED_PROXY_HOPS,
    ),
  };
}
