import "server-only";

import {
  CheckoutError,
  CheckoutRateLimitedError,
  CheckoutServiceUnavailableError,
} from "@/lib/checkout/errors";
import { getCheckoutSecurityConfig } from "@/lib/checkout/config";
import { hmacCheckoutValue } from "@/lib/checkout/request-security";
import type { CheckoutRepository } from "@/lib/repositories/checkout-repository";
import { prismaCheckoutRepository } from "@/lib/repositories/prisma-checkout-repository";
import {
  canonicalizeOrderRequest,
  type ValidatedOrderRequest,
} from "@/lib/validators/order";

export interface CheckoutSettingsDto {
  readonly deliveryFeeMillimes: number;
  readonly contactPhone: string | null;
}

export interface OrderConfirmationDto {
  readonly orderNumber: string;
  readonly subtotalMillimes: number;
  readonly deliveryFeeMillimes: number;
  readonly totalMillimes: number;
  readonly currency: "TND";
  readonly status: "PENDING";
}

export interface OrderCreationResult {
  readonly confirmation: OrderConfirmationDto;
  readonly replayed: boolean;
}

function safeMillimes(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new CheckoutServiceUnavailableError();
  }
  return amount;
}

export class OrderService {
  constructor(private readonly repository: CheckoutRepository) {}

  async getCheckoutSettings(): Promise<CheckoutSettingsDto> {
    try {
      const settings = await this.repository.getSettings();
      return { deliveryFeeMillimes: safeMillimes(settings.deliveryFee), contactPhone: settings.contactPhone };
    } catch (error) {
      if (error instanceof CheckoutError) {
        throw error;
      }
      throw new CheckoutServiceUnavailableError();
    }
  }

  async enforceRateLimit(clientToken: string): Promise<void> {
    try {
      const config = getCheckoutSecurityConfig();
      const clientKeyHash = hmacCheckoutValue(
        "client-ip",
        clientToken,
        config.ipHashPepper,
      );
      const result = await this.repository.consumeRateLimit(clientKeyHash);

      if (!result.allowed) {
        throw new CheckoutRateLimitedError(result.retryAfterSeconds);
      }
    } catch (error) {
      if (error instanceof CheckoutError) {
        throw error;
      }
      throw new CheckoutServiceUnavailableError();
    }
  }

  async createOrder(
    request: ValidatedOrderRequest,
  ): Promise<OrderCreationResult> {
    try {
      const config = getCheckoutSecurityConfig();
      const idempotencyKeyHash = hmacCheckoutValue(
        "idempotency",
        request.idempotencyKey,
        config.idempotencyPepper,
      );
      const requestHash = hmacCheckoutValue(
        "request",
        canonicalizeOrderRequest(request),
        config.idempotencyPepper,
      );
      const checkoutIntentTokenHash = request.checkoutIntentToken
        ? hmacCheckoutValue(
            "intent-token",
            request.checkoutIntentToken,
            config.idempotencyPepper,
          )
        : undefined;
      const order = await this.repository.createOrder({
        request,
        idempotencyKeyHash,
        requestHash,
        checkoutIntentTokenHash,
      });

      return {
        replayed: order.replayed,
        confirmation: {
          orderNumber: order.orderNumber,
          subtotalMillimes: safeMillimes(order.subtotal),
          deliveryFeeMillimes: safeMillimes(order.deliveryFee),
          totalMillimes: safeMillimes(order.total),
          currency: "TND",
          status: "PENDING",
        },
      };
    } catch (error) {
      if (error instanceof CheckoutError) {
        throw error;
      }
      throw new CheckoutServiceUnavailableError();
    }
  }
}

export const orderService = new OrderService(prismaCheckoutRepository);
