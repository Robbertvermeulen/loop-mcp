const NON_ALPHA = /[^a-z0-9]+/g;

export function slugifyTitle(title: string): string {
  const normalized = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(NON_ALPHA, '-')
    .replace(/^-+|-+$/g, '');
  const trimmed = normalized.slice(0, 50).replace(/-+$/, '');
  return trimmed || 'untitled';
}

export function resolveSlugCollision(
  base: string,
  isTaken: (slug: string) => boolean
): string {
  if (!isTaken(base)) return base;
  let n = 2;
  while (isTaken(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
