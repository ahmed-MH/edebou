import { z } from "zod";

import { MAX_MONEY_MILLIMES } from "@/lib/money";

export const MAX_MONEY_MILLIMES_BIGINT = BigInt(MAX_MONEY_MILLIMES);
export const MAX_STOCK_QUANTITY = 1_000_000;
export const MAX_TIER_QUANTITY = 1_000_000;
export const MAX_PRICE_TIERS_PER_PRODUCT = 25;

export const moneyMillimesSchema = z
  .bigint()
  .min(BigInt(0))
  .max(MAX_MONEY_MILLIMES_BIGINT);

export const stockQuantitySchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_STOCK_QUANTITY);

export const productPriceTierSchema = z
  .object({
    minQuantity: z.number().int().min(2).max(MAX_TIER_QUANTITY),
    unitPrice: moneyMillimesSchema,
  })
  .strict();

export const productPriceTiersSchema = z
  .array(productPriceTierSchema)
  .max(MAX_PRICE_TIERS_PER_PRODUCT)
  .superRefine((tiers, context) => {
    const quantities = new Set<number>();

    for (const [index, tier] of tiers.entries()) {
      if (quantities.has(tier.minQuantity)) {
        context.addIssue({
          code: "custom",
          path: [index, "minQuantity"],
          message: "Duplicate minimum quantity.",
        });
      }

      quantities.add(tier.minQuantity);
    }
  });
