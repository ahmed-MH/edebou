import "server-only";

const MINIMUM_SECRET_LENGTH = 32;
const MAXIMUM_TRUSTED_PROXY_HOPS = 5;

export class AdminConfigurationError extends Error {
  constructor() {
    super("ADMIN_CONFIGURATION_UNAVAILABLE");
    this.name = "AdminConfigurationError";
  }
}

export interface AdminSecurityConfig {
  readonly ipHashPepper: string;
  readonly sessionHashPepper: string;
  readonly sessionTtlHours: number;
  readonly trustedProxyHops: number;
}

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < MINIMUM_SECRET_LENGTH) {
    throw new AdminConfigurationError();
  }
  return value;
}

function parseTrustedProxyHops(value: string | undefined): number {
  if (value === undefined || !/^\d$/u.test(value)) {
    throw new AdminConfigurationError();
  }

  const parsed = Number(value);
  if (
    parsed > MAXIMUM_TRUSTED_PROXY_HOPS ||
    (process.env.NODE_ENV === "production" && parsed === 0)
  ) {
    throw new AdminConfigurationError();
  }
  return parsed;
}

function parseSessionTtlHours(value: string | undefined): number {
  if (value === undefined) {
    return 8;
  }
  if (!/^\d{1,2}$/u.test(value)) {
    throw new AdminConfigurationError();
  }

  const parsed = Number(value);
  if (parsed < 1 || parsed > 24) {
    throw new AdminConfigurationError();
  }
  return parsed;
}

export function getAdminSecurityConfig(): AdminSecurityConfig {
  const sessionHashPepper = requiredSecret("ADMIN_SESSION_HASH_PEPPER");
  const ipHashPepper = requiredSecret("ADMIN_IP_HASH_PEPPER");

  if (sessionHashPepper === ipHashPepper) {
    throw new AdminConfigurationError();
  }

  return {
    sessionHashPepper,
    ipHashPepper,
    sessionTtlHours: parseSessionTtlHours(
      process.env.ADMIN_SESSION_TTL_HOURS,
    ),
    trustedProxyHops: parseTrustedProxyHops(
      process.env.ADMIN_TRUSTED_PROXY_HOPS,
    ),
  };
}
