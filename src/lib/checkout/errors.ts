import "server-only";

export type CheckoutErrorCode =
  | "INVALID_REQUEST"
  | "FORBIDDEN_REQUEST"
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE";

export class CheckoutError extends Error {
  constructor(
    readonly code: CheckoutErrorCode,
    readonly status: 400 | 403 | 409 | 429 | 503,
    readonly publicMessage: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "CheckoutError";
  }
}

export class InvalidCheckoutRequestError extends CheckoutError {
  constructor() {
    super("INVALID_REQUEST", 400, "The order request is invalid.");
  }
}

export class ForbiddenCheckoutRequestError extends CheckoutError {
  constructor() {
    super("FORBIDDEN_REQUEST", 403, "The order request is not allowed.");
  }
}

export class IdempotencyConflictError extends CheckoutError {
  constructor() {
    super(
      "IDEMPOTENCY_CONFLICT",
      409,
      "The idempotency key was already used for another request.",
    );
  }
}

export class OrderUnavailableError extends CheckoutError {
  constructor() {
    super(
      "ORDER_UNAVAILABLE",
      409,
      "One or more products are no longer available in the requested quantity.",
    );
  }
}

export class CheckoutRateLimitedError extends CheckoutError {
  constructor(retryAfterSeconds: number) {
    super(
      "RATE_LIMITED",
      429,
      "Too many order attempts. Please try again later.",
      Math.max(1, Math.ceil(retryAfterSeconds)),
    );
  }
}

export class CheckoutServiceUnavailableError extends CheckoutError {
  constructor() {
    super(
      "SERVICE_UNAVAILABLE",
      503,
      "Order creation is temporarily unavailable.",
    );
  }
}

export function isCheckoutError(error: unknown): error is CheckoutError {
  return error instanceof CheckoutError;
}
