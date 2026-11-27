import assert from "node:assert/strict";
import test from "node:test";

import {
  CheckoutRateLimitedError,
  ForbiddenCheckoutRequestError,
  InvalidCheckoutRequestError,
} from "../src/lib/checkout/errors";
import {
  parseAllowedCheckoutOrigins,
  parseTrustedProxyHops,
} from "../src/lib/checkout/config";
import {
  assertCheckoutRequestSecurity,
  CHECKOUT_CSRF_HEADER,
  CHECKOUT_CSRF_VALUE,
  hmacCheckoutValue,
  MAX_CHECKOUT_BODY_BYTES,
  readBoundedCheckoutJson,
  resolveCheckoutClientToken,
} from "../src/lib/checkout/request-security";
import { checkoutErrorResponse } from "../src/lib/http/checkout-api";
import {
  canonicalizeOrderRequest,
  MAX_ORDER_LINES,
  MAX_ORDER_QUANTITY_PER_LINE,
  normalizeTunisianPhone,
  parseOrderRequest,
} from "../src/lib/validators/order";

const validBody = {
  idempotencyKey: "d9428888-122b-4e9f-b72b-3fce4d66a54b",
  locale: "fr",
  customer: {
    fullName: "  Amel Ben Salah  ",
    phone: "+216 20 123 456",
    governorate: "tunis",
    address: "  12 rue de la Liberté, Tunis  ",
    notes: "  Appeler avant livraison  ",
  },
  items: [
    { productSlug: "wireless-earbuds", quantity: 5 },
    { productSlug: "cotton-tshirt", quantity: 1 },
  ],
};

function secureRequest(
  body: BodyInit = JSON.stringify(validBody),
  headers: Record<string, string> = {},
): Request {
  return new Request("https://shop.edebou.tn/api/orders", {
    method: "POST",
    headers: {
      Origin: "https://shop.edebou.tn",
      "Content-Type": "application/json",
      [CHECKOUT_CSRF_HEADER]: CHECKOUT_CSRF_VALUE,
      ...headers,
    },
    body,
  });
}

test("order validation normalizes Tunisia delivery data and stays strict", () => {
  const parsed = parseOrderRequest(validBody);

  assert.equal(parsed.customer.fullName, "Amel Ben Salah");
  assert.equal(parsed.customer.phone, "+21620123456");
  assert.equal(parsed.customer.address, "12 rue de la Liberté, Tunis");
  assert.equal(parsed.customer.notes, "Appeler avant livraison");
  assert.equal(normalizeTunisianPhone("20 123 456"), "+21620123456");
  assert.equal(normalizeTunisianPhone("00216-20-123-456"), "+21620123456");

  for (const invalidPhone of [
    "12345678",
    "+21680123456",
    "+33123456789",
    "2012345",
  ]) {
    assert.throws(
      () =>
        parseOrderRequest({
          ...validBody,
          customer: { ...validBody.customer, phone: invalidPhone },
        }),
      InvalidCheckoutRequestError,
    );
  }

  assert.throws(
    () => parseOrderRequest({ ...validBody, total: 1 }),
    InvalidCheckoutRequestError,
  );
  assert.throws(
    () =>
      parseOrderRequest({
        ...validBody,
        customer: { ...validBody.customer, extra: "mass assignment" },
      }),
    InvalidCheckoutRequestError,
  );
});

test("order item bounds reject duplicates, fractions and excessive carts", () => {
  assert.equal(MAX_ORDER_LINES, 20);
  assert.equal(MAX_ORDER_QUANTITY_PER_LINE, 100);

  for (const items of [
    [],
    [{ productSlug: "wireless-earbuds", quantity: 0 }],
    [{ productSlug: "wireless-earbuds", quantity: -1 }],
    [{ productSlug: "wireless-earbuds", quantity: 1.5 }],
    [{ productSlug: "wireless-earbuds", quantity: 101 }],
    [
      { productSlug: "wireless-earbuds", quantity: 1 },
      { productSlug: "wireless-earbuds", quantity: 2 },
    ],
    Array.from({ length: 21 }, (_, index) => ({
      productSlug: `product-${index}`,
      quantity: 1,
    })),
  ]) {
    assert.throws(
      () => parseOrderRequest({ ...validBody, items }),
      InvalidCheckoutRequestError,
    );
  }
});

test("canonical request hashes are stable across line order and cover locale", () => {
  const first = parseOrderRequest(validBody);
  const reversed = parseOrderRequest({
    ...validBody,
    items: [...validBody.items].reverse(),
  });
  const arabic = parseOrderRequest({ ...validBody, locale: "ar" });

  assert.equal(
    canonicalizeOrderRequest(first),
    canonicalizeOrderRequest(reversed),
  );
  assert.notEqual(
    canonicalizeOrderRequest(first),
    canonicalizeOrderRequest(arabic),
  );
  assert.equal(
    hmacCheckoutValue("request", canonicalizeOrderRequest(first), "x".repeat(32)),
    hmacCheckoutValue("request", canonicalizeOrderRequest(reversed), "x".repeat(32)),
  );
});

