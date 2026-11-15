export type PublicErrorCode =
  | "INVALID_REQUEST"
  | "RESOURCE_NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

/**
 * An error whose status and deliberately generic message are safe to return.
 * Never use a database or third-party error message as `publicMessage`.
 */
export class ApplicationError extends Error {
  constructor(
    readonly code: Exclude<PublicErrorCode, "INTERNAL_ERROR">,
    readonly status: 400 | 404 | 503,
    readonly publicMessage: string,
  ) {
    super(code);
    this.name = "ApplicationError";
  }
}

export class InvalidRequestError extends ApplicationError {
  constructor() {
    super("INVALID_REQUEST", 400, "The request parameters are invalid.");
  }
}

export class ResourceNotFoundError extends ApplicationError {
  constructor() {
    super("RESOURCE_NOT_FOUND", 404, "The requested resource was not found.");
  }
}

export class ServiceUnavailableError extends ApplicationError {
  constructor() {
    super(
      "SERVICE_UNAVAILABLE",
      503,
      "The catalog is temporarily unavailable.",
    );
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}
