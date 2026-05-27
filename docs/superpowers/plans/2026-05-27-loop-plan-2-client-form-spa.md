# Loop — Plan 2: Client form SPA (Vite + Solid)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the opdrachtgever-facing single-page app served at `/r/:token`. Step-by-step questionnaire UI with autosave, submit, and post-submit edit-until-pulled behavior. Talks only to the public `/api/r/:token/*` endpoints from Plan 1.

**Architecture:** Vite + Solid + TypeScript + Tailwind, built into `apps/client-form/dist/`. The existing Hono server (Plan 1) is extended to serve those static assets at `/r/*`. The SPA reads its token from the URL path, fetches the view from `GET /api/r/:token`, drives a state-machine (load → intro → step1..N → submit → thank-you → optionally re-edit), and autosaves drafts via `PUT /api/r/:token/draft`. All four MVP question types render through a small registry. Visual design decisions during implementation are delegated to the `frontend-design` skill — this plan specifies behavior, contracts, and structure, not visual details.

**Tech Stack:** Bun (root runtime), Vite (build), Solid (UI), TypeScript, Tailwind CSS (utility-first styling), `@solidjs/testing-library` (component tests), Playwright (one E2E test). Bun workspaces to keep `apps/client-form` dependencies separate from the root.

---

## Prerequisites

- Plan 1 backend must be available on the branch this work is based on. The plan assumes commit `313689b` (or its merged equivalent on main) — i.e., 89 backend tests passing.
- This plan creates a new `apps/` directory; the root `tsconfig.json`'s `include: ["src/**/*", "tests/**/*"]` will NOT pick up SPA sources. The SPA has its own `tsconfig.json` and its own type-check command.
- During implementation, **UI/UX work invokes the `frontend-design` skill** (per project preference). Component skeletons in this plan are behavioral specs, not final markup. The implementer must produce real, distinctive UI — not generic AI-looking forms.

## File structure (created or modified by this plan)

```
loop-mcp/
├── package.json              [MODIFY: add workspaces]
├── src/
│   └── server.ts             [MODIFY: serve /r/* statically]
├── apps/
│   └── client-form/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       ├── playwright.config.ts
│       ├── src/
│       │   ├── main.tsx              — Vite entry, mounts App
│       │   ├── App.tsx               — top-level orchestrator (chooses page)
│       │   ├── api.ts                — typed fetch wrappers
│       │   ├── types.ts              — Question/Answer types (mirror server)
│       │   ├── styles.css            — Tailwind directives + globals
│       │   ├── state/
│       │   │   ├── flow.ts           — phase + step + answers signals
│       │   │   ├── autosave.ts       — debounced PUT /draft, retry
│       │   │   └── flow.test.ts
│       │   │   └── autosave.test.ts
│       │   ├── pages/
│       │   │   ├── LoadingPage.tsx
│       │   │   ├── ErrorPage.tsx
│       │   │   ├── ClosedPage.tsx
│       │   │   ├── IntroPage.tsx
│       │   │   ├── QuestionPage.tsx
│       │   │   └── ThankYouPage.tsx
│       │   └── components/
│       │       ├── ProgressBar.tsx
│       │       ├── QuestionRenderer.tsx
│       │       ├── TextShortInput.tsx
│       │       ├── TextLongInput.tsx
│       │       ├── SingleChoiceInput.tsx
│       │       └── MultiChoiceInput.tsx
│       └── e2e/
│           └── happy-path.spec.ts    — Playwright e2e
└── tests/
    └── integration/
        └── static-serving.test.ts    — Hono serves /r/* correctly
```

---

## Phase A — Toolchain setup

### Task 1: Add Bun workspaces + scaffold `apps/client-form`

**Files:**
- Modify: `package.json` (root)
- Create: `apps/client-form/package.json`
- Create: `apps/client-form/tsconfig.json`
- Create: `apps/client-form/vite.config.ts`
- Create: `apps/client-form/index.html`
- Create: `apps/client-form/src/main.tsx`
- Create: `apps/client-form/src/App.tsx`
- Create: `apps/client-form/src/styles.css`

- [ ] **Step 1: Add workspaces entry to root `package.json`**

Add to root `package.json` (alongside the existing top-level keys):

```json
  "workspaces": ["apps/*"],
```

The exact diff: add `"workspaces": ["apps/*"],` immediately after `"private": true,`.

- [ ] **Step 2: Create `apps/client-form/package.json`**

```json
{
  "name": "@loop/client-form",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "bun test src/",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "solid-js": "^1.9.3"
  },
  "devDependencies": {
    "vite": "^6.0.7",
    "vite-plugin-solid": "^2.11.0",
    "typescript": "^5.7.2",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "@solidjs/testing-library": "^0.8.10",
    "@playwright/test": "^1.49.1"
  }
}
```

- [ ] **Step 3: Create `apps/client-form/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "types": ["bun-types", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*", "e2e/**/*"]
}
```

