import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { config as loadEnvironment } from "dotenv";
import { Pool, type DatabaseError } from "pg";

import { OrderUnavailableError } from "../src/lib/checkout/errors";
import { disconnectCheckoutPrismaClient } from "../src/lib/db/checkout-prisma";
import {
  ORDER_RATE_LIMIT_MAX_ATTEMPTS,
  prismaCheckoutRepository,
} from "../src/lib/repositories/prisma-checkout-repository";
import type { CreateOrderPersistenceInput } from "../src/lib/repositories/checkout-repository";
import type { ValidatedOrderRequest } from "../src/lib/validators/order";
import { getCheckoutDatabaseTestUrls } from "./checkout-database-test-guard";

loadEnvironment({
  path: process.env.DATABASE_ENV_FILE ?? ".env.database",
  override: false,
  quiet: true,
});

const testUrls = getCheckoutDatabaseTestUrls();

const migrationPool = new Pool({
  connectionString: testUrls.migrationUrl,
  max: 2,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  application_name: "edebou-checkout-verification-admin",
});

const checkoutPool = new Pool({
  connectionString: testUrls.checkoutUrl,
  max: 4,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  application_name: "edebou-checkout-verification-role",
});

const fixtureCustomerName = "EDebou Checkout Verification";
const fixtureCategorySlug = "checkout-verification";
const fixtureSlugs = [
  "checkout-tier-product",
  "checkout-idempotent-product",
  "checkout-race-product",
  "checkout-a-rollback-stocked",
  "checkout-z-rollback-empty",
  "checkout-inactive-product",
] as const;

function digest(label: string): string {
  return createHash("sha256")
    .update(`edebou-checkout-verification:${label}`, "utf8")
    .digest("hex");
}

function makeRequest(
  items: ValidatedOrderRequest["items"],
  label: string,
): CreateOrderPersistenceInput {
  return {
    idempotencyKeyHash: digest(`key:${label}`),
    requestHash: digest(`request:${label}`),
    request: {
      idempotencyKey: randomUUID(),
      locale: "fr",
      customer: {
        fullName: fixtureCustomerName,
        phone: "+21620123456",
        governorate: "tunis",
        address: "12 rue de la Vérification, Tunis",
        notes: "Données fictives de test",
      },
      items,
    },
  };
}

async function cleanFixtures(): Promise<void> {
  await migrationPool.query(
    `DELETE FROM public.orders WHERE customer_name = $1`,
    [fixtureCustomerName],
  );
  await migrationPool.query(
    `DELETE FROM public.product_price_tiers
     WHERE product_id IN (SELECT id FROM public.products WHERE slug = ANY($1::text[]))`,
    [fixtureSlugs],
  );
  await migrationPool.query(
    `DELETE FROM public.products WHERE slug = ANY($1::text[])`,
    [fixtureSlugs],
  );
  await migrationPool.query(
    `DELETE FROM public.categories WHERE slug = $1`,
    [fixtureCategorySlug],
  );
  await migrationPool.query(
    `DELETE FROM public.checkout_rate_limits
     WHERE key_hash = $1`,
    [digest("rate-limit")],
  );
}

async function createFixtures(): Promise<void> {
  const category = await migrationPool.query<{ id: string }>(
    `INSERT INTO public.categories (slug, name_ar, name_fr, is_active)
     VALUES ($1, 'اختبار الدفع', 'Vérification checkout', true)
     RETURNING id`,
    [fixtureCategorySlug],
  );
  const categoryId = category.rows[0]?.id;
  assert.ok(categoryId);

  const stocks = new Map<string, number>([
    ["checkout-tier-product", 20],
    ["checkout-idempotent-product", 10],
    ["checkout-race-product", 1],
    ["checkout-a-rollback-stocked", 2],
    ["checkout-z-rollback-empty", 0],
    ["checkout-inactive-product", 10],
  ]);

  for (const [index, slug] of fixtureSlugs.entries()) {
    const product = await migrationPool.query<{ id: string }>(
      `INSERT INTO public.products (
         category_id, sku, slug, name_ar, name_fr, description_ar,
         description_fr, price, stock_quantity, is_active
       ) VALUES ($1, $2, $3, $4, $5, 'وصف اختبار',
         'Description de vérification', 25000, $6, $7)
       RETURNING id`,
      [
        categoryId,
        `CHECKOUT-TEST-${index + 1}`,
        slug,
        `منتج اختبار ${index + 1}`,
        `Produit de vérification ${index + 1}`,
        stocks.get(slug),
        slug !== "checkout-inactive-product",
      ],
    );

    if (slug === "checkout-tier-product") {
      await migrationPool.query(
        `INSERT INTO public.product_price_tiers
           (product_id, min_quantity, unit_price)
         SELECT $1, threshold, 25000 - (threshold * 100)
         FROM generate_series(2, 30) AS threshold`,
        [product.rows[0]?.id],
      );
    }
  }
}

