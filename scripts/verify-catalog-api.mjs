import assert from "node:assert/strict";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:3000");

async function request(pathname, init) {
  return fetch(new URL(pathname, baseUrl), {
    redirect: "manual",
    ...init,
  });
}

async function readJson(response) {
  const text = await response.text();
  assert.ok(
    Buffer.byteLength(text) <= 256 * 1024,
    "A catalog response exceeded the verification size limit",
  );
  assert.doesNotMatch(
    text,
    /DATABASE_URL|MIGRATION_DATABASE_URL|postgres(?:ql)?:\/\/|PrismaClient|node_modules|\bat\s+\S+\.tsx?:\d+/i,
  );
  return JSON.parse(text);
}

function assertPublicResponseHeaders(response, cacheKind) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(response.headers.get("x-request-id"));

  const cacheControl = response.headers.get("cache-control") ?? "";
  if (cacheKind === "public") {
    assert.match(cacheControl, /s-maxage=60/);
  } else {
    assert.equal(cacheControl, "private, no-store");
  }
}

function assertNoPersistenceFields(value) {
  const serialized = JSON.stringify(value);

  for (const field of [
    '"id"',
    '"categoryId"',
    '"productId"',
    '"isActive"',
    '"createdAt"',
    '"updatedAt"',
    '"stockQuantity"',
  ]) {
    assert.equal(serialized.includes(field), false, `${field} leaked in a DTO`);
  }
}

async function expectInvalidRequest(pathname) {
  const response = await request(pathname);
  assert.equal(response.status, 400, `${pathname} must be rejected`);
  assertPublicResponseHeaders(response, "private");
  const body = await readJson(response);
  assert.equal(body.error?.code, "INVALID_REQUEST");
  assert.equal(typeof body.error?.requestId, "string");
}

const categoriesResponse = await request("/api/categories");
assert.equal(categoriesResponse.status, 200);
assertPublicResponseHeaders(categoriesResponse, "public");
const categoriesBody = await readJson(categoriesResponse);
assert.ok(Array.isArray(categoriesBody.data));
assert.ok(categoriesBody.data.length > 0);
for (const category of categoriesBody.data) {
  assert.equal(typeof category.slug, "string");
  assert.equal(typeof category.name?.ar, "string");
  assert.equal(typeof category.name?.fr, "string");
}
assertNoPersistenceFields(categoriesBody.data);

const productsResponse = await request("/api/products?page=1&pageSize=2");
assert.equal(productsResponse.status, 200);
assertPublicResponseHeaders(productsResponse, "public");
const productsBody = await readJson(productsResponse);
assert.ok(Array.isArray(productsBody.data?.items));
assert.ok(productsBody.data.items.length > 0);
assert.ok(productsBody.data.items.length <= 2);
assert.deepEqual(
  {
    page: productsBody.data.pagination?.page,
    pageSize: productsBody.data.pagination?.pageSize,
  },
  { page: 1, pageSize: 2 },
);
assertNoPersistenceFields(productsBody.data.items);

const allProductsResponse = await request("/api/products?pageSize=24");
assert.equal(allProductsResponse.status, 200);
const allProductsBody = await readJson(allProductsResponse);
assert.ok(
  allProductsBody.data.items.some(
    (product) => product.slug === "wireless-earbuds",
  ),
);
assert.equal(
  allProductsBody.data.items.some(
    (product) => product.slug === "archived-power-bank",
  ),
  false,
);

const categoryResponse = await request(
  "/api/products?category=electronics&pageSize=24",
);
assert.equal(categoryResponse.status, 200);
const categoryBody = await readJson(categoryResponse);
assert.ok(categoryBody.data.items.length > 0);
for (const product of categoryBody.data.items) {
  assert.equal(product.category.slug, "electronics");
}

const searchResponse = await request("/api/products?search=sans");
assert.equal(searchResponse.status, 200);
const searchBody = await readJson(searchResponse);
assert.ok(
  searchBody.data.items.some((product) => product.slug === "wireless-earbuds"),
);

