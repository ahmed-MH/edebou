import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import type { PublicProductSort } from "@/lib/validators/catalog";

import type {
  CatalogRepository,
  CategoryRecord,
  ProductDetailRecord,
  ProductListCriteria,
  ProductListRecord,
} from "./catalog-repository";

const MAX_PUBLIC_CATEGORIES = 100;
const MAX_PUBLIC_PRODUCT_IMAGES = 12;
// Checkout quantities are capped at 100, so at most the 99 distinct database
// thresholds from 2 through 100 can affect the displayed unit price.
const MAX_PUBLIC_PRICE_TIERS = 99;

/** Escape PostgreSQL LIKE metacharacters before Prisma wraps `contains`. */
export function escapePostgresLikePattern(value: string): string {
  return value.replace(/[\\%_]/gu, "\\$&");
}

const categorySelect = {
  slug: true,
  nameAr: true,
  nameFr: true,
} satisfies Prisma.CategorySelect;

const imageSelect = {
  path: true,
  altAr: true,
  altFr: true,
  position: true,
} satisfies Prisma.ProductImageSelect;

const productSummarySelect = {
  slug: true,
  sku: true,
  nameAr: true,
  nameFr: true,
  price: true,
  stockQuantity: true,
  category: { select: categorySelect },
  images: {
    select: imageSelect,
    orderBy: { position: "asc" },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const productDetailSelect = {
  ...productSummarySelect,
  descriptionAr: true,
  descriptionFr: true,
  compareAtPrice: true,
  images: {
    select: imageSelect,
    orderBy: { position: "asc" },
    take: MAX_PUBLIC_PRODUCT_IMAGES,
  },
  priceTiers: {
    select: {
      minQuantity: true,
      unitPrice: true,
      bundleTotal: true,
    },
    orderBy: { minQuantity: "asc" },
    take: MAX_PUBLIC_PRICE_TIERS,
  },
} satisfies Prisma.ProductSelect;

function activeProductWhere(
  criteria: Pick<ProductListCriteria, "search" | "category">,
): Prisma.ProductWhereInput {
  const search = criteria.search
    ? escapePostgresLikePattern(criteria.search)
    : undefined;

  return {
    isActive: true,
    category: {
      is: {
        isActive: true,
        ...(criteria.category ? { slug: criteria.category } : {}),
      },
    },
    ...(search
      ? {
          OR: [
            {
              nameAr: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              nameFr: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              sku: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}

function productOrderBy(
  sort: PublicProductSort = "newest",
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ price: "asc" }, { slug: "asc" }];
    case "price-desc":
      return [{ price: "desc" }, { slug: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }, { slug: "asc" }];
  }
}

class PrismaCatalogRepository implements CatalogRepository {
  async listActiveCategories(): Promise<readonly CategoryRecord[]> {
    const prisma = getPrismaClient();

    return prisma.category.findMany({
      where: { isActive: true },
      select: categorySelect,
      orderBy: { slug: "asc" },
      take: MAX_PUBLIC_CATEGORIES,
    });
  }

  async listActiveProducts(
    criteria: ProductListCriteria,
  ): Promise<ProductListRecord> {
    const prisma = getPrismaClient();
    const where = activeProductWhere(criteria);
    const skip = (criteria.page - 1) * criteria.pageSize;

    const [total, items] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: productSummarySelect,
        orderBy: productOrderBy(criteria.sort),
        skip,
        take: criteria.pageSize,
      }),
    ]);

    return { total, items };
  }

  async findActiveProductBySlug(
    slug: string,
  ): Promise<ProductDetailRecord | null> {
    const prisma = getPrismaClient();

    return prisma.product.findFirst({
      where: {
        slug,
        isActive: true,
        category: { is: { isActive: true } },
      },
      select: productDetailSelect,
    });
  }
}

export const prismaCatalogRepository: CatalogRepository =
  new PrismaCatalogRepository();
