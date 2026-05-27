import { ulid } from 'ulid';

export function newUlid(): string {
  return ulid();
}

export function newUrlSafeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}
