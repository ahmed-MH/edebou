import "server-only";

import {
  isCheckoutError,
  type CheckoutErrorCode,
} from "@/lib/checkout/errors";

type CheckoutPublicErrorCode = CheckoutErrorCode | "INTERNAL_ERROR";

interface CheckoutErrorBody {
  readonly error: {
    readonly code: CheckoutPublicErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

function checkoutResponseHeaders(requestId: string): Headers {
  return new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  });
}

export function checkoutSuccessResponse<T>(
  data: T,
  replayed: boolean,
): Response {
  const requestId = crypto.randomUUID();

  return Response.json(
    { data },
    {
      status: replayed ? 200 : 201,
      headers: checkoutResponseHeaders(requestId),
    },
  );
}

export function checkoutErrorResponse(error: unknown): Response {
  const requestId = crypto.randomUUID();

  if (isCheckoutError(error)) {
    const headers = checkoutResponseHeaders(requestId);
    if (error.retryAfterSeconds !== undefined) {
      headers.set("Retry-After", String(error.retryAfterSeconds));
    }

    const body: CheckoutErrorBody = {
      error: {
        code: error.code,
        message: error.publicMessage,
        requestId,
      },
    };

    return Response.json(body, { status: error.status, headers });
  }

  // Never log the request body, customer fields, database message or stack.
  console.error("[checkout-api] create-order failed", { requestId });

  const body: CheckoutErrorBody = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId,
    },
  };

  return Response.json(body, {
    status: 500,
    headers: checkoutResponseHeaders(requestId),
  });
}
