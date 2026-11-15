import { z } from "zod";

import type { PublicProductDetailDto } from "@/lib/dto/catalog";

const localizedTextSchema = z
  .object({ ar: z.string(), fr: z.string() })
  .strict();

const productDetailSchema = z
  .object({
    slug: z.string(),
    sku: z.string(),
    name: localizedTextSchema,
    description: localizedTextSchema,
    priceMillimes: z.number().int().nonnegative(),
    currency: z.literal("TND"),
    availability: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]),
    category: z
      .object({
        slug: z.string(),
        name: localizedTextSchema,
      })
      .strict(),
    image: z
      .object({
        path: z.string(),
        alt: localizedTextSchema,
        position: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    images: z.array(
      z
        .object({
          path: z.string(),
          alt: localizedTextSchema,
          position: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    priceTiers: z.array(
      z
        .object({
          minQuantity: z.number().int().min(2),
          unitPriceMillimes: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();

const productResponseSchema = z
  .object({ data: productDetailSchema })
  .strict();

export class CartCatalogError extends Error {
  constructor() {
    super("The catalog could not be loaded.");
    this.name = "CartCatalogError";
  }
}

export async function fetchCartProduct(
  slug: string,
  signal: AbortSignal,
): Promise<PublicProductDetailDto | null> {
  const response = await fetch(`/api/products/${encodeURIComponent(slug)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new CartCatalogError();
  }

  const result = productResponseSchema.safeParse(await response.json());
  if (!result.success) {
    throw new CartCatalogError();
  }

  return result.data.data;
}
