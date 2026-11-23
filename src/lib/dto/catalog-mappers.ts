import type {
  CategoryRecord,
  ProductDetailRecord,
  ProductImageRecord,
  ProductSummaryRecord,
} from "@/lib/repositories/catalog-repository";
import { MAX_MONEY_MILLIMES } from "@/lib/money";

import type {
  PublicCategoryDto,
  PublicProductAvailability,
  PublicProductDetailDto,
  PublicProductImageDto,
  PublicProductSummaryDto,
} from "./catalog";

const LOW_STOCK_MAXIMUM = 5;
const ZERO_MILLIMES = BigInt(0);
const MAX_PUBLIC_MONEY_MILLIMES = BigInt(MAX_MONEY_MILLIMES);

function toPublicMoney(millimes: bigint): number {
  if (millimes < ZERO_MILLIMES || millimes > MAX_PUBLIC_MONEY_MILLIMES) {
    throw new RangeError("The stored money amount is outside the public range.");
  }

  return Number(millimes);
}

function toPublicAvailability(stockQuantity: number): PublicProductAvailability {
  if (stockQuantity === 0) {
    return "OUT_OF_STOCK";
  }

  if (stockQuantity <= LOW_STOCK_MAXIMUM) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
}

export function toPublicCategoryDto(
  category: CategoryRecord,
): PublicCategoryDto {
  return {
    slug: category.slug,
    name: { ar: category.nameAr, fr: category.nameFr },
  };
}

export function toPublicProductImageDto(
  image: ProductImageRecord,
): PublicProductImageDto {
  return {
    path: image.path,
    alt: { ar: image.altAr, fr: image.altFr },
    position: image.position,
  };
}

export function toPublicProductSummaryDto(
  product: ProductSummaryRecord,
): PublicProductSummaryDto {
  return {
    slug: product.slug,
    sku: product.sku,
    name: { ar: product.nameAr, fr: product.nameFr },
    priceMillimes: toPublicMoney(product.price),
    currency: "TND",
    availability: toPublicAvailability(product.stockQuantity),
    category: toPublicCategoryDto(product.category),
    image: product.images[0]
      ? toPublicProductImageDto(product.images[0])
      : null,
  };
}

export function toPublicProductDetailDto(
  product: ProductDetailRecord,
): PublicProductDetailDto {
  return {
    ...toPublicProductSummaryDto(product),
    description: {
      ar: product.descriptionAr,
      fr: product.descriptionFr,
    },
    compareAtPriceMillimes: product.compareAtPrice == null ? null : toPublicMoney(product.compareAtPrice),
    images: product.images.map(toPublicProductImageDto),
    priceTiers: product.priceTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      unitPriceMillimes: toPublicMoney(tier.unitPrice),
      bundleTotalMillimes: tier.bundleTotal == null ? null : toPublicMoney(tier.bundleTotal),
    })),
  };
}
