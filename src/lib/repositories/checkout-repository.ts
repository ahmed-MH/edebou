import "server-only";

import type { ValidatedOrderRequest } from "@/lib/validators/order";
import type { ValidatedCheckoutIntent } from "@/lib/validators/checkout-intent";

export interface OrderConfirmationRecord {
  readonly orderNumber: string;
  readonly subtotal: bigint;
  readonly deliveryFee: bigint;
  readonly total: bigint;
  readonly replayed: boolean;
}

export interface CheckoutSettingsRecord {
  readonly deliveryFee: bigint;
  readonly contactPhone: string | null;
}

export interface RateLimitRecord {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface CreateOrderPersistenceInput {
  readonly request: ValidatedOrderRequest;
  readonly idempotencyKeyHash: string;
  readonly requestHash: string;
  readonly checkoutIntentTokenHash?: string;
}

export interface UpsertCheckoutIntentPersistenceInput {
  readonly intent: ValidatedCheckoutIntent;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface CheckoutRepository {
  getSettings(): Promise<CheckoutSettingsRecord>;
  consumeRateLimit(clientKeyHash: string): Promise<RateLimitRecord>;
  createOrder(
    input: CreateOrderPersistenceInput,
  ): Promise<OrderConfirmationRecord>;
}

export interface CheckoutIntentRepository {
  consumeIntentRateLimit(clientKeyHash: string): Promise<RateLimitRecord>;
  upsertCheckoutIntent(input: UpsertCheckoutIntentPersistenceInput): Promise<void>;
}
