import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { config as loadEnvironment } from "dotenv";
import { Pool } from "pg";

const execFileAsync = promisify(execFile);

loadEnvironment({
  path: process.env.DATABASE_ENV_FILE ?? ".env.database",
  override: false,
  quiet: true,
});

const connectionOptions = {
  max: 2,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  application_name: "edebou-database-verification",
};

function requiredEnvironment(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for the database verification.`);
  }

  return value;
}

function createPool(connectionString) {
  return new Pool({ connectionString, ...connectionOptions });
}

async function runDemoSeed() {
  await execFileAsync(process.platform === "win32" ? "npm.cmd" : "npm", [
    "run",
    "db:seed",
  ], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
}

async function readDemoSeedSnapshot(applicationPool) {
  const [categories, products, images, priceTiers, settings] =
    await Promise.all([
      applicationPool.query(`
        SELECT id, slug, name_ar, name_fr, is_active
        FROM public.categories
        WHERE slug = ANY($1::text[])
        ORDER BY slug
      `, [["beauty", "electronics", "essentials", "fashion", "home", "sport"]]),
      applicationPool.query(`
        SELECT
          id,
          category_id,
          sku,
          slug,
          name_ar,
          name_fr,
          description_ar,
          description_fr,
          price,
          stock_quantity,
          is_active
        FROM public.products
        WHERE sku LIKE 'DEMO-%'
        ORDER BY sku
      `),
      applicationPool.query(`
        SELECT image.id, image.product_id, image.path, image.alt_ar, image.alt_fr,
               image.position
        FROM public.product_images AS image
        JOIN public.products AS product ON product.id = image.product_id
        WHERE product.sku LIKE 'DEMO-%'
        ORDER BY product.sku, image.position
      `),
      applicationPool.query(`
        SELECT tier.id, tier.product_id, tier.min_quantity, tier.unit_price
        FROM public.product_price_tiers AS tier
        JOIN public.products AS product ON product.id = tier.product_id
        WHERE product.sku LIKE 'DEMO-%'
        ORDER BY product.sku, tier.min_quantity
      `),
      applicationPool.query(`
        SELECT id, delivery_fee, store_name
        FROM public.store_settings
        WHERE id = 1
      `),
    ]);

  return {
    categories: categories.rows,
    products: products.rows,
    images: images.rows,
    priceTiers: priceTiers.rows,
    settings: settings.rows,
  };
}

async function verifyDemoSeedIdempotence(applicationPool) {
  await runDemoSeed();
  const firstSnapshot = await readDemoSeedSnapshot(applicationPool);
  await runDemoSeed();
  const secondSnapshot = await readDemoSeedSnapshot(applicationPool);

  assert.deepEqual(secondSnapshot, firstSnapshot);
}

function assertUnprivilegedLogin(role) {
  assert.equal(role.rolcanlogin, true);
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolcreatedb, false);
  assert.equal(role.rolcreaterole, false);
  assert.equal(role.rolreplication, false);
  assert.equal(role.rolbypassrls, false);
}

function isInsufficientPrivilege(error) {
  assert.equal(error?.code, "42501");
  return true;
}

async function verifyBadCredentialsAreRejected(applicationUrl) {
  const invalidUrl = new URL(applicationUrl);
  invalidUrl.password = "intentionally-invalid-edebou-password";
  const invalidPool = createPool(invalidUrl.toString());

  try {
    await assert.rejects(invalidPool.query("SELECT 1"));
  } finally {
    await invalidPool.end();
  }
}

async function verifyApplicationRole(applicationPool) {
  const roleResult = await applicationPool.query(`
    SELECT
      rolcanlogin,
      rolsuper,
      rolcreatedb,
      rolcreaterole,
      rolreplication,
      rolbypassrls,
      rolconnlimit
    FROM pg_catalog.pg_roles
    WHERE rolname = current_user
  `);
  assert.equal(roleResult.rowCount, 1);
  assertUnprivilegedLogin(roleResult.rows[0]);
  assert.equal(roleResult.rows[0].rolconnlimit, 20);

  const boundaryResult = await applicationPool.query(`
    SELECT
      pg_has_role(current_user, 'edebou_catalog_reader', 'MEMBER') AS catalog_member,
      has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
      has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
      has_database_privilege(current_user, current_database(), 'CREATE') AS database_create
  `);
  assert.deepEqual(boundaryResult.rows[0], {
    catalog_member: true,
    schema_usage: true,
    schema_create: false,
    database_create: false,
  });

  const privilegesResult = await applicationPool.query(`
    SELECT
      has_table_privilege(current_user, 'public.categories', 'SELECT') AS categories_select,
      has_table_privilege(current_user, 'public.products', 'SELECT') AS products_select,
      has_table_privilege(current_user, 'public.product_images', 'SELECT') AS images_select,
      has_table_privilege(current_user, 'public.product_price_tiers', 'SELECT') AS tiers_select,
      has_table_privilege(current_user, 'public.store_settings', 'SELECT') AS settings_select,
      has_table_privilege(current_user, 'public.orders', 'SELECT') AS orders_select,
      has_table_privilege(current_user, 'public.order_items', 'SELECT') AS order_items_select,
      has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') AS migrations_select,
      (
        has_table_privilege(current_user, 'public.products', 'INSERT') OR
        has_table_privilege(current_user, 'public.products', 'UPDATE') OR
        has_table_privilege(current_user, 'public.products', 'DELETE') OR
        has_table_privilege(current_user, 'public.products', 'TRUNCATE')
      ) AS products_mutate
  `);
  assert.deepEqual(privilegesResult.rows[0], {
    categories_select: true,
    products_select: true,
    images_select: true,
    tiers_select: true,
    settings_select: true,
    orders_select: false,
    order_items_select: false,
    migrations_select: false,
    products_mutate: false,
  });

  await assert.rejects(
    applicationPool.query("SELECT 1 FROM public.orders LIMIT 1"),
    isInsufficientPrivilege,
  );
  await assert.rejects(
    applicationPool.query(
      "UPDATE public.products SET stock_quantity = stock_quantity WHERE false",
    ),
    isInsufficientPrivilege,
  );

  const ddlClient = await applicationPool.connect();
  try {
    await ddlClient.query("BEGIN");
    await assert.rejects(
      ddlClient.query(
        "CREATE TABLE public.edebou_application_role_probe (id integer)",
      ),
      isInsufficientPrivilege,
    );
  } finally {
    await ddlClient.query("ROLLBACK");
    ddlClient.release();
  }

  const catalogResult = await applicationPool.query(`
    SELECT
      count(*) FILTER (WHERE is_active) AS active_count,
      count(*) FILTER (WHERE NOT is_active) AS inactive_count,
      count(DISTINCT sku) AS distinct_sku_count,
      count(*) AS total_count
    FROM public.products
    WHERE sku LIKE 'DEMO-%'
  `);
  assert.equal(Number(catalogResult.rows[0].active_count), 4);
  assert.equal(Number(catalogResult.rows[0].inactive_count), 1);
  assert.equal(Number(catalogResult.rows[0].distinct_sku_count), 5);
  assert.equal(Number(catalogResult.rows[0].total_count), 5);

  const demoRelationsResult = await applicationPool.query(`
    SELECT
      (SELECT count(*) FROM public.product_images pi
        JOIN public.products p ON p.id = pi.product_id
        WHERE p.sku LIKE 'DEMO-%') AS image_count,
      (SELECT count(*) FROM public.product_price_tiers pt
        JOIN public.products p ON p.id = pt.product_id
        WHERE p.sku LIKE 'DEMO-%') AS tier_count
  `);
  assert.equal(Number(demoRelationsResult.rows[0].image_count), 4);
  assert.equal(Number(demoRelationsResult.rows[0].tier_count), 8);
}

async function verifyMigrationRole(migrationPool) {
  const roleResult = await migrationPool.query(`
    SELECT
      rolcanlogin,
      rolsuper,
      rolcreatedb,
      rolcreaterole,
      rolreplication,
      rolbypassrls,
      rolconnlimit
    FROM pg_catalog.pg_roles
    WHERE rolname = current_user
  `);
  assert.equal(roleResult.rowCount, 1);
  assertUnprivilegedLogin(roleResult.rows[0]);
  assert.equal(roleResult.rows[0].rolconnlimit, 5);

  const migrationResult = await migrationPool.query(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM public._prisma_migrations
    ORDER BY started_at
  `);
  assert.ok(migrationResult.rowCount >= 1);
  for (const migration of migrationResult.rows) {
    assert.ok(migration.finished_at);
    assert.equal(migration.rolled_back_at, null);
  }

  const constraintsResult = await migrationPool.query(`
    SELECT conname
    FROM pg_catalog.pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conname = ANY($1::text[])
  `, [[
    "products_price_range_check",
    "products_stock_quantity_range_check",
    "product_price_tiers_min_quantity_range_check",
    "orders_total_integrity_check",
    "order_items_line_total_integrity_check",
    "store_settings_singleton_check",
  ]]);
  assert.equal(constraintsResult.rowCount, 6);
}

const applicationUrl = requiredEnvironment("DATABASE_URL");
const migrationUrl = requiredEnvironment("MIGRATION_DATABASE_URL");
const applicationPool = createPool(applicationUrl);
const migrationPool = createPool(migrationUrl);

try {
  await verifyDemoSeedIdempotence(applicationPool);
  await verifyBadCredentialsAreRejected(applicationUrl);
  await verifyApplicationRole(applicationPool);
  await verifyMigrationRole(migrationPool);
} finally {
  await Promise.all([applicationPool.end(), migrationPool.end()]);
}

console.log(
  "Database verification passed: credentials, migrations, seed idempotence, constraints, and least-privilege roles.",
);
