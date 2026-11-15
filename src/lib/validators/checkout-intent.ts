import { z } from "zod";

import { InvalidCheckoutRequestError } from "@/lib/checkout/errors";
import {
  MAX_ORDER_LINES,
  MAX_ORDER_QUANTITY_PER_LINE,
  TUNISIAN_GOVERNORATES,
  normalizeTunisianPhone,
} from "@/lib/validators/order";

const normalizedOptionalText = (maximum: number) =>
  z
    .string()
    .max(maximum * 4)
    .transform((value) => value.trim().normalize("NFKC"))
    .pipe(z.string().max(maximum))
    .transform((value) => value || undefined)
    .optional();

const intentItemSchema = z
  .object({
    productSlug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    quantity: z.number().int().min(1).max(MAX_ORDER_QUANTITY_PER_LINE),
  })
  .strict();

export const checkoutIntentSchema = z
  .object({
    token: z.string().trim().uuid().transform((value) => value.toLowerCase()),
    locale: z.enum(["ar", "fr"]),
    source: z.enum(["PRODUCT", "CHECKOUT"]),
    customer: z
      .object({
        fullName: normalizedOptionalText(160),
        phone: z
          .string()
          .min(8)
          .max(32)
          .transform(normalizeTunisianPhone)
          .pipe(z.string().regex(/^\+216[234579]\d{7}$/u)),
        governorate: z.enum(TUNISIAN_GOVERNORATES).optional(),
        address: normalizedOptionalText(500),
      })
      .strict(),
    items: z.array(intentItemSchema).min(1).max(MAX_ORDER_LINES),
  })
  .strict();

export type ValidatedCheckoutIntent = z.output<typeof checkoutIntentSchema>;

export function parseCheckoutIntent(value: unknown): ValidatedCheckoutIntent {
  const parsed = checkoutIntentSchema.safeParse(value);
  if (!parsed.success) {
    throw new InvalidCheckoutRequestError();
  }
  return parsed.data;
}
