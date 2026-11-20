import assert from "node:assert/strict";
import test from "node:test";

import { calculateIntentScore } from "../src/lib/admin/intent-score";
import {
  createCategorySchema,
  createProductSchema,
} from "../src/lib/admin/catalog-input";
import { isManagedProductImagePath } from "../src/lib/admin/product-images";
import { updateStoreSettingsSchema } from "../src/lib/admin/settings-input";
import {
  ADMIN_UPLOAD_CSRF_HEADER,
  ADMIN_UPLOAD_CSRF_VALUE,
  isSecureAdminUploadRequest,
} from "../src/lib/admin/upload-request-security";
import {
  hashAdminPassword,
  isStrongAdminPassword,
  verifyAdminPassword,
} from "../src/lib/admin/password";
import { checkoutIntentSchema } from "../src/lib/validators/checkout-intent";

test("checkout drafts require a valid Tunisian phone and stay strictly bounded", () => {
  const parsed = checkoutIntentSchema.parse({
    token: "18be78f1-4dce-4fa7-b399-5fb599e8a0d3",
    locale: "fr",
    source: "PRODUCT",
    customer: {
      fullName: "  Client test  ",
      phone: "20 000 000",
      governorate: "tunis",
      address: "  Adresse de test  ",
    },
    items: [{ productSlug: "wireless-earbuds", quantity: 1 }],
  });

  assert.equal(parsed.customer.phone, "+21620000000");
  assert.equal(parsed.customer.fullName, "Client test");
  assert.equal(parsed.customer.address, "Adresse de test");
  assert.equal(
    checkoutIntentSchema.safeParse({
      ...parsed,
      customer: { ...parsed.customer, phone: "123" },
      unexpected: true,
    }).success,
    false,
  );
});

test("the opportunity score is deterministic, bounded and explainable", () => {
  const complete = calculateIntentScore({
    customerName: "Client test",
    address: "Une adresse suffisamment précise",
    governorate: "tunis",
    items: [{ productSlug: "wireless-earbuds", quantity: 1 }],
    lastSeenAt: new Date(),
  });
  const incomplete = calculateIntentScore({
    customerName: null,
    address: null,
    governorate: null,
    items: [],
    lastSeenAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
  });

  assert.deepEqual(
    { score: complete.score, strength: complete.strength },
    { score: 100, strength: "HIGH" },
  );
  assert.deepEqual(
    { score: incomplete.score, strength: incomplete.strength },
    { score: 30, strength: "LOW" },
  );
  assert.ok(complete.explanation.length > 0);
});

test("admin passwords use the strong policy and a salted scrypt hash", async () => {
  const password = "TresSolide-EDebou-2026!";
  assert.equal(isStrongAdminPassword(password), true);
  assert.equal(isStrongAdminPassword("motdepasse"), false);

  const first = await hashAdminPassword(password);
  const second = await hashAdminPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyAdminPassword(password, first), true);
  assert.equal(await verifyAdminPassword(password + "x", first), false);
});

test("admin catalogue creation accepts bounded bilingual records", () => {
  const category = createCategorySchema.parse({
    slug: "beaute-bien-etre",
    nameFr: " Beauté ",
    nameAr: " الجمال ",
    isActive: true,
  });
  assert.equal(category.nameFr, "Beauté");

  const product = createProductSchema.parse({
    categoryId: "18be78f1-4dce-4fa7-b399-5fb599e8a0d3",
    sku: "COL-350",
    slug: "collagen-renover-350g",
    nameFr: "Collagène",
    nameAr: "كولاجين",
    descriptionFr: "Description française",
    descriptionAr: "وصف المنتج",
    priceMillimes: "59.900",
    stockQuantity: "12",
    imagePaths: [
      "/products/collagen-face.webp",
      "/products/collagen-back.webp",
    ],
    isActive: true,
  });
  assert.equal(product.priceMillimes, 59_900);
  assert.equal(product.stockQuantity, 12);

  assert.equal(
    createProductSchema.safeParse({
      categoryId: product.categoryId,
      sku: product.sku,
      slug: "Slug invalide",
      nameFr: product.nameFr,
      nameAr: product.nameAr,
      descriptionFr: product.descriptionFr,
      descriptionAr: product.descriptionAr,
      priceMillimes: "59.900",
      stockQuantity: product.stockQuantity,
      imagePaths: ["/../secret"],
      isActive: product.isActive,
    }).success,
    false,
  );
});

test("admin image uploads require same-origin CSRF protection and managed paths", () => {
  const safeRequest = new Request(
    "http://localhost:3000/api/admin/product-images",
    {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
        "Sec-Fetch-Site": "same-origin",
        [ADMIN_UPLOAD_CSRF_HEADER]: ADMIN_UPLOAD_CSRF_VALUE,
      },
    },
  );
  assert.equal(isSecureAdminUploadRequest(safeRequest), true);
  assert.equal(
    isSecureAdminUploadRequest(
      new Request("http://localhost:3000/api/admin/product-images", {
        method: "POST",
        headers: {
          Host: "localhost:3000",
          Origin: "https://attacker.example",
          [ADMIN_UPLOAD_CSRF_HEADER]: ADMIN_UPLOAD_CSRF_VALUE,
        },
      }),
    ),
    false,
  );
  assert.equal(
    isManagedProductImagePath(
      "/api/product-images/18be78f1-4dce-4fa7-b399-5fb599e8a0d3.webp",
    ),
    true,
  );
  assert.equal(isManagedProductImagePath("/api/product-images/../secret"), false);
});

test("store settings accept a bounded name and Tunisian delivery fee", () => {
  const settings = updateStoreSettingsSchema.parse({
    storeName: " EDebou Tunisie ",
    deliveryFee: "8,500",
  });

  assert.deepEqual(settings, {
    storeName: "EDebou Tunisie",
    deliveryFee: 8_500,
  });
  assert.equal(
    updateStoreSettingsSchema.safeParse({
      storeName: "E",
      deliveryFee: "8.1234",
    }).success,
    false,
  );
  assert.equal(
    updateStoreSettingsSchema.safeParse({
      storeName: "EDebou",
      deliveryFee: "1000.001",
    }).success,
    false,
  );
});
