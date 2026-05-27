import type { MiddlewareHandler } from 'hono';
import { AppError } from '@/lib/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function writeRateLimit(opts: { limit: number; windowMs: number }): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `${ip}:${c.req.path}`;
    const nowMs = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt < nowMs) {
      b = { count: 0, resetAt: nowMs + opts.windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > opts.limit) {
      throw new AppError('rate_limited', 'Too many requests', 429, {
        retryAt: b.resetAt,
      });
    }
    await next();
  };
}

export function _resetRateLimitForTests() {
  buckets.clear();
}
