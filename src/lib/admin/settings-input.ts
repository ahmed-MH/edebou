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
    contactPhone: z.string().trim().default("").transform((value, context) => {
      if (!value) return null;
      const normalized = value.replace(/[\s().-]/gu, "");
      const phone = normalized.startsWith("+216") ? normalized : `+216${normalized}`;
      if (!/^\+216[234579][0-9]{7}$/u.test(phone)) {
        context.addIssue({ code: "custom", message: "Saisissez un numéro tunisien valide à 8 chiffres." });
        return z.NEVER;
      }
      return phone;
    }),
  })
  .strict();
