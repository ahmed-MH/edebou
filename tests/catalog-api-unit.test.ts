import assert from "node:assert/strict";
import test from "node:test";

import {
  toPublicProductDetailDto,
  toPublicProductSummaryDto,
} from "../src/lib/dto/catalog-mappers";
import { isSafeLocalCatalogImagePath } from "../src/lib/catalog-image";
import {
  ResourceNotFoundError,
  ServiceUnavailableError,
} from "../src/lib/errors";
import type {
  CatalogRepository,
  ProductDetailRecord,
} from "../src/lib/repositories/catalog-repository";
import { escapePostgresLikePattern } from "../src/lib/repositories/prisma-catalog-repository";
import { CatalogService } from "../src/lib/services/catalog-service";
import {
  moneyMillimesSchema,
  productPriceTiersSchema,
  stockQuantitySchema,
} from "../src/lib/validators/commerce";
import {
  parseEmptyQuery,
  parseProductListQuery,
  parseProductSlug,
} from "../src/lib/validators/catalog";

const activeProduct: ProductDetailRecord = {
  slug: "wireless-earbuds",
  sku: "EDB-EAR-001",
  nameAr: "سماعات لاسلكية",
  nameFr: "Écouteurs sans fil",
  descriptionAr: "وصف",
  descriptionFr: "Description",
  price: BigInt(79_900),
  stockQuantity: 4,
  category: {
    slug: "electronics",
    nameAr: "إلكترونيات",
    nameFr: "Électronique",
  },
  images: [
    {
      path: "/products/earbuds.webp",
      altAr: "سماعات",
      altFr: "Écouteurs",
      position: 0,
    },
  ],
  priceTiers: [{ minQuantity: 5, unitPrice: BigInt(74_900) }],
};

function mockRepository(
  overrides: Partial<CatalogRepository> = {},
): CatalogRepository {
  return {
    async listActiveCategories() {
      return [activeProduct.category];
    },
    async listActiveProducts() {
      return { items: [activeProduct], total: 1 };
    },
    async findActiveProductBySlug(slug: string) {
      return slug === activeProduct.slug ? activeProduct : null;
    },
    ...overrides,
  };
}

test("public product query parsing applies bounded defaults", () => {
  assert.deepEqual(parseProductListQuery(new URLSearchParams()), {
    page: 1,
    pageSize: 12,
    search: undefined,
    category: undefined,
    sort: "newest",
  });

  assert.deepEqual(
    parseProductListQuery(new URLSearchParams("search=&category=")),
    {
      page: 1,
      pageSize: 12,
      search: undefined,
      category: undefined,
      sort: "newest",
    },
  );

  assert.deepEqual(
    parseProductListQuery(
      new URLSearchParams({
        page: "1000",
        pageSize: "24",
        search: "  Café  ",
        category: "home-care",
        sort: "price-desc",
      }),
    ),
    {
      page: 1000,
      pageSize: 24,
      search: "Café",
      category: "home-care",
      sort: "price-desc",
    },
  );
});

test("invalid, duplicate, unknown, and excessive query parameters are rejected", () => {
  for (const query of [
    "page=0",
    "page=1001",
    "page=1.5",
    `page=${"1".repeat(10_000)}`,
    "pageSize=0",
    "pageSize=25",
    "search=a",
    `search=${"a".repeat(81)}`,
    `search=${"ﬃ".repeat(27)}`,
    "search=good%00bad",
    "category=../admin",
    `category=${"a".repeat(121)}`,
    "unknown=value",
    "page=1&page=2",
    "sort=oldest",
  ]) {
    assert.throws(() => parseProductListQuery(new URLSearchParams(query)));
  }
});

test("query-free catalog endpoints reject every query parameter", () => {
  assert.doesNotThrow(() => parseEmptyQuery(new URLSearchParams()));

  for (const query of ["unknown=value", "unknown=1&unknown=2", "=value"]) {
    assert.throws(() => parseEmptyQuery(new URLSearchParams(query)));
  }
});

