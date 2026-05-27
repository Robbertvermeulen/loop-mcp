import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionUser } from '@/auth/sessions';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'loop_session';

export function cookieAuth(db: DB | TestDB): MiddlewareHandler<{ Variables: { user?: User } }> {
  return async (c, next) => {
    const sid = getCookie(c, SESSION_COOKIE);
    if (sid) {
      const user = await getSessionUser(db, sid);
      if (user) c.set('user', user);
    }
    await next();
  };
}

export function requireUser(): MiddlewareHandler<{ Variables: { user?: User } }> {
  return async (c, next) => {
    if (!c.get('user')) return c.json({ error: { code: 'auth_failed', message: 'Login required' } }, 401);
    await next();
  };
}
