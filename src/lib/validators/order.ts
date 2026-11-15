import { z } from "zod";

import { InvalidCheckoutRequestError } from "@/lib/checkout/errors";

export const MAX_ORDER_LINES = 20;
export const MAX_ORDER_QUANTITY_PER_LINE = 100;

export const TUNISIAN_GOVERNORATES = [
  "ariana",
  "beja",
  "ben-arous",
  "bizerte",
  "gabes",
  "gafsa",
  "jendouba",
  "kairouan",
  "kasserine",
  "kebili",
  "kef",
  "mahdia",
  "manouba",
  "medenine",
  "monastir",
  "nabeul",
  "sfax",
  "sidi-bouzid",
  "siliana",
  "sousse",
  "tataouine",
  "tozeur",
  "tunis",
  "zaghouan",
] as const;

const forbiddenTextCharacters = /[\u0000-\u001f\u007f-\u009f]/u;

function normalizedTextSchema(minimum: number, maximum: number) {
  return z
    .string()
    .max(maximum * 4)
    .transform((value) => value.trim().normalize("NFKC"))
    .pipe(
      z
        .string()
        .min(minimum)
        .max(maximum)
        .refine((value) => !forbiddenTextCharacters.test(value)),
    );
}

export function normalizeTunisianPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/gu, "");
  let nationalNumber: string;

  if (/^[234579]\d{7}$/u.test(compact)) {
    nationalNumber = compact;
  } else if (/^\+216[234579]\d{7}$/u.test(compact)) {
    nationalNumber = compact.slice(4);
  } else if (/^00216[234579]\d{7}$/u.test(compact)) {
    nationalNumber = compact.slice(5);
  } else {
    return null;
  }

  return `+216${nationalNumber}`;
}

const tunisianPhoneSchema = z
  .string()
  .min(8)
  .max(32)
  .transform(normalizeTunisianPhone)
  .pipe(z.string().regex(/^\+216[234579]\d{7}$/u));

const productSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
  )
  .transform((value) => value.toLowerCase());

const checkoutIntentTokenSchema = z
  .string()
  .trim()
  .uuid()
  .transform((value) => value.toLowerCase());

const orderItemSchema = z
  .object({
    productSlug: productSlugSchema,
    quantity: z.number().int().min(1).max(MAX_ORDER_QUANTITY_PER_LINE),
  })
  .strict();

const customerSchema = z
  .object({
    fullName: normalizedTextSchema(2, 160),
    phone: tunisianPhoneSchema,
    governorate: z.enum(TUNISIAN_GOVERNORATES),
    address: normalizedTextSchema(5, 500),
    notes: normalizedTextSchema(1, 1_000).optional(),
  })
  .strict();

export const orderRequestSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    checkoutIntentToken: checkoutIntentTokenSchema.optional(),
    locale: z.enum(["ar", "fr"]),
    customer: customerSchema,
    items: z
      .array(orderItemSchema)
      .min(1)
      .max(MAX_ORDER_LINES)
      .superRefine((items, context) => {
        const slugs = new Set<string>();

        for (const [index, item] of items.entries()) {
          if (slugs.has(item.productSlug)) {
            context.addIssue({
              code: "custom",
              path: [index, "productSlug"],
              message: "Duplicate product.",
            });
          }

          slugs.add(item.productSlug);
        }
      }),
  })
  .strict();

export type ValidatedOrderRequest = z.output<typeof orderRequestSchema>;

export function parseOrderRequest(value: unknown): ValidatedOrderRequest {
  const result = orderRequestSchema.safeParse(value);

  if (!result.success) {
    throw new InvalidCheckoutRequestError();
  }

  return result.data;
}

export function canonicalizeOrderRequest(
  request: ValidatedOrderRequest,
): string {
  return JSON.stringify({
    checkoutIntentToken: request.checkoutIntentToken ?? null,
    locale: request.locale,
    customer: {
      fullName: request.customer.fullName,
      phone: request.customer.phone,
      governorate: request.customer.governorate,
      address: request.customer.address,
      notes: request.customer.notes ?? null,
    },
    items: [...request.items]
      .sort((left, right) =>
        left.productSlug < right.productSlug
          ? -1
          : left.productSlug > right.productSlug
            ? 1
            : 0,
      )
      .map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
      })),
  });
}
