import { z } from "zod";

import type { AppLocale } from "@/i18n/routing";

import type { CartItem } from "../cart/cart-state";
import type { CheckoutCustomer } from "./checkout-form-schema";

const confirmationSchema = z
  .object({
    orderNumber: z.string().min(1).max(64),
    subtotalMillimes: z.number().int().nonnegative(),
    deliveryFeeMillimes: z.number().int().nonnegative(),
    totalMillimes: z.number().int().nonnegative(),
    currency: z.literal("TND"),
    status: z.literal("PENDING"),
  })
  .strict();

const successResponseSchema = z
  .object({ data: confirmationSchema })
  .strict();

const checkoutErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "FORBIDDEN_REQUEST",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_UNAVAILABLE",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

const errorResponseSchema = z
  .object({
    error: z
      .object({
        code: checkoutErrorCodeSchema,
        message: z.string(),
        requestId: z.string(),
      })
      .strict(),
  })
  .strict();

export type OrderConfirmation = z.infer<typeof confirmationSchema>;
export type CheckoutErrorCode = z.infer<typeof checkoutErrorCodeSchema> | "UNKNOWN";

export type CreateOrderPayload = {
  readonly idempotencyKey: string;
  readonly checkoutIntentToken?: string;
  readonly locale: AppLocale;
  readonly customer: CheckoutCustomer;
  readonly items: readonly {
    readonly productSlug: string;
    readonly quantity: number;
  }[];
};

export class CreateOrderError extends Error {
  constructor(readonly code: CheckoutErrorCode) {
    super(code);
    this.name = "CreateOrderError";
  }
}

export function buildOrderItems(items: readonly CartItem[]) {
  return items.map(({ slug, quantity }) => ({
    productSlug: slug,
    quantity,
  }));
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<OrderConfirmation> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-EDebou-CSRF": "1",
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CreateOrderError("UNKNOWN");
  }

  if (!response.ok) {
    const error = errorResponseSchema.safeParse(body);
    throw new CreateOrderError(
      error.success ? error.data.error.code : "UNKNOWN",
    );
  }

  const confirmation = successResponseSchema.safeParse(body);
  if (!confirmation.success) {
    throw new CreateOrderError("UNKNOWN");
  }

  return confirmation.data.data;
}
