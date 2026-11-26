import assert from "node:assert/strict";
import test from "node:test";

import {
  cartReducer,
  createIdempotencyKey,
  getIndicativeLineTotal,
  getIndicativeUnitPrice,
  initialCartState,
  MAX_CART_ITEM_QUANTITY,
  MAX_CART_LINES,
  parseStoredCart,
  serializeCartItems,
} from "../src/components/cart/cart-state";
import { checkoutFormSchema } from "../src/components/checkout/checkout-form-schema";
import { buildOrderItems } from "../src/components/checkout/order-client";
import { priceOrderLine } from "../src/lib/checkout/offer-pricing";

test("cart storage accepts only bounded slug and quantity records", () => {
  const stored = JSON.stringify([
    { slug: "wireless-earbuds", quantity: 2 },
    { slug: "wireless-earbuds", quantity: 9 },
    { slug: "has-price", quantity: 1, priceMillimes: 1 },
    { slug: "bad slug", quantity: 1 },
    { slug: "negative", quantity: -1 },
  ]);

  assert.deepEqual(parseStoredCart(stored), [
    { slug: "wireless-earbuds", quantity: 2 },
  ]);
  assert.deepEqual(parseStoredCart("not-json"), []);
  assert.deepEqual(parseStoredCart(JSON.stringify({ items: [] })), []);
});

test("serialized cart data cannot contain prices or personal data", () => {
  const serialized = serializeCartItems([
    { slug: "wireless-earbuds", quantity: 3 },
  ]);

  assert.deepEqual(JSON.parse(serialized), [
    { slug: "wireless-earbuds", quantity: 3 },
  ]);
  assert.doesNotMatch(serialized, /price|phone|address|name/i);
});

test("cart reducer merges additions and enforces quantity and line limits", () => {
  const hydrated = cartReducer(initialCartState, {
    type: "hydrate",
    items: [],
  });
  const added = cartReducer(hydrated, {
    type: "add",
    item: { slug: "wireless-earbuds", quantity: 60 },
  });
  const capped = cartReducer(added, {
    type: "add",
    item: { slug: "wireless-earbuds", quantity: 60 },
  });

  assert.equal(capped.items[0]?.quantity, MAX_CART_ITEM_QUANTITY);
  assert.strictEqual(
    cartReducer(capped, {
      type: "update",
      slug: "wireless-earbuds",
      quantity: 0,
    }),
    capped,
  );

  const full = cartReducer(initialCartState, {
    type: "hydrate",
    items: Array.from({ length: MAX_CART_LINES }, (_, index) => ({
      slug: `product-${index}`,
      quantity: 1,
    })),
  });
  const overflow = cartReducer(full, {
    type: "add",
    item: { slug: "one-too-many", quantity: 1 },
  });
  assert.equal(overflow.items.length, MAX_CART_LINES);
});

test("highest applicable wholesale tier determines indicative unit price", () => {
  const tiers = [
    { minQuantity: 10, unitPriceMillimes: 20_000 },
    { minQuantity: 5, unitPriceMillimes: 23_000 },
  ];

  assert.equal(getIndicativeUnitPrice(25_000, tiers, 4), 25_000);
  assert.equal(getIndicativeUnitPrice(25_000, tiers, 5), 23_000);
  assert.equal(getIndicativeUnitPrice(25_000, tiers, 12), 20_000);
});

test("exact bundle offers keep their configured total in the cart and final order", () => {
  const publicTiers = [
    { minQuantity: 2, unitPriceMillimes: 66_500, bundleTotalMillimes: 133_000 },
    { minQuantity: 3, unitPriceMillimes: 66_333, bundleTotalMillimes: 199_000 },
  ];
  const storedTiers = publicTiers.map((tier) => ({
    minQuantity: tier.minQuantity,
    unitPrice: BigInt(tier.unitPriceMillimes),
    bundleTotal: BigInt(tier.bundleTotalMillimes),
  }));

  assert.equal(getIndicativeLineTotal(73_000, publicTiers, 1), 73_000);
  assert.equal(getIndicativeLineTotal(73_000, publicTiers, 2), 133_000);
  assert.equal(getIndicativeLineTotal(73_000, publicTiers, 3), 199_000);
  assert.equal(getIndicativeLineTotal(73_000, publicTiers, 4), 292_000);
  assert.equal(priceOrderLine(BigInt(73_000), 3, storedTiers).lineTotal, BigInt(199_000));
  assert.equal(priceOrderLine(BigInt(73_000), 4, storedTiers).lineTotal, BigInt(292_000));
  for (const quantity of [1, 2, 3, 4]) {
    assert.equal(
      BigInt(getIndicativeUnitPrice(73_000, publicTiers, quantity)),
      priceOrderLine(BigInt(73_000), quantity, storedTiers).unitPrice,
    );
  }
});

test("checkout form normalizes supported Tunisian phone formats", () => {
  const base = {
    fullName: "Amine Ben Salem",
    governorate: "tunis",
    address: "10 rue de Tunis",
    notes: "",
  } as const;

  for (const phone of ["22 345 678", "+216 22 345 678", "00216 22 345 678"]) {
    const result = checkoutFormSchema.parse({ ...base, phone });
    assert.equal(result.phone, "+21622345678");
    assert.equal(result.notes, undefined);
  }

  for (const phone of ["123", "+216 12 345 678", "+33 22 345 678"]) {
    assert.equal(checkoutFormSchema.safeParse({ ...base, phone }).success, false);
  }
});

test("checkout payload items contain no client-supplied commercial amounts", () => {
  assert.deepEqual(
    buildOrderItems([{ slug: "wireless-earbuds", quantity: 2 }]),
    [{ productSlug: "wireless-earbuds", quantity: 2 }],
  );

  const first = createIdempotencyKey();
  const second = createIdempotencyKey();
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.notEqual(first, second);
});
