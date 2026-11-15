import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

import { config as loadEnvironment } from "dotenv";
import { Pool } from "pg";

import { getCheckoutDatabaseTestUrls } from "./checkout-database-test-guard";

loadEnvironment({
  path: process.env.DATABASE_ENV_FILE ?? ".env.database",
  override: false,
  quiet: true,
});
loadEnvironment({ path: ".env.local", override: false, quiet: true });

const expectUnavailable = process.argv.includes("--expect-unavailable");
const baseUrl = new URL(
  process.env.CHECKOUT_API_BASE_URL ?? "http://127.0.0.1:3000",
);
const requestOrigin = new URL(
  process.env.CHECKOUT_API_ORIGIN ?? baseUrl.origin,
);

if (
  baseUrl.protocol !== "http:" ||
  !["127.0.0.1", "[::1]", "localhost"].includes(baseUrl.hostname) ||
  baseUrl.pathname !== "/" ||
  baseUrl.search ||
  baseUrl.hash
) {
  throw new Error("Checkout API verification is restricted to a local HTTP server.");
}

if (
  requestOrigin.username ||
  requestOrigin.password ||
  requestOrigin.pathname !== "/" ||
  requestOrigin.search ||
  requestOrigin.hash ||
  !(
    requestOrigin.origin === baseUrl.origin ||
    (requestOrigin.protocol === "https:" &&
      requestOrigin.hostname.endsWith(".test"))
  )
) {
  throw new Error(
    "CHECKOUT_API_ORIGIN must be the local server origin or an HTTPS .test origin.",
  );
}

const endpoint = new URL("/api/orders", baseUrl);
const csrfHeader = "X-EDebou-CSRF";
const fixtureCustomerName = "EDebou Checkout API Verification";
const fixtureCategorySlug = "checkout-api-verification";
const fixtureProductSlug = "checkout-api-product";

const validBody = {
  idempotencyKey: randomUUID(),
  locale: "fr",
  customer: {
    fullName: fixtureCustomerName,
    phone: "+21620123456",
    governorate: "tunis",
    address: "12 rue de la Vérification API, Tunis",
    notes: "Données fictives de test HTTP",
  },
  items: [{ productSlug: fixtureProductSlug, quantity: 2 }],
};

function requestHeaders(overrides: Record<string, string> = {}): Headers {
  return new Headers({
    Origin: requestOrigin.origin,
    "Content-Type": "application/json",
    "Sec-Fetch-Site": "same-origin",
    "X-Forwarded-For": "127.0.0.1",
    [csrfHeader]: "1",
    ...overrides,
  });
}

async function post(
  body: unknown,
  headers = requestHeaders(),
): Promise<Response> {
  return fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "error",
  });
}

async function assertError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
  const body = (await response.json()) as {
    readonly error?: { readonly code?: string };
    readonly data?: unknown;
  };
  assert.equal(body.error?.code, code);
  assert.equal(body.data, undefined);
  assert.equal(JSON.stringify(body).includes(fixtureCustomerName), false);
}

async function verifyUnavailableMode(): Promise<void> {
  // If this safety smoke is accidentally pointed at a healthy database, the
  // randomized nonexistent slug can only yield ORDER_UNAVAILABLE, never create
  // an order or decrement stock.
  const response = await post({
    ...validBody,
    items: [
      {
        productSlug: `checkout-unavailable-${randomUUID().replaceAll("-", "")}`,
        quantity: 1,
      },
    ],
  });
  await assertError(response, 503, "SERVICE_UNAVAILABLE");
  console.log(
    "Checkout API unavailable-mode verification passed: HTTP 503, no-store, and no false confirmation.",
  );
}

function hmacClientToken(token: string, pepper: string): string {
  return createHmac("sha256", pepper)
    .update("edebou:client-ip:v1\0", "utf8")
    .update(token, "utf8")
    .digest("hex");
}

