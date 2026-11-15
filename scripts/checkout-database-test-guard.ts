const ALLOWED_TEST_ENVIRONMENTS = new Set(["development", "test"]);
const ALLOWED_LOCAL_DATABASE_HOSTS = new Set([
  "127.0.0.1",
  "[::1]",
  "localhost",
]);

interface CheckoutDatabaseTestUrls {
  readonly migrationUrl: string;
  readonly checkoutUrl: string;
}

function parseLocalPostgresUrl(value: string | undefined, name: string): URL {
  if (!value) {
    throw new Error(`${name} is required for checkout database verification.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !ALLOWED_LOCAL_DATABASE_HOSTS.has(parsed.hostname)
  ) {
    throw new Error("Checkout database verification is restricted to localhost.");
  }

  // node-postgres accepts query parameters (including host/hostaddr) that can
  // override the URI authority. The destructive local test needs none.
  if (parsed.search) {
    throw new Error("Checkout database test URLs must not contain query parameters.");
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    throw new Error("Checkout database test URLs must name a database.");
  }

  return parsed;
}

export function getCheckoutDatabaseTestUrls(
  environment: NodeJS.ProcessEnv = process.env,
): CheckoutDatabaseTestUrls {
  if (
    !environment.NODE_ENV ||
    !ALLOWED_TEST_ENVIRONMENTS.has(environment.NODE_ENV)
  ) {
    throw new Error(
      "Checkout database verification is restricted to development and test.",
    );
  }

  if (environment.ALLOW_CHECKOUT_DB_TEST !== "true") {
    throw new Error(
      "Checkout database verification requires ALLOW_CHECKOUT_DB_TEST=true consent.",
    );
  }

  const migration = parseLocalPostgresUrl(
    environment.MIGRATION_DATABASE_URL,
    "MIGRATION_DATABASE_URL",
  );
  const checkout = parseLocalPostgresUrl(
    environment.CHECKOUT_DATABASE_URL,
    "CHECKOUT_DATABASE_URL",
  );
  const normalizedMigrationPort = migration.port || "5432";
  const normalizedCheckoutPort = checkout.port || "5432";

  if (
    migration.hostname !== checkout.hostname ||
    normalizedMigrationPort !== normalizedCheckoutPort ||
    migration.pathname !== checkout.pathname ||
    migration.username === checkout.username
  ) {
    throw new Error(
      "Migration and checkout test URLs must target the same local database with distinct roles.",
    );
  }

  return {
    migrationUrl: environment.MIGRATION_DATABASE_URL as string,
    checkoutUrl: environment.CHECKOUT_DATABASE_URL as string,
  };
}