test("checkout origin, Fetch Metadata, CSRF and JSON checks fail closed", () => {
  const options = {
    allowedOrigins: new Set(["https://shop.edebou.tn"]),
    trustedProxyHops: 0,
  };

  assert.doesNotThrow(() =>
    assertCheckoutRequestSecurity(
      secureRequest(undefined, { "Sec-Fetch-Site": "same-origin" }),
      options,
    ),
  );

  const invalidHeaderSets: Array<Record<string, string>> = [
    { Origin: "https://evil.example" },
    { Origin: "https://shop.edebou.tn, https://evil.example" },
    { Origin: "" },
    { "Sec-Fetch-Site": "cross-site" },
    { [CHECKOUT_CSRF_HEADER]: "wrong" },
    { "Content-Type": "text/plain" },
  ];

  for (const headers of invalidHeaderSets) {
    assert.throws(
      () => assertCheckoutRequestSecurity(secureRequest(undefined, headers), options),
      (error) =>
        error instanceof ForbiddenCheckoutRequestError ||
        error instanceof InvalidCheckoutRequestError,
    );
  }
});

test("bounded reader accepts valid JSON and rejects oversized or deep bodies", async () => {
  assert.deepEqual(await readBoundedCheckoutJson(secureRequest()), validBody);

  await assert.rejects(
    () =>
      readBoundedCheckoutJson(
        secureRequest(JSON.stringify({ value: "x".repeat(MAX_CHECKOUT_BODY_BYTES) })),
      ),
    InvalidCheckoutRequestError,
  );

  await assert.rejects(
    () =>
      readBoundedCheckoutJson(
        secureRequest(JSON.stringify({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } })),
      ),
    InvalidCheckoutRequestError,
  );
});

test("trusted proxy extraction works from the right and ignores spoofed XFF directly", () => {
  const direct = secureRequest(undefined, {
    "X-Forwarded-For": "203.0.113.10",
  });
  assert.equal(resolveCheckoutClientToken(direct, 0), "unattributed-direct-client");

  const proxied = secureRequest(undefined, {
    "X-Forwarded-For": "198.51.100.20, 203.0.113.10",
  });
  assert.equal(resolveCheckoutClientToken(proxied, 1), "203.0.113.10");
  assert.equal(resolveCheckoutClientToken(proxied, 2), "198.51.100.20");

  assert.throws(
    () => resolveCheckoutClientToken(secureRequest(), 1),
    ForbiddenCheckoutRequestError,
  );
  assert.throws(
    () =>
      resolveCheckoutClientToken(
        secureRequest(undefined, { "X-Forwarded-For": "not-an-ip" }),
        1,
      ),
    ForbiddenCheckoutRequestError,
  );
});

test("checkout environment parsers enforce exact HTTPS origins and proxy trust", () => {
  assert.deepEqual(
    [...parseAllowedCheckoutOrigins("https://shop.edebou.tn", true)],
    ["https://shop.edebou.tn"],
  );
  assert.deepEqual(
    [...parseAllowedCheckoutOrigins("http://localhost:3000", false)],
    ["http://localhost:3000"],
  );

  for (const origin of [
    "http://shop.edebou.tn",
    "https://shop.edebou.tn/path",
    "https://user@shop.edebou.tn",
  ]) {
    assert.throws(() => parseAllowedCheckoutOrigins(origin, true));
  }

  assert.equal(parseTrustedProxyHops("0", false), 0);
  assert.equal(parseTrustedProxyHops("2", true), 2);
  assert.throws(() => parseTrustedProxyHops("0", true));
  assert.throws(() => parseTrustedProxyHops("6", false));
});

test("rate-limit responses are private, generic and include Retry-After", async () => {
  const response = checkoutErrorResponse(new CheckoutRateLimitedError(27.2));
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "28");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(body.error.code, "RATE_LIMITED");
  assert.equal(JSON.stringify(body).includes("phone"), false);
});

test("order numbers are short, dictatable and use the Tunis date", async () => {
  const { createOrderNumber } = await import("../src/lib/repositories/prisma-checkout-repository");
  // 23:30 UTC on 25 Nov is already 26 Nov in Tunis.
  const number = createOrderNumber(new Date("2026-11-25T23:30:00Z"));
  assert.match(number, /^EDB-261126-\d{4}$/u);
});

test("Meta Conversions API Purchase matches the Pixel event and carries no customer data", async () => {
  const { buildPurchaseEvent } = await import("../src/lib/meta-conversions");
  const event = buildPurchaseEvent(
    {
      orderNumber: "EDB-261127-0310",
      totalMillimes: 127_800,
      items: [
        { productSlug: "daily-backpack", quantity: 2 },
        { productSlug: "wireless-earbuds", quantity: 1 },
      ],
      clientIp: "196.203.10.4",
      userAgent: "Mozilla/5.0",
      sourceUrl: "https://edebou.live/products/daily-backpack",
      cookieHeader: "a=1; _fbp=fb.1.123.456; _fbc=fb.1.123.AbC",
    },
    1_800_000_000_123,
  );

  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, "EDB-261127-0310"); // same id as the browser Pixel → counted once
  assert.equal(event.event_time, 1_800_000_000);
  assert.deepEqual(event.custom_data, {
    currency: "TND",
    value: 127.8,
    content_type: "product",
    content_ids: ["daily-backpack", "wireless-earbuds"],
    num_items: 3,
  });
  assert.deepEqual(event.user_data, {
    client_ip_address: "196.203.10.4",
    client_user_agent: "Mozilla/5.0",
    fbp: "fb.1.123.456",
    fbc: "fb.1.123.AbC",
  });

  // A non-IP client token (local dev) is never sent as an IP.
  const local = buildPurchaseEvent({
    orderNumber: "EDB-1",
    totalMillimes: 1_000,
    items: [],
    clientIp: "unattributed-direct-client",
    userAgent: null,
    sourceUrl: null,
    cookieHeader: null,
  });
  assert.deepEqual(local.user_data, {});
  assert.equal("event_source_url" in local, false);
});