async function verifyLiveMode(): Promise<void> {
  const urls = getCheckoutDatabaseTestUrls();
  const migrationPool = new Pool({
    connectionString: urls.migrationUrl,
    max: 2,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    application_name: "edebou-checkout-api-verification",
  });

  async function cleanFixtures(): Promise<void> {
    await migrationPool.query(
      `DELETE FROM public.orders WHERE customer_name = $1`,
      [fixtureCustomerName],
    );
    await migrationPool.query(
      `DELETE FROM public.product_price_tiers
       WHERE product_id IN (
         SELECT id FROM public.products WHERE slug = $1
       )`,
      [fixtureProductSlug],
    );
    await migrationPool.query(`DELETE FROM public.products WHERE slug = $1`, [
      fixtureProductSlug,
    ]);
    await migrationPool.query(`DELETE FROM public.categories WHERE slug = $1`, [
      fixtureCategorySlug,
    ]);

    const pepper = process.env.CHECKOUT_IP_HASH_PEPPER;
    if (pepper && pepper.length >= 32) {
      await migrationPool.query(
        `DELETE FROM public.checkout_rate_limits WHERE key_hash = ANY($1::text[])`,
        [
          [
            hmacClientToken("unattributed-direct-client", pepper),
            hmacClientToken("127.0.0.1", pepper),
          ],
        ],
      );
    }
  }

  try {
    await cleanFixtures();
    const category = await migrationPool.query<{ id: string }>(
      `INSERT INTO public.categories (slug, name_ar, name_fr, is_active)
       VALUES ($1, 'اختبار واجهة الدفع', 'Vérification API checkout', true)
       RETURNING id`,
      [fixtureCategorySlug],
    );
    const categoryId = category.rows[0]?.id;
    assert.ok(categoryId);

    const product = await migrationPool.query<{ id: string }>(
      `INSERT INTO public.products (
         category_id, sku, slug, name_ar, name_fr, description_ar,
         description_fr, price, stock_quantity, is_active
       ) VALUES (
         $1, 'CHECKOUT-API-TEST-1', $2, 'منتج اختبار الواجهة',
         'Produit de vérification API', 'وصف اختبار',
         'Description de vérification', 25000, 20, true
       ) RETURNING id`,
      [categoryId, fixtureProductSlug],
    );
    await migrationPool.query(
      `INSERT INTO public.product_price_tiers
         (product_id, min_quantity, unit_price)
       VALUES ($1, 2, 23000)`,
      [product.rows[0]?.id],
    );

    const settings = await migrationPool.query<{ delivery_fee: string }>(
      `SELECT delivery_fee FROM public.store_settings WHERE id = 1`,
    );
    const deliveryFee = Number(settings.rows[0]?.delivery_fee);
    assert.ok(Number.isSafeInteger(deliveryFee));

    const getResponse = await fetch(endpoint, { method: "GET" });
    assert.equal(getResponse.status, 405);

    const crossSiteHeaders = requestHeaders({
      Origin: "https://cross-site.invalid",
      "Sec-Fetch-Site": "cross-site",
    });
    await assertError(await post(validBody, crossSiteHeaders), 403, "FORBIDDEN_REQUEST");

    const missingCsrfHeaders = requestHeaders();
    missingCsrfHeaders.delete(csrfHeader);
    await assertError(await post(validBody, missingCsrfHeaders), 403, "FORBIDDEN_REQUEST");

    await assertError(
      await post({ ...validBody, totalMillimes: 1 }),
      400,
      "INVALID_REQUEST",
    );
    await assertError(
      await post({ ...validBody, deliveryFeeMillimes: 0 }),
      400,
      "INVALID_REQUEST",
    );
    await assertError(
      await post({
        ...validBody,
        customer: { ...validBody.customer, phone: "+21660123456" },
      }),
      400,
      "INVALID_REQUEST",
    );

    const success = await post(validBody);
    assert.equal(success.status, 201);
    assert.match(success.headers.get("cache-control") ?? "", /no-store/u);
    const successBody = (await success.json()) as {
      readonly data: Record<string, unknown>;
    };
    assert.deepEqual(Object.keys(successBody.data).sort(), [
      "currency",
      "deliveryFeeMillimes",
      "orderNumber",
      "status",
      "subtotalMillimes",
      "totalMillimes",
    ]);
    assert.equal(successBody.data.subtotalMillimes, 46_000);
    assert.equal(successBody.data.deliveryFeeMillimes, deliveryFee);
    assert.equal(successBody.data.totalMillimes, 46_000 + deliveryFee);
    assert.equal(successBody.data.currency, "TND");
    assert.equal(successBody.data.status, "PENDING");
    const serializedSuccess = JSON.stringify(successBody);
    for (const privateValue of [
      fixtureCustomerName,
      validBody.customer.phone,
      validBody.customer.address,
      validBody.idempotencyKey,
    ]) {
      assert.equal(serializedSuccess.includes(privateValue), false);
    }

    const replay = await post(validBody);
    assert.equal(replay.status, 200);
    assert.match(replay.headers.get("cache-control") ?? "", /no-store/u);
    assert.deepEqual((await replay.json()).data, successBody.data);

    await assertError(
      await post({
        ...validBody,
        items: [{ productSlug: fixtureProductSlug, quantity: 1 }],
      }),
      409,
      "IDEMPOTENCY_CONFLICT",
    );

    const stored = await migrationPool.query(`
      SELECT
        (SELECT count(*) FROM public.orders WHERE customer_name = $1) AS order_count,
        (SELECT stock_quantity FROM public.products WHERE slug = $2) AS stock
    `, [fixtureCustomerName, fixtureProductSlug]);
    assert.equal(Number(stored.rows[0].order_count), 1);
    assert.equal(stored.rows[0].stock, 18);
  } finally {
    await cleanFixtures();
    await migrationPool.end();
  }

  console.log(
    "Checkout API verification passed: method boundary, CSRF/origin, strict validation, tampering rejection, minimal no-store confirmation, replay, and idempotency conflict without a second stock decrement.",
  );
}

if (expectUnavailable) {
  await verifyUnavailableMode();
} else {
  await verifyLiveMode();
}
