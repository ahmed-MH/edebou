import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { resolve } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const domain = process.argv[2]?.trim().toLowerCase();
const acmeEmail = process.argv[3]?.trim().toLowerCase();

if (!domain || !acmeEmail) {
  fail("Usage: npm run oracle:env -- shop.example.com admin@example.com");
}

let parsedDomain;
try {
  parsedDomain = new URL(`https://${domain}`);
} catch {
  fail("The domain name is invalid.");
}

if (
  parsedDomain.hostname !== domain ||
  parsedDomain.pathname !== "/" ||
  domain === "localhost" ||
  isIP(domain) !== 0 ||
  !domain.includes(".")
) {
  fail("Provide a public hostname only, without a protocol, port, or path.");
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acmeEmail)) {
  fail("The ACME email address is invalid.");
}

const outputPath = resolve(".env.oracle");
try {
  await access(outputPath, constants.F_OK);
  fail(".env.oracle already exists; it was not overwritten.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const secret = () => randomBytes(32).toString("hex");
const credentials = {
  bootstrap: secret(),
  migration: secret(),
  catalog: secret(),
  checkout: secret(),
  admin: secret(),
};

const databaseUrl = (user, password) =>
  `postgresql://${user}:${password}@postgres:5432/edebou?sslmode=disable`;

const contents = `# EDebou production secrets for Oracle Cloud. Never commit this file.
DOMAIN=${domain}
ACME_EMAIL=${acmeEmail}
HSTS_MAX_AGE=0

POSTGRES_BOOTSTRAP_USER=edebou_bootstrap
POSTGRES_BOOTSTRAP_PASSWORD=${credentials.bootstrap}
POSTGRES_DB=edebou
POSTGRES_SHADOW_DB=edebou_shadow
POSTGRES_MIGRATION_USER=edebou_migration
POSTGRES_MIGRATION_PASSWORD=${credentials.migration}
POSTGRES_APP_USER=edebou_catalog
POSTGRES_APP_PASSWORD=${credentials.catalog}
POSTGRES_CHECKOUT_USER=edebou_checkout
POSTGRES_CHECKOUT_PASSWORD=${credentials.checkout}
POSTGRES_ADMIN_USER=edebou_admin
POSTGRES_ADMIN_PASSWORD=${credentials.admin}

MIGRATION_DATABASE_URL=${databaseUrl("edebou_migration", credentials.migration)}
DATABASE_URL=${databaseUrl("edebou_catalog", credentials.catalog)}
CHECKOUT_DATABASE_URL=${databaseUrl("edebou_checkout", credentials.checkout)}
ADMIN_DATABASE_URL=${databaseUrl("edebou_admin", credentials.admin)}

CHECKOUT_ALLOWED_ORIGINS=https://${domain}
CHECKOUT_IDEMPOTENCY_PEPPER=${secret()}
CHECKOUT_IP_HASH_PEPPER=${secret()}
ADMIN_SESSION_HASH_PEPPER=${secret()}
ADMIN_IP_HASH_PEPPER=${secret()}
ADMIN_SESSION_TTL_HOURS=8

NODE_OPTIONS=--max-old-space-size=1536
APP_MEMORY_LIMIT=2g
APP_CPU_LIMIT=1.5
POSTGRES_MEMORY_LIMIT=3g
POSTGRES_CPU_LIMIT=1.5
POSTGRES_SHARED_BUFFERS=512MB
CADDY_MEMORY_LIMIT=512m
CADDY_CPU_LIMIT=0.5
`;

await writeFile(outputPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
process.stdout.write(`Created ${outputPath} with mode 0600.\n`);