test("search text is treated as bounded data while slug injection is rejected", () => {
  const injectionText = "' OR 1=1 --";
  assert.equal(
    parseProductListQuery(
      new URLSearchParams({ search: injectionText }),
    ).search,
    injectionText,
  );

  assert.equal(parseProductSlug("wireless-earbuds"), "wireless-earbuds");
  assert.equal(parseProductSlug("a".repeat(120)), "a".repeat(120));
  for (const slug of ["' OR 1=1 --", "../admin", "UPPERCASE", "a/b", ""]) {
    assert.throws(() => parseProductSlug(slug));
  }
});

test("PostgreSQL LIKE metacharacters are escaped before catalog searches", () => {
  assert.equal(
    escapePostgresLikePattern(String.raw`50%_\off`),
    String.raw`50\%\_\\off`,
  );
  assert.equal(escapePostgresLikePattern("plain text"), "plain text");
});

test("catalog image rendering only accepts same-origin paths", () => {
  for (const path of [
    "/demo/product.svg",
    "/uploads/catalog/item.webp?version=2",
  ]) {
    assert.equal(isSafeLocalCatalogImagePath(path), true);
  }

  for (const path of [
    "https://example.com/product.png",
    "//example.com/product.png",
    String.raw`\\example.com\product.png`,
    "/demo/product.svg\nset-cookie:bad",
  ]) {
    assert.equal(isSafeLocalCatalogImagePath(path), false);
  }
});

test("commerce validation enforces integer bounds and unique price tiers", () => {
  assert.equal(
    moneyMillimesSchema.parse(BigInt(9_999_999_999)),
    BigInt(9_999_999_999),
  );
  assert.equal(stockQuantitySchema.parse(0), 0);

  for (const invalidMoney of [BigInt(-1), BigInt(10_000_000_000)]) {
    assert.equal(moneyMillimesSchema.safeParse(invalidMoney).success, false);
  }
  for (const invalidStock of [-1, 1.5, 1_000_001]) {
    assert.equal(stockQuantitySchema.safeParse(invalidStock).success, false);
  }

  assert.equal(
    productPriceTiersSchema.safeParse([
      { minQuantity: 5, unitPrice: BigInt(1_000) },
      { minQuantity: 5, unitPrice: BigInt(900) },
    ]).success,
    false,
  );
  assert.equal(
    productPriceTiersSchema.safeParse([
      { minQuantity: 1, unitPrice: BigInt(1_000) },
    ]).success,
    false,
  );
});

test("DTO mappers serialize BigInt money and omit persistence-only fields", () => {
  const summary = toPublicProductSummaryDto(activeProduct);
  const detail = toPublicProductDetailDto(activeProduct);

  assert.equal(summary.priceMillimes, 79_900);
  assert.equal(summary.availability, "LOW_STOCK");
  assert.equal(detail.priceTiers[0]?.unitPriceMillimes, 74_900);
  assert.doesNotThrow(() => JSON.stringify(detail));

  const serialized = JSON.stringify(detail);
  for (const internalField of [
    '"id"',
    '"isActive"',
    '"createdAt"',
    '"updatedAt"',
    '"stockQuantity"',
    '"categoryId"',
    '"productId"',
  ]) {
    assert.equal(serialized.includes(internalField), false);
  }
});

test("catalog service returns paginated DTOs through an injected repository", async () => {
  const service = new CatalogService(mockRepository());
  const page = await service.listProducts({ page: 2, pageSize: 12 });

  assert.equal(page.items.length, 1);
  assert.deepEqual(page.pagination, {
    page: 2,
    pageSize: 12,
    total: 1,
    totalPages: 1,
  });
  assert.equal(
    (await service.getProductBySlug("wireless-earbuds")).slug,
    "wireless-earbuds",
  );
});

test("catalog service normalizes missing and database failure outcomes", async () => {
  const service = new CatalogService(mockRepository());
  await assert.rejects(
    () => service.getProductBySlug("missing"),
    ResourceNotFoundError,
  );

  const unavailable = new CatalogService(
    mockRepository({
      async listActiveProducts() {
        throw new Error("postgres://user:secret@internal/db");
      },
    }),
  );

  await assert.rejects(
    () => unavailable.listProducts({ page: 1, pageSize: 12 }),
    ServiceUnavailableError,
  );
});
