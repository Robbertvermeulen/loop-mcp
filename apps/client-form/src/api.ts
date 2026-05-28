import type { Answers, PublicView, ApiErrorBody } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* non-JSON body */
  }
  return new ApiError(
    res.status,
    body?.error.code ?? 'unknown',
    body?.error.message ?? `HTTP ${res.status}`,
    body?.error.details
  );
}

export async function fetchView(token: string): Promise<PublicView> {
  const res = await fetch(`/api/r/${encodeURIComponent(token)}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PublicView;
}

export async function saveDraft(token: string, draft: Answers): Promise<void> {
  const res = await fetch(`/api/r/${encodeURIComponent(token)}/draft`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw await parseError(res);
}

export async function submitFinal(token: string, final: Answers): Promise<void> {
  const res = await fetch(`/api/r/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(final),
  });
  if (!res.ok) throw await parseError(res);
}
