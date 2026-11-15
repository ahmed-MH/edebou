import "server-only";

import {
  isApplicationError,
  type PublicErrorCode,
} from "@/lib/errors";

const SUCCESS_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

interface PublicErrorBody {
  readonly error: {
    readonly code: PublicErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

function responseHeaders(requestId: string, cacheControl: string): HeadersInit {
  return {
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  };
}

export function publicJsonResponse<T>(data: T): Response {
  const requestId = crypto.randomUUID();

  return Response.json(
    { data },
    {
      status: 200,
      headers: responseHeaders(requestId, SUCCESS_CACHE_CONTROL),
    },
  );
}

export function publicApiErrorResponse(
  error: unknown,
  operation: string,
): Response {
  const requestId = crypto.randomUUID();

  if (isApplicationError(error)) {
    const body: PublicErrorBody = {
      error: {
        code: error.code,
        message: error.publicMessage,
        requestId,
      },
    };

    return Response.json(body, {
      status: error.status,
      headers: responseHeaders(requestId, "private, no-store"),
    });
  }

  // Keep database messages, SQL and connection details out of both the response
  // and production logs. The request id is enough to correlate future telemetry.
  console.error(`[public-api] ${operation} failed`, { requestId });

  const body: PublicErrorBody = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId,
    },
  };

  return Response.json(body, {
    status: 500,
    headers: responseHeaders(requestId, "private, no-store"),
  });
}
