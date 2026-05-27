import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from './users';
import { createApiToken, verifyApiToken, listApiTokens, revokeApiToken, TOKEN_PREFIX } from './tokens';

test('createApiToken returns plain token starting with prefix; verifyApiToken resolves user', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { plain, id } = await createApiToken(db, u.id, 'laptop');
  expect(plain.startsWith(TOKEN_PREFIX)).toBe(true);
  expect(plain.length).toBeGreaterThan(TOKEN_PREFIX.length + 30);
  const result = await verifyApiToken(db, plain);
  expect(result?.user.id).toBe(u.id);
  expect(result?.tokenId).toBe(id);
});

test('verifyApiToken returns null for invalid tokens', async () => {
  const db = await createTestDb();
  expect(await verifyApiToken(db, 'lp_garbage')).toBeNull();
  expect(await verifyApiToken(db, '')).toBeNull();
  expect(await verifyApiToken(db, 'not-a-prefix')).toBeNull();
});

test('listApiTokens returns metadata (no plain token)', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await createApiToken(db, u.id, 'laptop');
  await createApiToken(db, u.id, 'desktop');
  const tokens = await listApiTokens(db, u.id);
  expect(tokens).toHaveLength(2);
  expect(tokens.every((t) => 'tokenHash' in t === false)).toBe(true);
  expect(tokens.map((t) => t.label).sort()).toEqual(['desktop', 'laptop']);
});

test('revokeApiToken removes the row', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { plain, id } = await createApiToken(db, u.id, 'laptop');
  await revokeApiToken(db, u.id, id);
  expect(await verifyApiToken(db, plain)).toBeNull();
});

test('revokeApiToken only revokes own user tokens', async () => {
  const db = await createTestDb();
  const a = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const b = await signupUser(db, { email: 'b@b.c', password: 'hunter2hunter2', displayName: 'B' });
  const { id } = await createApiToken(db, a.id, 'a-token');
  await revokeApiToken(db, b.id, id); // wrong owner — silent no-op
  const stillThere = await listApiTokens(db, a.id);
  expect(stillThere).toHaveLength(1);
});
