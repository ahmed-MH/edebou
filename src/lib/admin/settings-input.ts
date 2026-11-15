import { z } from "zod";

import { parseTunisianDinarsToMillimes } from "@/lib/money";

const deliveryFeeSchema = z
  .string()
  .trim()
  .min(1, "Indiquez les frais de livraison.")
  .max(32, "Le montant saisi est trop long.")
  .regex(
    /^(0|[1-9]\d*)(?:[.,]\d{1,3})?$/,
    "Utilisez un montant positif avec trois décimales maximum.",
  )
  .transform((value) => parseTunisianDinarsToMillimes(value))
  .refine(
    (value) => value <= 1_000_000,
    "Les frais de livraison ne peuvent pas dépasser 1 000 TND.",
  );

export const updateStoreSettingsSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(2, "Le nom de la boutique doit contenir au moins 2 caractères.")
      .max(160, "Le nom de la boutique ne peut pas dépasser 160 caractères."),
    deliveryFee: deliveryFeeSchema,
  })
  .strict();
