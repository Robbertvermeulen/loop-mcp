import { Hono, type Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { signupUser, verifyUserPassword } from '@/auth/users';
import { createSession, deleteSession, SESSION_TTL_MS } from '@/auth/sessions';
import { createApiToken, listApiTokens, revokeApiToken } from '@/auth/tokens';
import { cookieAuth, requireUser, SESSION_COOKIE } from '@/middleware/cookie-auth';
import { AppError } from '@/lib/errors';

export function buildAppApi(db: DB | TestDB) {
  const r = new Hono<{ Variables: { user?: User } }>();
  r.use('*', cookieAuth(db));

  r.post('/signup', async (c) => {
    const body = (await c.req.json()) as { email?: string; password?: string; displayName?: string };
    if (!body.email || !body.password || !body.displayName) {
      throw new AppError('validation_failed', 'email, password, displayName required', 400);
    }
    const user = await signupUser(db, {
      email: body.email,
      password: body.password,
      displayName: body.displayName,
    });
    const { id } = await createSession(db, user.id);
    setSessionCookie(c, id);
    return c.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  r.post('/login', async (c) => {
    const body = (await c.req.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      throw new AppError('validation_failed', 'email and password required', 400);
    }
    const user = await verifyUserPassword(db, body.email, body.password);
    if (!user) throw new AppError('auth_failed', 'Invalid credentials', 401);
    const { id } = await createSession(db, user.id);
    setSessionCookie(c, id);
    return c.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  r.post('/logout', async (c) => {
    const sid = c.req.header('cookie')?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
    if (sid) await deleteSession(db, sid);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  r.get('/me', requireUser(), (c) => {
    const u = c.get('user');
    if (!u) throw new AppError('auth_failed', 'Login required', 401);
    return c.json({ user: { id: u.id, email: u.email, displayName: u.displayName } });
  });

  r.post('/tokens', requireUser(), async (c) => {
    const u = c.get('user');
    if (!u) throw new AppError('auth_failed', 'Login required', 401);
    const body = (await c.req.json()) as { label?: string };
    if (!body.label?.trim()) throw new AppError('validation_failed', 'label required', 400);
    const result = await createApiToken(db, u.id, body.label.trim());
    return c.json(result);
  });

  r.get('/tokens', requireUser(), async (c) => {
    const u = c.get('user');
    if (!u) throw new AppError('auth_failed', 'Login required', 401);
    const tokens = await listApiTokens(db, u.id);
    return c.json({ tokens });
  });

  r.delete('/tokens/:id', requireUser(), async (c) => {
    const u = c.get('user');
    if (!u) throw new AppError('auth_failed', 'Login required', 401);
    await revokeApiToken(db, u.id, c.req.param('id'));
    return c.json({ ok: true });
  });

  return r;
}

function setSessionCookie(c: Context, id: string) {
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}