function expectInsufficientPrivilege(error: unknown): boolean {
  assert.equal((error as DatabaseError | undefined)?.code, "42501");
  return true;
}

async function verifyCheckoutRole(): Promise<void> {
  const role = await checkoutPool.query(`
    SELECT
      current_user AS role_name,
      pg_has_role(current_user, 'edebou_checkout_writer', 'MEMBER') AS checkout_member,
      rolsuper,
      rolcreatedb,
      rolcreaterole,
      rolreplication,
      rolbypassrls
    FROM pg_catalog.pg_roles
    WHERE rolname = current_user
  `);
  assert.equal(role.rowCount, 1);
  assert.equal(role.rows[0].checkout_member, true);
  for (const attribute of [
    "rolsuper",
    "rolcreatedb",
    "rolcreaterole",
    "rolreplication",
    "rolbypassrls",
  ]) {
    assert.equal(role.rows[0][attribute], false);
  }

  const memberships = await checkoutPool.query(`
    SELECT granted_role.rolname AS role_name
    FROM pg_catalog.pg_auth_members AS membership
    JOIN pg_catalog.pg_roles AS granted_role
      ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE member_role.rolname = current_user
    ORDER BY granted_role.rolname
  `);
  assert.deepEqual(memberships.rows, [
    { role_name: "edebou_checkout_writer" },
  ]);

  const privileges = await checkoutPool.query(`
    SELECT
      has_table_privilege(current_user, 'public.products', 'SELECT') AS products_select,
      has_column_privilege(current_user, 'public.products', 'description_fr', 'SELECT') AS product_description_select,
      has_column_privilege(current_user, 'public.products', 'stock_quantity', 'UPDATE') AS stock_update,
      has_column_privilege(current_user, 'public.products', 'price', 'UPDATE') AS price_update,
      has_table_privilege(current_user, 'public.categories', 'UPDATE') AS categories_update,
      has_table_privilege(current_user, 'public.store_settings', 'UPDATE') AS settings_update,
      has_column_privilege(current_user, 'public.orders', 'customer_name', 'INSERT') AS order_customer_insert,
      has_column_privilege(current_user, 'public.orders', 'status', 'INSERT') AS order_status_insert,
      has_column_privilege(current_user, 'public.orders', 'created_at', 'INSERT') AS order_created_at_insert,
      has_column_privilege(current_user, 'public.orders', 'updated_at', 'INSERT') AS order_updated_at_insert,
      has_column_privilege(current_user, 'public.orders', 'stock_restored_at', 'INSERT') AS order_restoration_insert,
      has_column_privilege(current_user, 'public.orders', 'id', 'SELECT') AS order_id_select,
      has_column_privilege(current_user, 'public.orders', 'phone', 'SELECT') AS order_phone_select,
      has_column_privilege(current_user, 'public.order_items', 'quantity', 'INSERT') AS item_quantity_insert,
      has_column_privilege(current_user, 'public.checkout_rate_limits', 'request_count', 'UPDATE') AS limiter_count_update,
      has_column_privilege(current_user, 'public.checkout_rate_limits', 'key_hash', 'UPDATE') AS limiter_key_update,
      has_table_privilege(current_user, 'public.orders', 'DELETE') AS orders_delete,
      has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') AS migrations_select
  `);
  assert.deepEqual(privileges.rows[0], {
    products_select: false,
    product_description_select: false,
    stock_update: true,
    price_update: false,
    categories_update: false,
    settings_update: false,
    order_customer_insert: true,
    order_status_insert: false,
    order_created_at_insert: false,
    order_updated_at_insert: false,
    order_restoration_insert: false,
    order_id_select: true,
    order_phone_select: false,
    item_quantity_insert: true,
    limiter_count_update: true,
    limiter_key_update: false,
    orders_delete: false,
    migrations_select: false,
  });

  await assert.rejects(
    checkoutPool.query(`UPDATE public.products SET price = price WHERE false`),
    expectInsufficientPrivilege,
  );
  await assert.rejects(
    checkoutPool.query(
      `UPDATE public.store_settings SET delivery_fee = delivery_fee WHERE false`,
    ),
    expectInsufficientPrivilege,
  );
  await assert.rejects(
    checkoutPool.query(`SELECT phone FROM public.orders LIMIT 1`),
    expectInsufficientPrivilege,
  );
}

