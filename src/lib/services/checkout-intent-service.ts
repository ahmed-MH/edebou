import "server-only";

import {
  CheckoutError,
  CheckoutRateLimitedError,
  CheckoutServiceUnavailableError,
} from "@/lib/checkout/errors";
import { getCheckoutSecurityConfig } from "@/lib/checkout/config";
import { hmacCheckoutValue } from "@/lib/checkout/request-security";
import { prismaCheckoutRepository } from "@/lib/repositories/prisma-checkout-repository";
import type { ValidatedCheckoutIntent } from "@/lib/validators/checkout-intent";

const INTENT_RETENTION_DAYS = 30;

export class CheckoutIntentService {
  async enforceRateLimit(clientToken: string): Promise<void> {
    try {
      const config = getCheckoutSecurityConfig();
      const clientKeyHash = hmacCheckoutValue(
        "intent-client-ip",
        clientToken,
        config.ipHashPepper,
      );
      const result = await prismaCheckoutRepository.consumeIntentRateLimit(
        clientKeyHash,
      );
      if (!result.allowed) {
        throw new CheckoutRateLimitedError(result.retryAfterSeconds);
      }
    } catch (error) {
      if (error instanceof CheckoutError) throw error;
      throw new CheckoutServiceUnavailableError();
    }
  }

  async saveIntent(intent: ValidatedCheckoutIntent): Promise<void> {
    try {
      const config = getCheckoutSecurityConfig();
      const tokenHash = hmacCheckoutValue(
        "intent-token",
        intent.token,
        config.idempotencyPepper,
      );
      const expiresAt = new Date(
        Date.now() + INTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      await prismaCheckoutRepository.upsertCheckoutIntent({
        intent,
        tokenHash,
        expiresAt,
      });
    } catch (error) {
      if (error instanceof CheckoutError) throw error;
      throw new CheckoutServiceUnavailableError();
    }
  }
}

export const checkoutIntentService = new CheckoutIntentService();
