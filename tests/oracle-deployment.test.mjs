import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const source = (path) => readFile(join(projectRoot, path), "utf8");

test("Oracle runtime stays pinned, non-root and privately networked", async () => {
  const [dockerfile, compose] = await Promise.all([
    source("Dockerfile"),
    source("compose.oracle.yaml"),
  ]);

  assert.match(dockerfile, /node:22-bookworm-slim@sha256:[a-f0-9]{64}/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /\/api\/health\/ready/);
  assert.doesNotMatch(compose, /["']?3000:3000["']?/);
  assert.doesNotMatch(compose, /["']?5432:5432["']?/);
  assert.match(compose, /database:\n\s+driver: bridge\n\s+internal: true/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
});

test("HSTS is opt-in only after HTTPS validation", async () => {
  const [caddyfile, environmentTemplate] = await Promise.all([
    source("deploy/oracle/Caddyfile"),
    source(".env.oracle.example"),
  ]);

  assert.match(caddyfile, /Strict-Transport-Security "max-age=\{\$HSTS_MAX_AGE\}"/);
  assert.match(environmentTemplate, /^HSTS_MAX_AGE=0$/m);
  assert.doesNotMatch(caddyfile, /includeSubDomains/i);
});

test("backup and restore cover data and images without production secrets", async () => {
  const [backup, restore] = await Promise.all([
    source("deploy/oracle/backup.sh"),
    source("deploy/oracle/verify-restore.sh"),
  ]);

  assert.match(backup, /pg_dump/);
  assert.match(backup, /product-images\.tar\.gz/);
  assert.match(backup, /secrets_included=false/);
  assert.doesNotMatch(backup, /cat .*\.env\.oracle/);
  assert.match(restore, /--tmpfs \/var\/lib\/postgresql:/);
  assert.match(restore, /pg_restore/);
  assert.match(restore, /public\._prisma_migrations/);
  assert.doesNotMatch(restore, /compose\.oracle\.yaml/);
});