async function verifyTierPricing(): Promise<void> {
  const confirmation = await prismaCheckoutRepository.createOrder(
    makeRequest(
      [{ productSlug: "checkout-tier-product", quantity: 5 }],
      "tier",
    ),
  );
  const settings = await prismaCheckoutRepository.getSettings();

  // There are 29 relevant tiers. This proves the applicable low threshold is
  // not dropped when more than 25 higher thresholds exist.
  assert.equal(confirmation.subtotal, BigInt(122_500));
  assert.equal(confirmation.deliveryFee, settings.deliveryFee);
  assert.equal(
    confirmation.total,
    BigInt(122_500) + settings.deliveryFee,
  );

  const stored = await migrationPool.query(`
    SELECT item.unit_price, item.line_total, item.quantity,
           item.product_name_snapshot, item.sku_snapshot
    FROM public.order_items AS item
    JOIN public.orders AS orders ON orders.id = item.order_id
    WHERE orders.idempotency_key_hash = $1
  `, [digest("key:tier")]);
  assert.equal(stored.rowCount, 1);
  assert.equal(stored.rows[0].unit_price, "24500");
  assert.equal(stored.rows[0].line_total, "122500");
  assert.equal(stored.rows[0].quantity, 5);
  assert.equal(stored.rows[0].sku_snapshot, "CHECKOUT-TEST-1");
  assert.match(stored.rows[0].product_name_snapshot, /^Produit/u);
}

async function verifyConcurrentIdempotence(): Promise<void> {
  const input = makeRequest(
    [{ productSlug: "checkout-idempotent-product", quantity: 2 }],
    "same-request",
  );
  const [first, second] = await Promise.all([
    prismaCheckoutRepository.createOrder(input),
    prismaCheckoutRepository.createOrder(input),
  ]);

  assert.equal(first.orderNumber, second.orderNumber);
  assert.equal(first.total, second.total);

  const stored = await migrationPool.query(`
    SELECT
      (SELECT count(*) FROM public.orders WHERE idempotency_key_hash = $1) AS order_count,
      (SELECT stock_quantity FROM public.products WHERE slug = $2) AS stock
  `, [input.idempotencyKeyHash, "checkout-idempotent-product"]);
  assert.equal(Number(stored.rows[0].order_count), 1);
  assert.equal(stored.rows[0].stock, 8);

  await assert.rejects(
    prismaCheckoutRepository.createOrder({
      ...input,
      requestHash: digest("request:different-payload"),
    }),
    (error: unknown) =>
      (error as { readonly code?: string }).code === "IDEMPOTENCY_CONFLICT",
  );
}

