export const ERROR_CODES = [
  'auth_failed',
  'not_found',
  'not_yet_submitted',
  'already_pulled',
  'cancelled',
  'validation_failed',
  'quota_exceeded',
  'rate_limited',
  'forbidden',
  'conflict',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: { code: this.code, message: this.message, details: this.details },
    };
  }
}
