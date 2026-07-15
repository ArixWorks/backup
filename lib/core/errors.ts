/** Base class for all expected, user-facing domain errors. */
export class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
  ) {
    super(message)
    this.name = "DomainError"
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(message = "Insufficient available balance") {
    super(message, "INSUFFICIENT_FUNDS", 400)
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404)
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Conflicting concurrent operation, retry") {
    super(message, "CONFLICT", 409)
  }
}

export class DomainUnavailableError extends DomainError {
  constructor(message = "این دامنه در بررسی مجدد دیگر آزاد نیست و امکان ثبت آن وجود ندارد.") {
    super(message, "DOMAIN_UNAVAILABLE", 409)
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Validation failed") {
    super(message, "VALIDATION", 422)
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403)
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401)
  }
}

/** Raised when a client exceeds a rate limit. `retryAfter` is in seconds. */
export class TooManyRequestsError extends DomainError {
  constructor(
    message = "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
    public retryAfter = 60,
  ) {
    super(message, "RATE_LIMITED", 429)
  }
}