async function verifyConcurrentIdempotencyConflict(): Promise<void> {
  const sharedKeyHash = digest("key:concurrent-different-payloads");
  const first = {
    ...makeRequest(
      [{ productSlug: "checkout-tier-product", quantity: 1 }],
      "concurrent-payload-a",
    ),
    idempotencyKeyHash: sharedKeyHash,
  };
  const second = {
    ...makeRequest(
      [{ productSlug: "checkout-idempotent-product", quantity: 1 }],
      "concurrent-payload-b",
    ),
    idempotencyKeyHash: sharedKeyHash,
  };

  const results = await Promise.allSettled([
    prismaCheckoutRepository.createOrder(first),
    prismaCheckoutRepository.createOrder(second),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.equal(rejected.reason?.code, "IDEMPOTENCY_CONFLICT");

  const stored = await migrationPool.query(
    `SELECT count(*) FROM public.orders WHERE idempotency_key_hash = $1`,
    [sharedKeyHash],
  );
  assert.equal(Number(stored.rows[0].count), 1);
}

async function verifyStockRace(): Promise<void> {
  const results = await Promise.allSettled([
    prismaCheckoutRepository.createOrder(
      makeRequest([{ productSlug: "checkout-race-product", quantity: 1 }], "race-a"),
    ),
    prismaCheckoutRepository.createOrder(
      makeRequest([{ productSlug: "checkout-race-product", quantity: 1 }], "race-b"),
    ),
  ]);

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof OrderUnavailableError);

  const stored = await migrationPool.query(`
    SELECT
      (SELECT stock_quantity FROM public.products WHERE slug = $1) AS stock,
      (SELECT count(*) FROM public.orders
        WHERE idempotency_key_hash = ANY($2::text[])) AS order_count
  `, ["checkout-race-product", [digest("key:race-a"), digest("key:race-b")]]);
  assert.equal(stored.rows[0].stock, 0);
  assert.equal(Number(stored.rows[0].order_count), 1);
}

async function verifyRollbackAndInactiveProducts(): Promise<void> {
  const rollbackInput = makeRequest(
    [
      { productSlug: "checkout-a-rollback-stocked", quantity: 1 },
      { productSlug: "checkout-z-rollback-empty", quantity: 1 },
    ],
    "rollback",
  );

  await assert.rejects(
    prismaCheckoutRepository.createOrder(rollbackInput),
    OrderUnavailableError,
  );

  const rollbackState = await migrationPool.query(`
    SELECT
      (SELECT stock_quantity FROM public.products WHERE slug = $1) AS stock,
      (SELECT count(*) FROM public.orders WHERE idempotency_key_hash = $2) AS order_count
  `, ["checkout-a-rollback-stocked", rollbackInput.idempotencyKeyHash]);
  assert.equal(rollbackState.rows[0].stock, 2);
  assert.equal(Number(rollbackState.rows[0].order_count), 0);

  await assert.rejects(
    prismaCheckoutRepository.createOrder(
      makeRequest(
        [{ productSlug: "checkout-inactive-product", quantity: 1 }],
        "inactive",
      ),
    ),
    OrderUnavailableError,
  );
}

async function verifyPersistentRateLimit(): Promise<void> {
  const keyHash = digest("rate-limit");
  const results = [];

  const limit = ORDER_RATE_LIMIT_MAX_ATTEMPTS;
  for (let attempt = 0; attempt <= limit; attempt += 1) {
    results.push(await prismaCheckoutRepository.consumeRateLimit(keyHash));
  }

  assert.equal(results.slice(0, limit).every((result) => result.allowed), true);
  assert.equal(results[limit]?.allowed, false);
  assert.ok((results[limit]?.retryAfterSeconds ?? 0) > 0);

  await migrationPool.query(
    `UPDATE public.checkout_rate_limits
     SET request_count = 999999
     WHERE key_hash = $1`,
    [keyHash],
  );
  assert.equal(
    (await prismaCheckoutRepository.consumeRateLimit(keyHash)).allowed,
    false,
  );
  assert.equal(
    (await prismaCheckoutRepository.consumeRateLimit(keyHash)).allowed,
    false,
  );
  const saturated = await migrationPool.query(
    `SELECT request_count FROM public.checkout_rate_limits WHERE key_hash = $1`,
    [keyHash],
  );
  assert.equal(saturated.rows[0]?.request_count, 1_000_000);
}

try {
  await cleanFixtures();
  await createFixtures();
  await verifyCheckoutRole();
  await verifyTierPricing();
  await verifyConcurrentIdempotence();
  await verifyConcurrentIdempotencyConflict();
  await verifyStockRace();
  await verifyRollbackAndInactiveProducts();
  await verifyPersistentRateLimit();
} finally {
  await disconnectCheckoutPrismaClient();
  await cleanFixtures();
  await Promise.all([migrationPool.end(), checkoutPool.end()]);
}

console.log(
  "Checkout database verification passed: least privilege, server pricing, idempotence, rollback, stock concurrency, and persistent rate limiting.",
);