for (const [sort, direction] of [
  ["price-asc", 1],
  ["price-desc", -1],
]) {
  const sortedResponse = await request(
    `/api/products?pageSize=24&sort=${sort}`,
  );
  assert.equal(sortedResponse.status, 200);
  const sortedBody = await readJson(sortedResponse);
  const prices = sortedBody.data.items.map((product) => product.priceMillimes);

  for (let index = 1; index < prices.length; index += 1) {
    assert.ok(
      direction * (prices[index] - prices[index - 1]) >= 0,
      `${sort} must return a deterministic price ordering`,
    );
  }
}

const injectionSearchResponse = await request(
  `/api/products?search=${encodeURIComponent("' OR 1=1 --")}`,
);
assert.equal(injectionSearchResponse.status, 200);
const injectionSearchBody = await readJson(injectionSearchResponse);
assert.deepEqual(
  injectionSearchBody.data.items,
  [],
  "SQL-like search text must be treated as literal catalog data",
);

for (const wildcardProbe of ["%%", "__", "\\\\"]) {
  const wildcardResponse = await request(
    `/api/products?search=${encodeURIComponent(wildcardProbe)}`,
  );
  assert.equal(wildcardResponse.status, 200);
  const wildcardBody = await readJson(wildcardResponse);
  assert.deepEqual(
    wildcardBody.data.items,
    [],
    `LIKE metacharacters must be searched literally: ${wildcardProbe}`,
  );
}

for (const invalidPath of [
  "/api/products?page=0",
  "/api/products?page=1001",
  "/api/products?pageSize=25",
  "/api/products?search=a",
  `/api/products?search=${"a".repeat(81)}`,
  "/api/products?category=../orders",
  "/api/products?unknown=value",
  "/api/products?page=1&page=2",
  "/api/products?sort=oldest",
  "/api/categories?unknown=value",
  "/api/categories?unknown=1&unknown=2",
  "/api/products/wireless-earbuds?unknown=value",
]) {
  await expectInvalidRequest(invalidPath);
}

const detailResponse = await request("/api/products/wireless-earbuds");
assert.equal(detailResponse.status, 200);
assertPublicResponseHeaders(detailResponse, "public");
const detailBody = await readJson(detailResponse);
assert.equal(detailBody.data.slug, "wireless-earbuds");
assert.equal(detailBody.data.currency, "TND");
assert.equal(Number.isInteger(detailBody.data.priceMillimes), true);
assert.ok(Array.isArray(detailBody.data.images));
assert.ok(Array.isArray(detailBody.data.priceTiers));
assertNoPersistenceFields(detailBody.data);

for (const pathname of [
  "/products/wireless-earbuds",
  "/fr/products/wireless-earbuds",
]) {
  const pageResponse = await request(pathname);
  assert.equal(pageResponse.status, 200, `${pathname} must render successfully`);
  const pageBody = await pageResponse.text();
  assert.doesNotMatch(pageBody, /This page couldn.t load|A server error occurred/i);
}

const inactiveResponse = await request("/api/products/archived-power-bank");
assert.equal(inactiveResponse.status, 404);
assertPublicResponseHeaders(inactiveResponse, "private");
assert.equal((await readJson(inactiveResponse)).error?.code, "RESOURCE_NOT_FOUND");

await expectInvalidRequest(
  `/api/products/${encodeURIComponent("' OR 1=1 --")}`,
);

for (const endpoint of [
  "/api/products",
  "/api/products/wireless-earbuds",
  "/api/categories",
]) {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await request(endpoint, { method });
    assert.equal(response.status, 405, `${method} ${endpoint} must be disabled`);
  }
}

const ordersReadResponse = await request("/api/orders");
assert.equal(
  ordersReadResponse.status,
  405,
  "GET /api/orders must remain disabled even though POST is available",
);

for (const unavailablePath of [
  "/api/admin",
  "/api/admin/products",
  "/api/orders/EDB-1",
]) {
  const response = await request(unavailablePath);
  assert.equal(response.status, 404, `${unavailablePath} must not exist`);
}

console.log(
  `Catalog API verification passed for ${baseUrl.origin}: read-only DTOs, active filters, bounds, and injection probes.`,
);