- [ ] **Step 4: Create `apps/client-form/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  base: '/r/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

Note: `base: '/r/'` matters so the generated asset paths are prefixed correctly when served by Hono behind `/r/*`. The dev `proxy` lets you `vite dev` with a backend on port 3000.

- [ ] **Step 5: Create `apps/client-form/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9D%93%3C/text%3E%3C/svg%3E" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `apps/client-form/src/main.tsx`**

```tsx
import { render } from 'solid-js/web';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
render(() => <App />, root);
```

- [ ] **Step 7: Create `apps/client-form/src/App.tsx` (placeholder)**

```tsx
export default function App() {
  return <div class="min-h-screen flex items-center justify-center text-2xl">Loop</div>;
}
```

This will be replaced in later tasks. For now it's a sanity placeholder.

- [ ] **Step 8: Create `apps/client-form/src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
}
```

- [ ] **Step 9: Install dependencies and verify build**

Run from repo root: `bun install`
Expected: workspaces resolved, `apps/client-form/node_modules` (or symlinks) created.

Run: `cd apps/client-form && bun run build`
Expected: produces `apps/client-form/dist/` with `index.html` + assets under `/r/`. Vite may warn about a small bundle — that's fine.

Run: `cd apps/client-form && bun run typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json apps/client-form bun.lock
git commit -m "Scaffold apps/client-form: Vite + Solid + Tailwind workspace"
```

---

### Task 2: Tailwind setup

**Files:**
- Create: `apps/client-form/tailwind.config.js`
- Create: `apps/client-form/postcss.config.js`

- [ ] **Step 1: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 2: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Verify build with Tailwind**

Run: `cd apps/client-form && bun run build`
Expected: succeeds. Open `dist/assets/index-*.css` (or similar) — should contain Tailwind reset (`*,::before,::after`) and utility classes. Not strictly verifiable without manual inspection; the build succeeding is the gate.

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/tailwind.config.js apps/client-form/postcss.config.js
git commit -m "Configure Tailwind CSS for client-form"
```

---

## Phase B — Hono integration

### Task 3: Serve SPA at `/r/*` from Hono

**Files:**
- Modify: `src/server.ts`
- Create: `tests/integration/static-serving.test.ts`

- [ ] **Step 1: Write integration test first**

Create `tests/integration/static-serving.test.ts`:

```ts
import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { buildApp } from '@/server';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

const SPA_DIST = resolve(import.meta.dir, '../../apps/client-form/dist');

function ensureFixtureSpa() {
  // Create a minimal dist if it doesn't exist (CI may not have built it).
  if (!existsSync(SPA_DIST)) {
    mkdirSync(SPA_DIST, { recursive: true });
  }
  if (!existsSync(`${SPA_DIST}/index.html`)) {
    writeFileSync(`${SPA_DIST}/index.html`, '<!doctype html><html><body>TEST_SPA</body></html>');
  }
  const assetDir = `${SPA_DIST}/assets`;
  if (!existsSync(assetDir)) mkdirSync(assetDir, { recursive: true });
  if (!existsSync(`${assetDir}/test.js`)) {
    writeFileSync(`${assetDir}/test.js`, 'console.log("ok")');
  }
}

test('GET /r/:token serves the SPA index.html', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x' });
  const res = await app.request('/r/sometoken');
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain('TEST_SPA');
  expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/);
});

test('GET /r/assets/test.js serves the asset', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x' });
  const res = await app.request('/r/assets/test.js');
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain('console.log');
});

test('GET /r/ (no token) also returns the SPA index.html', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x' });
  const res = await app.request('/r/');
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('TEST_SPA');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/integration/static-serving.test.ts`
Expected: FAIL — `/r/:token` returns 404 or matches no route.

- [ ] **Step 3: Modify `src/server.ts` to mount SPA**

Open `src/server.ts`. Add an import:

```ts
import { serveStatic } from 'hono/bun';
import { resolve } from 'path';
```

Inside `buildApp`, after the existing `app.route('/api/r', ...)` line and before `return app`, add:

```ts
  const SPA_DIST = resolve(import.meta.dir, '../apps/client-form/dist');
  // Asset files like /r/assets/index-*.js
  app.use('/r/assets/*', serveStatic({ root: SPA_DIST.replace(import.meta.dir + '/..', '.'), rewriteRequestPath: (p) => p.replace(/^\/r/, '') }));
  // Other concrete files like /r/favicon.svg (if any)
  // Index fallback for /r/, /r/:token, /r/anything-else
  app.get('/r', (c) => c.redirect('/r/', 302));
  app.get('/r/', async (c) => {
    return serveSpaIndex(c, SPA_DIST);
  });
  app.get('/r/:token', async (c) => {
    return serveSpaIndex(c, SPA_DIST);
  });
```

This handler approach can be brittle with Hono's `serveStatic` API across versions. Use this simpler explicit approach instead — replace the above block with:

```ts
  const SPA_DIST = resolve(import.meta.dir, '../apps/client-form/dist');
  app.get('/r', (c) => c.redirect('/r/', 302));
  // Catch-all under /r/* — read file from dist
  app.get('/r/*', async (c) => {
    const path = c.req.path.replace(/^\/r\//, ''); // '' for /r/, 'sometoken' for /r/sometoken, 'assets/index-*.js' for asset
    return serveSpaPath(SPA_DIST, path);
  });
```

And add this helper at the bottom of `src/server.ts` (before the `if (import.meta.main)` block):

```ts
import { stat } from 'fs/promises';
async function serveSpaPath(spaDist: string, relative: string): Promise<Response> {
  // If asset path with extension (.js, .css, .svg, .png, .ico, .map, .json), try to serve the file.
  const isAsset = /\.[a-z0-9]+$/i.test(relative);
  if (isAsset) {
    const filePath = resolve(spaDist, relative);
    try {
      const s = await stat(filePath);
      if (s.isFile()) {
        const file = Bun.file(filePath);
        const contentType = mimeFor(relative) ?? 'application/octet-stream';
        return new Response(file, { headers: { 'content-type': contentType } });
      }
    } catch {
      return new Response('Not found', { status: 404 });
    }
    return new Response('Not found', { status: 404 });
  }
  // Otherwise serve index.html (SPA fallback).
  const indexPath = resolve(spaDist, 'index.html');
  try {
    const file = Bun.file(indexPath);
    return new Response(file, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch {
    return new Response('SPA not built', { status: 500 });
  }
}

function mimeFor(p: string): string | null {
  if (p.endsWith('.js') || p.endsWith('.mjs')) return 'text/javascript';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.ico')) return 'image/x-icon';
  if (p.endsWith('.map')) return 'application/json';
  if (p.endsWith('.json')) return 'application/json';
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/integration/static-serving.test.ts`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Run full suite + typecheck**

Run: `bun test` (from root)
Expected: previous 89 + 3 = 92 pass, 0 fail.

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts tests/integration/static-serving.test.ts
git commit -m "Serve client-form SPA at /r/* from Hono"
```

---

## Phase C — API client + types

### Task 4: API client module + types

**Files:**
- Create: `apps/client-form/src/types.ts`
- Create: `apps/client-form/src/api.ts`

- [ ] **Step 1: Create `apps/client-form/src/types.ts`**

These types mirror the server's public-facing contract. Keep them in sync if the server changes (no auto-import for now; explicit declaration is OK at Plan 2 scope).

```ts
export type QuestionType = 'text_short' | 'text_long' | 'single_choice' | 'multi_choice';

export type Question =
  | { id: string; type: 'text_short'; prompt: string; required?: boolean; placeholder?: string }
  | { id: string; type: 'text_long'; prompt: string; required?: boolean; placeholder?: string }
  | {
      id: string;
      type: 'single_choice';
      prompt: string;
      required?: boolean;
      options: string[];
      allowOther?: boolean;
    }
  | {
      id: string;
      type: 'multi_choice';
      prompt: string;
      required?: boolean;
      options: string[];
      minSelections?: number;
      maxSelections?: number;
    };

export type SingleChoiceAnswer = { value: string; other?: string };
export type MultiChoiceAnswer = { values: string[] };
export type Answer = string | SingleChoiceAnswer | MultiChoiceAnswer;

export type Answers = Record<string, Answer>;

export type RequestStatus = 'pending' | 'submitted' | 'pulled' | 'cancelled';

export interface PublicView {
  displayName: string;
  projectName?: string;
  title: string;
  intro?: string;
  questions: Question[];
  draftAnswers?: Answers;
  status: 'pending' | 'submitted';
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

- [ ] **Step 2: Create `apps/client-form/src/api.ts`**

```ts
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
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/client-form && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/src/types.ts apps/client-form/src/api.ts
git commit -m "Add client-form API client + types"
```

---

## Phase D — Flow state machine + autosave

### Task 5: Flow state machine

**Files:**
- Create: `apps/client-form/src/state/flow.ts`
- Create: `apps/client-form/src/state/flow.test.ts`

- [ ] **Step 1: Write tests `state/flow.test.ts`**

```ts
import { test, expect } from 'bun:test';
import { createFlow, type FlowPhase } from './flow';
import type { PublicView } from '../types';

const view: PublicView = {
  displayName: 'Robbert',
  title: 'Test',
  questions: [
    { id: 'q1', type: 'text_short', prompt: 'q1?', required: true },
    { id: 'q2', type: 'single_choice', prompt: 'q2?', options: ['a', 'b'], required: true },
  ],
  status: 'pending',
};

test('createFlow starts in intro phase with empty answers (no draft)', () => {
  const f = createFlow(view);
  expect(f.phase()).toBe('intro' as FlowPhase);
  expect(f.stepIndex()).toBe(0);
  expect(f.answers()).toEqual({});
});

test('createFlow seeds answers from draftAnswers when provided', () => {
  const f = createFlow({ ...view, draftAnswers: { q1: 'hello' } });
  expect(f.answers()).toEqual({ q1: 'hello' });
});

test('start() moves to question phase at step 0', () => {
  const f = createFlow(view);
  f.start();
  expect(f.phase()).toBe('question' as FlowPhase);
  expect(f.stepIndex()).toBe(0);
});

test('setAnswer updates the signal', () => {
  const f = createFlow(view);
  f.start();
  f.setAnswer('q1', 'value');
  expect(f.answers()).toEqual({ q1: 'value' });
});

test('next() advances; final next moves to submit phase', () => {
  const f = createFlow(view);
  f.start();
  expect(f.stepIndex()).toBe(0);
  f.next();
  expect(f.stepIndex()).toBe(1);
  f.next();
  expect(f.phase()).toBe('submit' as FlowPhase);
});

test('prev() goes back; from step 0, prev() goes back to intro', () => {
  const f = createFlow(view);
  f.start();
  f.next();
  expect(f.stepIndex()).toBe(1);
  f.prev();
  expect(f.stepIndex()).toBe(0);
  f.prev();
  expect(f.phase()).toBe('intro' as FlowPhase);
});

test('canAdvance: required text answer must be non-empty string', () => {
  const f = createFlow(view);
  f.start();
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q1', '');
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q1', 'hi');
  expect(f.canAdvance()).toBe(true);
});

test('canAdvance: optional text answer always allows advance', () => {
  const f = createFlow({
    ...view,
    questions: [{ id: 'q', type: 'text_short', prompt: 'q?' }],
  });
  f.start();
  expect(f.canAdvance()).toBe(true);
});

test('canAdvance: required single_choice needs .value', () => {
  const f = createFlow({
    ...view,
    questions: [{ id: 'q', type: 'single_choice', prompt: 'q?', options: ['a', 'b'], required: true }],
  });
  f.start();
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q', { value: 'a' });
  expect(f.canAdvance()).toBe(true);
});

test('canAdvance: multi_choice respects minSelections', () => {
  const f = createFlow({
    ...view,
    questions: [{ id: 'q', type: 'multi_choice', prompt: 'q?', options: ['a', 'b', 'c'], minSelections: 2 }],
  });
  f.start();
  f.setAnswer('q', { values: ['a'] });
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q', { values: ['a', 'b'] });
  expect(f.canAdvance()).toBe(true);
});

test('markSubmitted moves phase to thankYou', () => {
  const f = createFlow(view);
  f.start();
  f.markSubmitted();
  expect(f.phase()).toBe('thankYou' as FlowPhase);
});

test('reopen from thankYou returns to question at step 0', () => {
  const f = createFlow(view);
  f.start();
  f.markSubmitted();
  f.reopen();
  expect(f.phase()).toBe('question' as FlowPhase);
  expect(f.stepIndex()).toBe(0);
});
```

- [ ] **Step 2: Implement `state/flow.ts`**

```ts
import { createSignal } from 'solid-js';
import type { PublicView, Question, Answer, Answers } from '../types';

export type FlowPhase = 'intro' | 'question' | 'submit' | 'thankYou';

export interface Flow {
  questions: Question[];
  phase: () => FlowPhase;
  stepIndex: () => number;
  answers: () => Answers;
  currentQuestion: () => Question | null;
  start: () => void;
  next: () => void;
  prev: () => void;
  setAnswer: (id: string, value: Answer) => void;
  canAdvance: () => boolean;
  markSubmitted: () => void;
  reopen: () => void;
}

export function createFlow(view: PublicView): Flow {
  const [phase, setPhase] = createSignal<FlowPhase>('intro');
  const [stepIndex, setStepIndex] = createSignal(0);
  const [answers, setAnswers] = createSignal<Answers>(view.draftAnswers ?? {});

  const questions = view.questions;

  const currentQuestion = () => {
    const i = stepIndex();
    return questions[i] ?? null;
  };

  const start = () => {
    setPhase('question');
    setStepIndex(0);
  };

  const setAnswer = (id: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const next = () => {
    if (phase() !== 'question') return;
    const i = stepIndex();
    if (i < questions.length - 1) {
      setStepIndex(i + 1);
    } else {
      setPhase('submit');
    }
  };

  const prev = () => {
    if (phase() !== 'question') return;
    const i = stepIndex();
    if (i > 0) setStepIndex(i - 1);
    else setPhase('intro');
  };

  const canAdvance = () => {
    const q = currentQuestion();
    if (!q) return false;
    const a = answers()[q.id];
    return isAnswerSufficient(q, a);
  };

  const markSubmitted = () => setPhase('thankYou');

  const reopen = () => {
    setPhase('question');
    setStepIndex(0);
  };

  return {
    questions,
    phase,
    stepIndex,
    answers,
    currentQuestion,
    start,
    next,
    prev,
    setAnswer,
    canAdvance,
    markSubmitted,
    reopen,
  };
}

function isAnswerSufficient(q: Question, a: Answer | undefined): boolean {
  if (!q.required) return true;
  if (a === undefined) return false;
  switch (q.type) {
    case 'text_short':
    case 'text_long':
      return typeof a === 'string' && a.trim().length > 0;
    case 'single_choice': {
      if (typeof a !== 'object' || Array.isArray(a)) return false;
      const sc = a as { value?: unknown };
      return typeof sc.value === 'string' && sc.value.length > 0;
    }
    case 'multi_choice': {
      if (typeof a !== 'object' || Array.isArray(a)) return false;
      const mc = a as { values?: unknown };
      if (!Array.isArray(mc.values)) return false;
      const min = q.minSelections ?? 1;
      return mc.values.length >= min;
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/client-form && bun test src/state/flow.test.ts`
Expected: 11 pass 0 fail.

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/src/state/flow.ts apps/client-form/src/state/flow.test.ts
git commit -m "Add client-form flow state machine"
```

---

### Task 6: Autosave with debounce

**Files:**
- Create: `apps/client-form/src/state/autosave.ts`
- Create: `apps/client-form/src/state/autosave.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { test, expect } from 'bun:test';
import { createAutosave } from './autosave';
import type { Answers } from '../types';

function tick(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

test('autosave debounces multiple rapid changes into one save', async () => {
  const calls: Answers[] = [];
  const save = async (a: Answers) => {
    calls.push(a);
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 50 });
  auto.schedule({ q1: 'a' });
  auto.schedule({ q1: 'ab' });
  auto.schedule({ q1: 'abc' });
  await tick(80);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({ q1: 'abc' });
});

test('autosave waiting state reflects pending save', async () => {
  const save = async () => {
    await tick(40);
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 20 });
  expect(auto.status()).toBe('idle');
  auto.schedule({ q1: 'x' });
  expect(auto.status()).toBe('pending');
  await tick(30);
  expect(auto.status()).toBe('saving');
  await tick(50);
  expect(auto.status()).toBe('idle');
});

test('autosave retries on transient failure', async () => {
  let calls = 0;
  const save = async () => {
    calls += 1;
    if (calls < 3) throw new Error('transient');
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 10, retryMs: 20, maxRetries: 5 });
  auto.schedule({ q1: 'x' });
  await tick(150);
  expect(calls).toBeGreaterThanOrEqual(3);
  expect(auto.status()).toBe('idle');
});

test('autosave goes to error status after max retries', async () => {
  const save = async () => {
    throw new Error('persistent');
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 10, retryMs: 10, maxRetries: 2 });
  auto.schedule({ q1: 'x' });
  await tick(100);
  expect(auto.status()).toBe('error');
});

test('flush() forces an immediate save (no debounce wait)', async () => {
  const calls: Answers[] = [];
  const save = async (a: Answers) => {
    calls.push(a);
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 200 });
  auto.schedule({ q1: 'x' });
  await auto.flush();
  expect(calls).toEqual([{ q1: 'x' }]);
});
```

- [ ] **Step 2: Implement `state/autosave.ts`**

```ts
import { createSignal } from 'solid-js';
import type { Answers } from '../types';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface AutosaveOpts {
  saveFn: (data: Answers) => Promise<void>;
  debounceMs?: number;
  retryMs?: number;
  maxRetries?: number;
}

export interface Autosave {
  schedule: (data: Answers) => void;
  flush: () => Promise<void>;
  status: () => AutosaveStatus;
}

export function createAutosave(opts: AutosaveOpts): Autosave {
  const debounceMs = opts.debounceMs ?? 800;
  const retryMs = opts.retryMs ?? 1000;
  const maxRetries = opts.maxRetries ?? 3;

  const [status, setStatus] = createSignal<AutosaveStatus>('idle');
  let pendingData: Answers | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving = false;

  const schedule = (data: Answers) => {
    pendingData = data;
    setStatus('pending');
    if (timer) clearTimeout(timer);
    timer = setTimeout(runSave, debounceMs);
  };

  async function runSave() {
    if (saving) return;
    if (pendingData === null) return;
    saving = true;
    setStatus('saving');
    let attempt = 0;
    while (attempt <= maxRetries) {
      const dataToSave = pendingData;
      try {
        await opts.saveFn(dataToSave);
        // Only clear if no newer data was scheduled while saving
        if (pendingData === dataToSave) {
          pendingData = null;
          setStatus('idle');
        } else {
          setStatus('pending');
          if (timer) clearTimeout(timer);
          timer = setTimeout(runSave, debounceMs);
        }
        saving = false;
        return;
      } catch {
        attempt += 1;
        if (attempt > maxRetries) {
          setStatus('error');
          saving = false;
          return;
        }
        await new Promise((r) => setTimeout(r, retryMs));
      }
    }
    saving = false;
  }

  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await runSave();
  };

  return { schedule, flush, status };
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/client-form && bun test src/state/autosave.test.ts`
Expected: 5 pass 0 fail.

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/src/state/autosave.ts apps/client-form/src/state/autosave.test.ts
git commit -m "Add client-form autosave with debounce + retry"
```

---

## Phase E — Question components

The component tasks (7–11) intentionally specify **behavior contracts**, not final markup. Each component must implement the listed props/events and pass the listed assertions. The implementer invokes the `frontend-design` skill to design the visual presentation (typography, layout, focus states, animations).

### Task 7: TextShort + TextLong inputs

**Files:**
- Create: `apps/client-form/src/components/TextShortInput.tsx`
- Create: `apps/client-form/src/components/TextLongInput.tsx`

- [ ] **Step 1: Implement `TextShortInput.tsx`**

The component must:
- Accept props: `value: string`, `placeholder?: string`, `prompt: string`, `onChange: (v: string) => void`, `autofocus?: boolean`.
- Render a single-line `<input type="text">` with the current value.
- Call `onChange` on every keystroke (`input` event).
- Render the prompt visibly above the input.
- Apply `autofocus` if true.
- Apply Tailwind classes for an elegant, distinctive look — **use `/frontend-design` skill** to design the visual treatment.

Reference skeleton (behavior only — finalize markup with frontend-design):

```tsx
interface TextShortInputProps {
  prompt: string;
  value: string;
  placeholder?: string;
  autofocus?: boolean;
  onChange: (v: string) => void;
}

export default function TextShortInput(props: TextShortInputProps) {
  return (
    <div>
      <label class="block">
        <span>{props.prompt}</span>
        <input
          type="text"
          class="w-full"
          value={props.value}
          placeholder={props.placeholder}
          autofocus={props.autofocus}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Implement `TextLongInput.tsx`**

Same as TextShortInput but renders a `<textarea>` with auto-grow disabled (fixed rows="5" or similar). Final visual treatment via `frontend-design` skill.

```tsx
interface TextLongInputProps {
  prompt: string;
  value: string;
  placeholder?: string;
  autofocus?: boolean;
  onChange: (v: string) => void;
}

export default function TextLongInput(props: TextLongInputProps) {
  return (
    <div>
      <label class="block">
        <span>{props.prompt}</span>
        <textarea
          class="w-full"
          rows={5}
          value={props.value}
          placeholder={props.placeholder}
          autofocus={props.autofocus}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/client-form && bun run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/src/components/TextShortInput.tsx apps/client-form/src/components/TextLongInput.tsx
git commit -m "Add TextShort + TextLong question components (behavior skeleton)"
```

---

### Task 8: SingleChoice input

**Files:**
- Create: `apps/client-form/src/components/SingleChoiceInput.tsx`

- [ ] **Step 1: Implement `SingleChoiceInput.tsx`**

Behavior:
- Props: `prompt: string`, `options: string[]`, `allowOther?: boolean`, `value: { value: string; other?: string } | undefined`, `onChange: (v: { value: string; other?: string }) => void`.
- Render the prompt + a radio group of options.
- If `allowOther` is true, render an "Other" radio option that reveals a text input. When selected, the input must be focusable and bound to `value.other`.
- Call `onChange` with `{ value: option }` or `{ value: '__other__', other: typed }`.

Reference skeleton — finalize markup with `frontend-design` skill:

```tsx
import { createSignal, For, Show } from 'solid-js';

interface SingleChoiceInputProps {
  prompt: string;
  options: string[];
  allowOther?: boolean;
  value?: { value: string; other?: string };
  onChange: (v: { value: string; other?: string }) => void;
}

const OTHER = '__other__';

export default function SingleChoiceInput(props: SingleChoiceInputProps) {
  const [otherText, setOtherText] = createSignal(props.value?.other ?? '');
  const selected = () => props.value?.value;

  function pick(v: string) {
    if (v === OTHER) {
      props.onChange({ value: OTHER, other: otherText() });
    } else {
      props.onChange({ value: v });
    }
  }

  function updateOther(t: string) {
    setOtherText(t);
    props.onChange({ value: OTHER, other: t });
  }

  return (
    <div>
      <p>{props.prompt}</p>
      <div role="radiogroup">
        <For each={props.options}>
          {(opt) => (
            <label>
              <input
                type="radio"
                name="single-choice"
                value={opt}
                checked={selected() === opt}
                onChange={() => pick(opt)}
              />
              <span>{opt}</span>
            </label>
          )}
        </For>
        <Show when={props.allowOther}>
          <label>
            <input
              type="radio"
              name="single-choice"
              value={OTHER}
              checked={selected() === OTHER}
              onChange={() => pick(OTHER)}
            />
            <span>Other</span>
          </label>
          <Show when={selected() === OTHER}>
            <input
              type="text"
              value={otherText()}
              onInput={(e) => updateOther(e.currentTarget.value)}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client-form/src/components/SingleChoiceInput.tsx
git commit -m "Add SingleChoice question component (behavior skeleton)"
```

---

### Task 9: MultiChoice input

**Files:**
- Create: `apps/client-form/src/components/MultiChoiceInput.tsx`

- [ ] **Step 1: Implement `MultiChoiceInput.tsx`**

Behavior:
- Props: `prompt: string`, `options: string[]`, `minSelections?: number`, `maxSelections?: number`, `value: { values: string[] } | undefined`, `onChange: (v: { values: string[] }) => void`.
- Render the prompt + a checkbox group.
- Enforce `maxSelections`: when reached, unchecked options should be visually disabled or simply not allow more selections (calling `onChange` with the new set is fine — flow.canAdvance() handles max enforcement separately).
- Selected values are added/removed from the array on each toggle.

Reference skeleton:

```tsx
import { For } from 'solid-js';

interface MultiChoiceInputProps {
  prompt: string;
  options: string[];
  minSelections?: number;
  maxSelections?: number;
  value?: { values: string[] };
  onChange: (v: { values: string[] }) => void;
}

export default function MultiChoiceInput(props: MultiChoiceInputProps) {
  const values = () => props.value?.values ?? [];

  function toggle(option: string) {
    const current = values();
    if (current.includes(option)) {
      props.onChange({ values: current.filter((v) => v !== option) });
    } else {
      if (props.maxSelections !== undefined && current.length >= props.maxSelections) return;
      props.onChange({ values: [...current, option] });
    }
  }

  return (
    <div>
      <p>{props.prompt}</p>
      <div>
        <For each={props.options}>
          {(opt) => (
            <label>
              <input
                type="checkbox"
                checked={values().includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          )}
        </For>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client-form/src/components/MultiChoiceInput.tsx
git commit -m "Add MultiChoice question component (behavior skeleton)"
```

---

### Task 10: QuestionRenderer dispatcher

**Files:**
- Create: `apps/client-form/src/components/QuestionRenderer.tsx`

- [ ] **Step 1: Implement `QuestionRenderer.tsx`**

```tsx
import { Match, Switch } from 'solid-js';
import type { Question, Answer } from '../types';
import TextShortInput from './TextShortInput';
import TextLongInput from './TextLongInput';
import SingleChoiceInput from './SingleChoiceInput';
import MultiChoiceInput from './MultiChoiceInput';

interface QuestionRendererProps {
  question: Question;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  autofocus?: boolean;
}

export default function QuestionRenderer(props: QuestionRendererProps) {
  return (
    <Switch>
      <Match when={props.question.type === 'text_short'}>
        <TextShortInput
          prompt={props.question.prompt}
          placeholder={(props.question as Extract<Question, { type: 'text_short' }>).placeholder}
          value={(props.value as string) ?? ''}
          autofocus={props.autofocus}
          onChange={(v) => props.onChange(v)}
        />
      </Match>
      <Match when={props.question.type === 'text_long'}>
        <TextLongInput
          prompt={props.question.prompt}
          placeholder={(props.question as Extract<Question, { type: 'text_long' }>).placeholder}
          value={(props.value as string) ?? ''}
          autofocus={props.autofocus}
          onChange={(v) => props.onChange(v)}
        />
      </Match>
      <Match when={props.question.type === 'single_choice'}>
        {(() => {
          const q = props.question as Extract<Question, { type: 'single_choice' }>;
          return (
            <SingleChoiceInput
              prompt={q.prompt}
              options={q.options}
              allowOther={q.allowOther}
              value={props.value as { value: string; other?: string } | undefined}
              onChange={(v) => props.onChange(v)}
            />
          );
        })()}
      </Match>
      <Match when={props.question.type === 'multi_choice'}>
        {(() => {
          const q = props.question as Extract<Question, { type: 'multi_choice' }>;
          return (
            <MultiChoiceInput
              prompt={q.prompt}
              options={q.options}
              minSelections={q.minSelections}
              maxSelections={q.maxSelections}
              value={props.value as { values: string[] } | undefined}
              onChange={(v) => props.onChange(v)}
            />
          );
        })()}
      </Match>
    </Switch>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/client-form && bun run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/client-form/src/components/QuestionRenderer.tsx
git commit -m "Add QuestionRenderer dispatcher"
```

---

### Task 11: ProgressBar

**Files:**
- Create: `apps/client-form/src/components/ProgressBar.tsx`

- [ ] **Step 1: Implement**

```tsx
interface ProgressBarProps {
  current: number; // 1-indexed
  total: number;
}

export default function ProgressBar(props: ProgressBarProps) {
  const pct = () => (props.total === 0 ? 0 : Math.round((props.current / props.total) * 100));
  return (
    <div class="w-full h-1 bg-neutral-200">
      <div class="h-1 bg-black transition-all" style={{ width: `${pct()}%` }} />
    </div>
  );
}
```

Final visual treatment: `frontend-design` skill at integration time.

- [ ] **Step 2: Commit**

```bash
git add apps/client-form/src/components/ProgressBar.tsx
git commit -m "Add ProgressBar component (behavior skeleton)"
```

---

## Phase F — Pages

### Task 12: Loading, Error, Closed pages

**Files:**
- Create: `apps/client-form/src/pages/LoadingPage.tsx`
- Create: `apps/client-form/src/pages/ErrorPage.tsx`
- Create: `apps/client-form/src/pages/ClosedPage.tsx`

Each page is a stateless component. Final design: `frontend-design` skill at integration.

- [ ] **Step 1: Create `LoadingPage.tsx`**

```tsx
export default function LoadingPage() {
  return (
    <div class="min-h-screen flex items-center justify-center">
      <p>Loading…</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `ErrorPage.tsx`**

Props: `message: string`, optional `code?: string`. Renders a friendly error UI. Used for unexpected failures (network, 5xx, etc.) and a generic 404 token.

```tsx
interface ErrorPageProps {
  message: string;
  code?: string;
}

export default function ErrorPage(props: ErrorPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 class="text-2xl">Something went wrong</h1>
      <p class="mt-4">{props.message}</p>
      {props.code && <p class="mt-2 text-sm text-neutral-500">Code: {props.code}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create `ClosedPage.tsx`**

Renders the "this questionnaire is closed" view (status='pulled' or 'cancelled' from server, or 404 on unknown token). Three variants via the `reason` prop.

```tsx
interface ClosedPageProps {
  reason: 'pulled' | 'cancelled' | 'not_found';
}

export default function ClosedPage(props: ClosedPageProps) {
  const message = () => {
    switch (props.reason) {
      case 'pulled':
        return 'This questionnaire has been completed and processed.';
      case 'cancelled':
        return 'This questionnaire was cancelled.';
      case 'not_found':
        return 'This link is invalid or has expired.';
    }
  };
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 class="text-2xl">Link closed</h1>
      <p class="mt-4">{message()}</p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/src/pages/LoadingPage.tsx apps/client-form/src/pages/ErrorPage.tsx apps/client-form/src/pages/ClosedPage.tsx
git commit -m "Add Loading/Error/Closed page skeletons"
```

---

### Task 13: IntroPage + QuestionPage + ThankYouPage

**Files:**
- Create: `apps/client-form/src/pages/IntroPage.tsx`
- Create: `apps/client-form/src/pages/QuestionPage.tsx`
- Create: `apps/client-form/src/pages/ThankYouPage.tsx`

- [ ] **Step 1: Create `IntroPage.tsx`**

Props: `displayName: string`, `projectName?: string`, `title: string`, `intro?: string` (markdown — render as plain text for MVP; markdown rendering deferred), `questionCount: number`, `onStart: () => void`.

```tsx
interface IntroPageProps {
  displayName: string;
  projectName?: string;
  title: string;
  intro?: string;
  questionCount: number;
  onStart: () => void;
}

export default function IntroPage(props: IntroPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
      <p class="text-sm text-neutral-500">
        {props.displayName}
        {props.projectName ? ` — ${props.projectName}` : ''}
      </p>
      <h1 class="text-3xl mt-2">{props.title}</h1>
      {props.intro && <p class="mt-4 whitespace-pre-wrap">{props.intro}</p>}
      <p class="mt-6 text-sm text-neutral-500">
        {props.questionCount} {props.questionCount === 1 ? 'question' : 'questions'}
      </p>
      <button class="mt-8 px-6 py-3 bg-black text-white" onClick={props.onStart}>
        Start
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `QuestionPage.tsx`**

Props: `current: number` (1-indexed), `total: number`, `question: Question`, `value: Answer | undefined`, `onChange: (v: Answer) => void`, `onNext: () => void`, `onPrev: () => void`, `canAdvance: boolean`, `autosaveStatus: AutosaveStatus`.

```tsx
import type { Question, Answer } from '../types';
import type { AutosaveStatus } from '../state/autosave';
import QuestionRenderer from '../components/QuestionRenderer';
import ProgressBar from '../components/ProgressBar';

interface QuestionPageProps {
  current: number;
  total: number;
  question: Question;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  onNext: () => void;
  onPrev: () => void;
  canAdvance: boolean;
  autosaveStatus: AutosaveStatus;
}

export default function QuestionPage(props: QuestionPageProps) {
  return (
    <div class="min-h-screen flex flex-col">
      <ProgressBar current={props.current} total={props.total} />
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="w-full max-w-xl">
          <p class="text-sm text-neutral-500">
            Question {props.current} of {props.total}
          </p>
          <div class="mt-4">
            <QuestionRenderer
              question={props.question}
              value={props.value}
              onChange={props.onChange}
              autofocus
            />
          </div>
          <div class="mt-8 flex items-center justify-between">
            <button class="text-sm" onClick={props.onPrev}>
              Back
            </button>
            <div class="text-xs text-neutral-500">
              {props.autosaveStatus === 'saving' || props.autosaveStatus === 'pending'
                ? 'Saving…'
                : props.autosaveStatus === 'error'
                ? 'Save failed — will retry'
                : 'Saved'}
            </div>
            <button
              class="px-6 py-3 bg-black text-white disabled:opacity-30"
              disabled={!props.canAdvance}
              onClick={props.onNext}
            >
              {props.current === props.total ? 'Review' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `ThankYouPage.tsx`**

Props: `displayName: string`, `onReopen: () => void`. Renders confirmation + "edit answers" button (only meaningful while not pulled — clicking it triggers reopen which puts the flow back into question mode).

```tsx
interface ThankYouPageProps {
  displayName: string;
  onReopen: () => void;
}

export default function ThankYouPage(props: ThankYouPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 class="text-3xl">Thank you</h1>
      <p class="mt-4">Your answers have been sent to {props.displayName}.</p>
      <p class="mt-2 text-sm text-neutral-500">
        You can still adjust them until they read your response.
      </p>
      <button class="mt-8 underline" onClick={props.onReopen}>
        Edit answers
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/src/pages/IntroPage.tsx apps/client-form/src/pages/QuestionPage.tsx apps/client-form/src/pages/ThankYouPage.tsx
git commit -m "Add Intro/Question/ThankYou page skeletons"
```

---

## Phase G — App orchestrator + wiring

### Task 14: App.tsx orchestrator (loads view, drives flow)

**Files:**
- Modify: `apps/client-form/src/App.tsx`

- [ ] **Step 1: Replace `App.tsx` with the orchestrator**

```tsx
import { createResource, createSignal, createEffect, Show, Switch, Match } from 'solid-js';
import { fetchView, saveDraft, submitFinal, ApiError } from './api';
import type { Answer, Answers, PublicView } from './types';
import { createFlow } from './state/flow';
import { createAutosave } from './state/autosave';
import LoadingPage from './pages/LoadingPage';
import ErrorPage from './pages/ErrorPage';
import ClosedPage from './pages/ClosedPage';
import IntroPage from './pages/IntroPage';
import QuestionPage from './pages/QuestionPage';
import ThankYouPage from './pages/ThankYouPage';

function tokenFromUrl(): string {
  // URL pattern: /r/<token> — extract the segment after /r/.
  const path = window.location.pathname;
  const m = path.match(/^\/r\/([^/]*)/);
  return m?.[1] ?? '';
}

export default function App() {
  const token = tokenFromUrl();

  const [view] = createResource<PublicView | { closed: 'pulled' | 'cancelled' | 'not_found' } | { error: string; code?: string }>(
    () => token,
    async (t) => {
      if (!t) return { closed: 'not_found' as const };
      try {
        return await fetchView(t);
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.status === 410 && e.code === 'already_pulled') return { closed: 'pulled' as const };
          if (e.status === 410 && e.code === 'cancelled') return { closed: 'cancelled' as const };
          if (e.status === 404) return { closed: 'not_found' as const };
          return { error: e.message, code: e.code };
        }
        return { error: 'Network error' };
      }
    }
  );

  return (
    <Switch fallback={<LoadingPage />}>
      <Match when={view.loading}>
        <LoadingPage />
      </Match>
      <Match when={view() && 'closed' in (view() as object)}>
        <ClosedPage reason={(view() as { closed: 'pulled' | 'cancelled' | 'not_found' }).closed} />
      </Match>
      <Match when={view() && 'error' in (view() as object)}>
        <ErrorPage
          message={(view() as { error: string }).error}
          code={(view() as { code?: string }).code}
        />
      </Match>
      <Match when={view() && 'questions' in (view() as object)}>
        <Running view={view() as PublicView} token={token} />
      </Match>
    </Switch>
  );
}

function Running(props: { view: PublicView; token: string }) {
  const flow = createFlow(props.view);
  const auto = createAutosave({
    saveFn: async (data: Answers) => {
      await saveDraft(props.token, data);
    },
    debounceMs: 800,
  });

  createEffect(() => {
    // schedule autosave when answers change AND we're in question phase (avoid saving on first render)
    const phase = flow.phase();
    if (phase === 'question') {
      auto.schedule(flow.answers());
    }
  });

  const handleChange = (id: string) => (v: Answer) => {
    flow.setAnswer(id, v);
  };

  const handleSubmit = async () => {
    await auto.flush();
    try {
      await submitFinal(props.token, flow.answers());
      flow.markSubmitted();
    } catch (e) {
      // Re-throw to bubble up; for MVP just alert
      alert(e instanceof Error ? e.message : 'Submission failed');
    }
  };

  return (
    <Switch>
      <Match when={flow.phase() === 'intro'}>
        <IntroPage
          displayName={props.view.displayName}
          projectName={props.view.projectName}
          title={props.view.title}
          intro={props.view.intro}
          questionCount={props.view.questions.length}
          onStart={() => flow.start()}
        />
      </Match>
      <Match when={flow.phase() === 'question'}>
        <Show when={flow.currentQuestion()}>
          {(q) => (
            <QuestionPage
              current={flow.stepIndex() + 1}
              total={props.view.questions.length}
              question={q()}
              value={flow.answers()[q().id]}
              onChange={handleChange(q().id)}
              onNext={() => flow.next()}
              onPrev={() => flow.prev()}
              canAdvance={flow.canAdvance()}
              autosaveStatus={auto.status()}
            />
          )}
        </Show>
      </Match>
      <Match when={flow.phase() === 'submit'}>
        <div class="min-h-screen flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
          <h1 class="text-2xl">Ready to send?</h1>
          <p class="mt-4 text-sm text-neutral-500">
            {Object.keys(flow.answers()).length} of {props.view.questions.length} answered
          </p>
          <div class="mt-8 flex gap-4">
            <button onClick={() => flow.prev()}>Back</button>
            <button class="px-6 py-3 bg-black text-white" onClick={handleSubmit}>
              Send answers
            </button>
          </div>
        </div>
      </Match>
      <Match when={flow.phase() === 'thankYou'}>
        <ThankYouPage displayName={props.view.displayName} onReopen={() => flow.reopen()} />
      </Match>
    </Switch>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `cd apps/client-form && bun run typecheck`
Expected: clean.

Run: `cd apps/client-form && bun run build`
Expected: produces `dist/` with bundled assets.

- [ ] **Step 3: Commit**

```bash
git add apps/client-form/src/App.tsx
git commit -m "Wire App.tsx orchestrator: load view → flow → submit"
```

---

## Phase H — Visual polish (delegated to frontend-design skill)

### Task 15: Apply frontend-design pass to all UI components

**Files:**
- Modify: All components and pages under `apps/client-form/src/components/` and `apps/client-form/src/pages/`

This task is intentionally **delegated to the `frontend-design` skill**. The implementer must:

- [ ] **Step 1: Invoke the `frontend-design` skill**

The current components are behavior-correct skeletons. They use minimal Tailwind. The `frontend-design` skill produces distinctive, production-grade UI that avoids generic AI aesthetics. Run it with this context:

> "I need a distinctive, elegant visual design for a step-by-step questionnaire web form. The form is the public-facing surface of the Loop service — a non-developer (e.g., a client of a software developer) opens a link, reads an intro, answers questions one at a time, and submits. Skeletons exist at `apps/client-form/src/components/` and `apps/client-form/src/pages/`. Use Tailwind. Aim for: confident typography, generous spacing, sensible focus states, a quiet but warm color palette, smooth transitions between steps, and a finishing touch that feels considered (e.g., subtle motion on advance). Don't fight the existing component props/contracts — apply the visual layer."

- [ ] **Step 2: Verify build + run dev preview**

Run: `cd apps/client-form && bun run build`
Expected: build succeeds.

Optional manual smoke:
- Start backend: from repo root, `bun run dev`
- Start SPA dev: from `apps/client-form`, `bun run dev` (port 5173, proxies API to 3000)
- Open `http://localhost:5173/r/SOMETOKEN` — should show "Loading…" then likely an error since SOMETOKEN doesn't exist; that's fine for smoke.

- [ ] **Step 3: Commit**

```bash
git add apps/client-form/src
git commit -m "Apply frontend-design pass to client-form UI"
```

---

## Phase I — Tests

### Task 16: Component tests with @solidjs/testing-library

**Files:**
- Create: `apps/client-form/src/components/SingleChoiceInput.test.tsx`
- Create: `apps/client-form/src/components/MultiChoiceInput.test.tsx`

- [ ] **Step 1: Component test for SingleChoiceInput**

```tsx
import { test, expect } from 'bun:test';
import { render, fireEvent } from '@solidjs/testing-library';
import SingleChoiceInput from './SingleChoiceInput';

test('SingleChoiceInput emits onChange with selected option', () => {
  const calls: Array<{ value: string; other?: string }> = [];
  const { getByLabelText } = render(() => (
    <SingleChoiceInput
      prompt="Pick one"
      options={['Red', 'Blue']}
      onChange={(v) => calls.push(v)}
    />
  ));
  fireEvent.click(getByLabelText('Red'));
  expect(calls).toContainEqual({ value: 'Red' });
});

test('SingleChoiceInput allowOther shows text input only when Other selected', () => {
  const { getByLabelText, queryByRole } = render(() => (
    <SingleChoiceInput
      prompt="Pick one"
      options={['Red']}
      allowOther
      onChange={() => {}}
    />
  ));
  // Initially no text input visible
  expect(queryByRole('textbox')).toBeNull();
  fireEvent.click(getByLabelText('Other'));
  // After clicking Other, the text input renders
  expect(queryByRole('textbox')).not.toBeNull();
});
```

- [ ] **Step 2: Component test for MultiChoiceInput**

```tsx
import { test, expect } from 'bun:test';
import { render, fireEvent } from '@solidjs/testing-library';
import MultiChoiceInput from './MultiChoiceInput';

test('MultiChoiceInput emits onChange with toggled values', () => {
  const calls: Array<{ values: string[] }> = [];
  const { getByLabelText } = render(() => (
    <MultiChoiceInput
      prompt="Pick any"
      options={['A', 'B', 'C']}
      onChange={(v) => calls.push(v)}
    />
  ));
  fireEvent.click(getByLabelText('A'));
  fireEvent.click(getByLabelText('C'));
  expect(calls[calls.length - 1]).toEqual({ values: ['A', 'C'] });
});

test('MultiChoiceInput respects maxSelections', () => {
  const calls: Array<{ values: string[] }> = [];
  const { getByLabelText } = render(() => (
    <MultiChoiceInput
      prompt="Pick any"
      options={['A', 'B', 'C']}
      maxSelections={1}
      value={{ values: ['A'] }}
      onChange={(v) => calls.push(v)}
    />
  ));
  fireEvent.click(getByLabelText('B'));
  // Should NOT have added B because max=1 and A is already selected
  expect(calls).toHaveLength(0);
});
```

- [ ] **Step 3: Run component tests**

Run: `cd apps/client-form && bun test src/components/`
Expected: 4 pass 0 fail.

If `@solidjs/testing-library` has different export names or setup requirements (e.g., needs `cleanup` calls or DOM setup), adapt accordingly. Bun has a built-in DOM environment via happy-dom or jsdom — if tests fail because `document` is undefined, add a `bunfig.toml` at `apps/client-form/`:

```toml
[test]
preload = ["./test-setup.ts"]
```

And `apps/client-form/test-setup.ts`:

```ts
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();
```

Plus add `"@happy-dom/global-registrator": "^15.0.0"` to devDependencies and `bun install`.

- [ ] **Step 4: Commit**

```bash
git add apps/client-form/src/components apps/client-form/test-setup.ts apps/client-form/bunfig.toml apps/client-form/package.json apps/client-form/bun.lock
git commit -m "Add component tests for SingleChoice + MultiChoice inputs"
```

(If happy-dom setup wasn't needed, omit those files from the add.)

---

### Task 17: Playwright E2E test

**Files:**
- Create: `apps/client-form/playwright.config.ts`
- Create: `apps/client-form/e2e/happy-path.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: [
    {
      command: 'cd ../.. && bun run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
```

This boots the actual backend (which serves the SPA) on port 3000.

- [ ] **Step 2: Create `e2e/happy-path.spec.ts`**

```ts
import { test, expect, request } from '@playwright/test';

// Bootstrap a real backend account + token + request, then drive the SPA.
async function bootstrap() {
  const api = await request.newContext({ baseURL: 'http://localhost:3000' });
  const signup = await api.post('/api/app/signup', {
    data: { email: `e2e-${Date.now()}@example.com`, password: 'hunter2hunter2', displayName: 'E2E Tester' },
  });
  const cookie = signup.headers()['set-cookie'] ?? '';
  const tokenRes = await api.post('/api/app/tokens', {
    data: { label: 'e2e' },
    headers: { cookie },
  });
  const tokenJson = (await tokenRes.json()) as { plain: string };
  const apiToken = tokenJson.plain;

  // Use MCP HTTP to create a request
  const createRes = await api.post('/mcp', {
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${apiToken}`,
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'create_request',
        arguments: {
          title: 'E2E test',
          intro: 'Just a quick test',
          questions: [
            { id: 'name', type: 'text_short', prompt: 'Your name?' },
            { id: 'color', type: 'single_choice', prompt: 'Favorite color?', options: ['Red', 'Blue'] },
          ],
        },
      },
    },
  });
  const body = await createRes.json();
  const result = body.result ?? body; // tolerate either MCP wrapping
  const text = result.content?.[0]?.text ?? '';
  const parsed = JSON.parse(text);
  const urlObj = new URL(parsed.url);
  return urlObj.pathname; // /r/<token>
}

test('opdrachtgever can complete the form end-to-end', async ({ page }) => {
  const path = await bootstrap();
  await page.goto(path);

  // Intro page
  await expect(page.getByText('E2E test')).toBeVisible();
  await page.getByRole('button', { name: /start/i }).click();

  // Question 1 — text
  await expect(page.getByText('Your name?')).toBeVisible();
  await page.getByRole('textbox').fill('Alice');
  await page.getByRole('button', { name: /next|review/i }).click();

  // Question 2 — single choice
  await expect(page.getByText('Favorite color?')).toBeVisible();
  await page.getByLabel('Blue').check();
  await page.getByRole('button', { name: /next|review/i }).click();

  // Review page
  await expect(page.getByText(/ready to send/i)).toBeVisible();
  await page.getByRole('button', { name: /send/i }).click();

  // Thank you
  await expect(page.getByText(/thank you/i)).toBeVisible();
});
```

- [ ] **Step 3: Install Playwright browsers**

Run from repo root: `cd apps/client-form && bunx playwright install chromium`
Expected: downloads Chromium.

- [ ] **Step 4: Build the SPA first**

Run: `cd apps/client-form && bun run build`

- [ ] **Step 5: Run the E2E test**

Run: `cd apps/client-form && bun run e2e`
Expected: 1 test passes against a real backend (which Playwright starts via `webServer` config).

If your dev environment can't run a webServer (e.g., no display), report this as a documented limitation and ensure the test file at least imports cleanly.

- [ ] **Step 6: Commit**

```bash
git add apps/client-form/playwright.config.ts apps/client-form/e2e
git commit -m "Add Playwright E2E test for full happy-path flow"
```

---

## Phase J — Documentation

### Task 18: Update root README with Plan 2 status

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the `## Plan status` section**

Change the line `- [ ] Plan 2 — Client form SPA (Vite + Solid)` to `- [x] Plan 2 — Client form SPA (Vite + Solid)`.

Add a new `## Client SPA` section above `## Tests`:

```markdown
## Client form SPA

The opdrachtgever-facing form lives in `apps/client-form/`. Built with Vite + Solid + Tailwind.

\`\`\`bash
# Dev: SPA on :5173 (proxies API to :3000)
cd apps/client-form && bun run dev

# Build (output: apps/client-form/dist/, served by Hono at /r/*)
cd apps/client-form && bun run build

# Unit / component tests
cd apps/client-form && bun test src/

# E2E (boots a real backend via Playwright)
cd apps/client-form && bun run e2e
\`\`\`
```

(Replace the escaped backticks with real triple backticks.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Update README: Plan 2 complete + client SPA quickstart"
```

---

## Plan 2 Completion Criteria

- [ ] All 18 tasks complete.
- [ ] `bun test` from repo root passes (Plan 1's 89 tests + new static-serving tests).
- [ ] `cd apps/client-form && bun test src/` passes (flow.test, autosave.test, component tests).
- [ ] `cd apps/client-form && bun run build` succeeds.
- [ ] `cd apps/client-form && bun run e2e` passes against a real backend.
- [ ] `cd apps/client-form && bun run typecheck` clean.
- [ ] Manual smoke: open a real form URL on `bun run dev`, complete the flow, verify autosave works in DevTools network tab.
- [ ] Visual design pass (Task 15) produced via `frontend-design` skill — distinctive, polished UI.

## Out of scope for Plan 2 (handled in later plans)

- Drawing / audio question types
- File upload question type — Plan 4
- Whitelabel branding (custom domain, logo) — defer
- Markdown rendering for `intro` — currently displayed as plain text with `whitespace-pre-wrap`
- Resume from URL with pre-filled answer (?prefill=…) — defer
- Internationalization — defer
