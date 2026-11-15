import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );

  return nested.flat();
}

async function readProjectFile(path) {
  return readFile(join(projectRoot, path), "utf8");
}

test("API routes preserve read-only media/catalog and authenticated admin writes", async () => {
  const apiDirectory = join(projectRoot, "src/app/api");
  const routeFiles = (await collectFiles(apiDirectory))
    .filter((file) => file.endsWith("/route.ts"))
    .map((file) => relative(projectRoot, file).replaceAll("\\", "/"))
    .sort();

  assert.deepEqual(routeFiles, [
    "src/app/api/admin/product-images/route.ts",
    "src/app/api/categories/route.ts",
    "src/app/api/checkout-intents/route.ts",
    "src/app/api/orders/route.ts",
    "src/app/api/product-images/[filename]/route.ts",
    "src/app/api/products/[slug]/route.ts",
    "src/app/api/products/route.ts",
  ]);

  for (const routeFile of routeFiles) {
    const source = await readProjectFile(routeFile);
    if (routeFile === "src/app/api/admin/product-images/route.ts") {
      assert.match(source, /export\s+async\s+function\s+POST\b/);
      assert.match(source, /export\s+async\s+function\s+DELETE\b/);
      assert.doesNotMatch(
        source,
        /export\s+(?:async\s+)?function\s+(?:GET|PUT|PATCH)\b/,
      );
    } else if (
      routeFile === "src/app/api/orders/route.ts" ||
      routeFile === "src/app/api/checkout-intents/route.ts"
    ) {
      assert.match(source, /export\s+async\s+function\s+POST\b/);
      assert.doesNotMatch(
        source,
        /export\s+(?:async\s+)?function\s+(?:GET|PUT|PATCH|DELETE)\b/,
      );
    } else {
      assert.match(source, /export\s+async\s+function\s+GET\b/);
      assert.doesNotMatch(
        source,
        /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/,
        `${routeFile} must remain read-only`,
      );
    }
  }
});

test("database access stays server-only and out of client components", async () => {
  const sourceFiles = (await collectFiles(join(projectRoot, "src"))).filter(
    (file) => [".ts", ".tsx"].includes(extname(file)),
  );

  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    const firstStatement = source.match(/^\s*(?:["']use client["'];?)/);

    if (!firstStatement) {
      continue;
    }

    const projectPath = relative(projectRoot, file).replaceAll("\\", "/");
    assert.doesNotMatch(
      source,
      /(?:@prisma\/|\/generated\/prisma|@\/lib\/(?:db|repositories|services)|\bpg\b)/,
      `${projectPath} must not import server-side data access code`,
    );
    assert.doesNotMatch(
      source,
      /process\.env\./,
      `${projectPath} must not read server environment variables`,
    );
  }
});

test("Prisma unsafe raw-query helpers are not used", async () => {
  const scannedRoots = ["src", "prisma"];
  const files = (
    await Promise.all(
      scannedRoots.map(async (directory) => {
        try {
          return await collectFiles(join(projectRoot, directory));
        } catch (error) {
          if (error?.code === "ENOENT") {
            return [];
          }
          throw error;
        }
      }),
    )
  ).flat();
  const authoredFiles = files.filter(
    (file) =>
      [".js", ".mjs", ".ts", ".tsx"].includes(extname(file)) &&
      !file.includes(`${join("src", "generated", "prisma")}`),
  );

  for (const file of authoredFiles) {
    const source = await readFile(file, "utf8");
    const projectPath = relative(projectRoot, file).replaceAll("\\", "/");
    assert.doesNotMatch(
      source,
      /\$(?:queryRawUnsafe|executeRawUnsafe)\b/,
      `${projectPath} must not use an unsafe raw-query helper`,
    );
  }
});

test("browser-exposed environment variables cannot carry secrets or database settings", async () => {
  const filesToScan = [
    ".env.example",
    ".env.database.example",
    "next.config.ts",
    ...(await collectFiles(join(projectRoot, "src"))).map((file) =>
      relative(projectRoot, file),
    ),
  ];
  const source = (
    await Promise.all(filesToScan.map((file) => readProjectFile(file)))
  ).join("\n");

  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC_[A-Z0-9_]*(?:DATABASE|DB_|PASSWORD|SECRET|TOKEN|PRIVATE|CREDENTIAL|API_KEY)[A-Z0-9_]*/,
  );
  assert.doesNotMatch(source, /NEXT_PUBLIC_DATABASE_URL/);
});

test("project scripts never use db push as a migration strategy", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const scripts = Object.values(packageJson.scripts ?? {}).join("\n");

  assert.doesNotMatch(scripts, /\bprisma\s+db\s+push\b/);
  assert.match(packageJson.scripts["db:migrate:dev"], /prisma migrate dev/);
  assert.match(
    packageJson.scripts["db:migrate:deploy"],
    /prisma migrate deploy/,
  );
});

