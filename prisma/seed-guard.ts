const ALLOWED_SEED_ENVIRONMENTS = new Set(["development", "test"]);
const ALLOWED_LOCAL_DATABASE_HOSTS = new Set([
  "127.0.0.1",
  "[::1]",
  "localhost",
]);

export function getSeedDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  if (
    !environment.NODE_ENV ||
    !ALLOWED_SEED_ENVIRONMENTS.has(environment.NODE_ENV)
  ) {
    throw new Error(
      "Demo seed is restricted to development and test environments.",
    );
  }

  if (environment.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seed requires explicit ALLOW_DEMO_SEED=true consent.");
  }

  const connectionString = environment.SEED_DATABASE_URL;

  if (!connectionString) {
    throw new Error("SEED_DATABASE_URL is required for the demo seed.");
  }

  const parsedUrl = new URL(connectionString);

  if (
    !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
    !ALLOWED_LOCAL_DATABASE_HOSTS.has(parsedUrl.hostname)
  ) {
    throw new Error("Demo seed is restricted to a local PostgreSQL database.");
  }

  // node-postgres accepts query parameters such as `host` that can override
  // the URI hostname. The local seed needs none, so reject every override.
  if (parsedUrl.search) {
    throw new Error("Demo seed database URLs must not contain query parameters.");
  }

  return connectionString;
}