test("privileged database secrets are loaded only by explicit operations", async () => {
  const [packageJson, prismaConfig, databaseVerification] = await Promise.all([
    readProjectFile("package.json").then(JSON.parse),
    readProjectFile("prisma.config.ts"),
    readProjectFile("scripts/verify-database.mjs"),
  ]);

  for (const scriptName of ["dev", "build", "start"]) {
    assert.doesNotMatch(packageJson.scripts[scriptName], /\.env\.database/);
  }
  for (const scriptName of ["db:up", "db:stop", "db:down", "db:logs"]) {
    assert.match(
      packageJson.scripts[scriptName],
      /--env-file \.env\.database/,
    );
  }

  assert.match(prismaConfig, /"\.env\.database"/);
  assert.match(databaseVerification, /"\.env\.database"/);
  assert.doesNotMatch(prismaConfig, /loadEnvironment\(\s*\{?\s*path:\s*["']\.env["']/);
});

test("the Prisma contract stores every monetary amount as bounded integers", async () => {
  const [schema, migration] = await Promise.all([
    readProjectFile("prisma/schema.prisma"),
    readProjectFile(
      "prisma/migrations/20261111120000_initial_ecommerce/migration.sql",
    ),
  ]);

  for (const model of [
    "Category",
    "Product",
    "ProductImage",
    "ProductPriceTier",
    "Order",
    "OrderItem",
    "StoreSettings",
  ]) {
    assert.match(schema, new RegExp(`model\\s+${model}\\s*\\{`));
  }
  for (const status of [
    "PENDING",
    "CONFIRMED",
    "SHIPPING",
    "DELIVERED",
    "CANCELLED",
  ]) {
    assert.match(schema, new RegExp(`^\\s*${status}\\s*$`, "m"));
  }

  assert.doesNotMatch(
    schema,
    /^\s*(?:price|unitPrice|subtotal|deliveryFee|total|lineTotal)\s+(?:Float|Decimal)\b/gm,
  );
  for (const field of [
    "price",
    "unitPrice",
    "subtotal",
    "deliveryFee",
    "total",
    "lineTotal",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\s+BigInt\\b`));
  }

  for (const constraint of [
    "products_price_range_check",
    "products_stock_quantity_range_check",
    "product_price_tiers_min_quantity_range_check",
    "product_price_tiers_unit_price_range_check",
    "orders_total_integrity_check",
    "order_items_line_total_integrity_check",
    "store_settings_singleton_check",
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }

  assert.match(
    migration,
    /CREATE UNIQUE INDEX "product_price_tiers_product_id_min_quantity_key"/,
  );
});

test("the local PostgreSQL service is isolated and uses SCRAM with separate roles", async () => {
  const [compose, initializer, migration] = await Promise.all([
    readProjectFile("compose.yaml"),
    readProjectFile("docker/postgres/init/10-create-roles.sh"),
    readProjectFile(
      "prisma/migrations/20261111120000_initial_ecommerce/migration.sql",
    ),
  ]);

  assert.match(compose, /image:\s+postgres:18\.6-bookworm/);
  assert.match(
    compose,
    /127\.0\.0\.1:\$\{POSTGRES_PORT:-5432\}:5432/,
  );
  assert.match(compose, /--auth-host=scram-sha-256/);
  assert.match(compose, /--auth-local=scram-sha-256/);
  assert.match(compose, /password_encryption=scram-sha-256/);
  assert.match(compose, /healthcheck:/);
  assert.match(compose, /postgres_data:\/var\/lib\/postgresql/);
  assert.match(compose, /driver:\s+bridge/);
  assert.doesNotMatch(compose, /0\.0\.0\.0:/);
  assert.doesNotMatch(compose, /POSTGRES_HOST_AUTH_METHOD:\s*trust/);

  assert.match(initializer, /POSTGRES_MIGRATION_USER/);
  assert.match(initializer, /POSTGRES_APP_USER/);
  assert.match(
    initializer,
    /NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/,
  );
  assert.match(initializer, /CREATE ROLE edebou_catalog_reader NOLOGIN/);
  assert.doesNotMatch(
    initializer,
    /GRANT SELECT ON (?:ALL )?TABLES[^\n]*app_user/i,
  );

  assert.match(
    migration,
    /GRANT SELECT ON TABLE[\s\S]*"store_settings"[\s\S]*TO edebou_catalog_reader;/,
  );
  const catalogGrant = migration.match(
    /GRANT SELECT ON TABLE[\s\S]*?TO edebou_catalog_reader;/,
  )?.[0];
  assert.ok(catalogGrant);
  assert.doesNotMatch(catalogGrant, /"orders"|"order_items"|_prisma_migrations/);
});

test("demo seeding is explicit, local-only, and idempotent by construction", async () => {
  const [seed, guard] = await Promise.all([
    readProjectFile("prisma/seed.ts"),
    readProjectFile("prisma/seed-guard.ts"),
  ]);
  const source = `${seed}\n${guard}`;

  assert.match(source, /ALLOW_DEMO_SEED !== "true"/);
  assert.match(source, /ALLOWED_SEED_ENVIRONMENTS/);
  assert.match(source, /ALLOWED_LOCAL_DATABASE_HOSTS/);
  assert.match(source, /SEED_DATABASE_URL/);
  assert.match(guard, /if \(parsedUrl\.search\)/);
  assert.match(seed, /\.upsert\(/);
  assert.match(seed, /productImage\.deleteMany\(/);
  assert.match(seed, /productPriceTier\.deleteMany\(/);
  assert.doesNotMatch(
    seed,
    /transaction\.(?:category|product)\.(?:deleteMany|delete)\s*\(/,
  );
  assert.doesNotMatch(seed, /\.truncate\s*\(/);
  assert.doesNotMatch(source, /process\.env\.DATABASE_URL/);
});
