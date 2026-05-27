# Loop — Human-in-the-loop voor je AI coding sessie

**Status:** approved design, ready for implementation plan
**Date:** 2026-05-27
**Author:** Robbert Vermeulen (met Claude)

## Probleem

Tijdens AI-assisted coding (Claude Code) heb ik vaak input nodig van een opdrachtgever
die zelf geen developer is: akkoord op een keuze, industry-specifieke informatie,
voorkeuren over copy of design. Het huidige werk-proces is hand-rolled: ik vraag
Claude om de vragen behapbaar te maken voor een WhatsApp/mail, ik kopieer dat naar
de opdrachtgever, ontvang antwoorden in WhatsApp, kopieer terug naar Claude. Tussendoor
wil ik vaak doorwerken — en dan moet ik later weer terugrefereren.

## Oplossing in één regel

Een hosted SaaS waar Claude (via MCP) een vragenlijst kan aanmaken, een deelbare link
genereert, doorgaat met coden, en later de gestructureerde antwoorden weer kan ophalen.
De opdrachtgever opent de link in een browser en beantwoordt stap-voor-stap zonder
account.

## Scope

**In scope (MVP):**
- Publiek SaaS, gehoste service (loop.app of vergelijkbaar)
- Dev-accounts met email + password, één MCP API token per dev
- MCP HTTP-transport (geen lokale install nodig in Claude Code)
- Vraag-types: korte tekst, lange tekst, single choice, multi choice, file/image upload
- Step-by-step client form met auto-save (draft) en submit
- Editable tussen submit en pull (Claude "claimt" door te pullen)
- Per-request private `context` veld voor cross-session geheugen
- Projects (lichtgewicht: gewoon string-name per user)
- Branding: jouw naam + project-naam zichtbaar voor opdrachtgever
- Dev-dashboard om links te zien, status te volgen, antwoorden te lezen

**Out of scope (later):**
- Drawing / audio question types
- Whitelabel (custom domain, logo, theming)
- Email notificaties naar dev wanneer antwoorden binnen zijn
- Billing / quota's voorbij hard caps
- Multi-user accounts (teams, gedeelde projects)
- Push notificaties / SSE — explicit pull is de UX

## Architectuur

Eén Hono/Bun service, single deploy. Drie soorten endpoints op één origin:

```
loop.app
├── /mcp              ← MCP server (HTTP transport, Bearer token auth)
├── /api/*            ← REST API
│   ├── /api/app/*    ← cookie-auth, dashboard data
│   └── /api/r/:t/*   ← token-auth, client form data (writes voor opdrachtgever)
├── /r/:token         ← Client-facing form SPA (statisch geserveerd)
└── / + /app/*        ← Dashboard (Hono JSX SSR)
```

**Persistence:** SQLite (libSQL/Turso) voor MVP. Schema-compatibel met Postgres
zodat migratie later mogelijk is — alleen `serial` vs `autoincrement` vermijden,
JSON als TEXT met Zod-validatie in code.

**File storage:** Cloudflare R2 (S3-compat, geen egress fee). Presigned PUT/GET vanuit
SPA direct naar R2; server houdt alleen metadata bij. R2-objects blijven na pull;
GC voor objects > 90 dagen pulled komt later via cron-script.

**Deploy:** Fly.io of Hetzner VPS in Docker. Single container, single region.

**Geen background workers** voor MVP. Alles request/response.

## Component decomposition

### Backend modules (`src/`)

Elke module exporteert een smalle interface, internals worden niet over module-grenzen
heen geïmporteerd. Tests per module tegen de exported interface met in-memory SQLite.

| Module | Doel | Dependencies |
|---|---|---|
| `db` | SQLite connection, migrations, Drizzle of Kysely typed queries | — |
| `auth` | Signup/login, session cookies, API token CRUD (hashing met SHA-256) | `db` |
| `requests` | `createRequest`, `getRequest`, `listForUser`, `markPulled`, `cancel` | `db` |
| `answers` | `upsertDraft`, `submit`, `getForRequest` — token-gated | `db`, `requests` |
| `uploads` | R2 presigning, upload-record creation, head-check op confirm | `db`, R2 client |
| `mcp` | HTTP MCP server (`@modelcontextprotocol/sdk`), maps tools naar domain-calls | `requests`, `answers`, `auth` |
| `api` | Hono routers: `/api/app/*` (cookie) en `/api/r/:token/*` (token) | alle domains |
| `server` | Hono app, mountpoints, static SPA-serving, error middleware | alles |

### Frontend bundels (`apps/`)

| Unit | Doel | Stack |
|---|---|---|
| `apps/client-form` | Step-by-step SPA voor opdrachtgever, `/r/:token` | Vite + Solid |
| `apps/dashboard` | Dev dashboard | Hono JSX SSR + lichte HTMX swaps, geen bundler |

**Solid-keuze:** klein (~7kb), snel, simpel reactive model, geen JSX-compile-magic.
Alleen voor de client form — daar is een SPA nodig voor smooth step navigation +
auto-save UX. Dashboard heeft die luxe niet nodig.

### Folder shape

```
loop-mcp/
├── src/
│   ├── db/
│   ├── auth/
│   ├── requests/
│   ├── answers/
│   ├── uploads/
│   ├── mcp/
│   ├── api/
│   └── server.ts
├── apps/
│   ├── client-form/      ← Vite + Solid build → src/server serveert dist statisch
│   └── dashboard/        ← Hono JSX templates, geen build
├── migrations/
├── tests/
└── docs/superpowers/specs/
```

## Data model

SQLite schema (Drizzle TypeScript syntax, samengevat). Bewust geen aparte
`questions`/`answers` tabellen — we retrieven altijd een request als geheel, dus
JSON-blob in de parent-row is YAGNI-correct.

```ts
users {
  id            text pk          // ulid
  email         text unique
  passwordHash  text
  displayName   text             // wat opdrachtgever ziet
  createdAt     int              // unix ms
}

apiTokens {
  id            text pk
  userId        text → users.id
  tokenHash     text unique      // SHA-256 van plain token
  label         text             // "Claude Code op laptop"
  lastUsedAt    int?
  createdAt     int
}

sessions {
  id            text pk          // cookie value
  userId        text → users.id
  expiresAt     int
}

projects {
  id            text pk
  userId        text → users.id
  name          text             // "Acme Website Redesign"
  createdAt     int

  unique(userId, name)           // upsert-key
}

requests {
  id            text pk          // ulid
  userId        text → users.id
  projectId     text? → projects.id
  token         text unique      // 32-byte url-safe random, in /r/:token
  slug          text             // human-friendly ref voor MCP; unique per user
  status        text             // 'pending' | 'submitted' | 'pulled' | 'cancelled'
  title         text             // korte titel, zichtbaar voor opdrachtgever
  intro         text?            // markdown context blok voor opdrachtgever
  context       text?            // PRIVATE briefing voor Claude (cross-session memory).
                                 //   Niet zichtbaar voor opdrachtgever.
  questions     text (JSON)      // Question[] — zie hieronder
  draftAnswers  text? (JSON)     // partial, auto-saved tijdens beantwoorden
  finalAnswers  text? (JSON)     // gezet bij submit
  submittedAt   int?
  pulledAt      int?
  cancelledAt   int?
  createdAt     int

  unique(userId, slug)
  index(userId, createdAt desc)
  index(token)
}

uploads {
  id            text pk
  requestId     text → requests.id
  questionId    text             // matcht een Question.id in requests.questions
  r2Key         text
  filename      text
  mimeType      text
  sizeBytes     int
  createdAt     int

  index(requestId)
}
```

### Question schema (gevalideerd met Zod)

```ts
type Question =
  | { id: string; type: 'text_short';    prompt: string; required?: boolean; placeholder?: string }
  | { id: string; type: 'text_long';     prompt: string; required?: boolean; placeholder?: string }
  | { id: string; type: 'single_choice'; prompt: string; required?: boolean;
      options: string[]; allowOther?: boolean }
  | { id: string; type: 'multi_choice';  prompt: string; required?: boolean;
      options: string[]; minSelections?: number; maxSelections?: number }
  | { id: string; type: 'file_upload';   prompt: string; required?: boolean;
      acceptedMimeTypes?: string[]; maxSizeMb?: number; multiple?: boolean }
  // toekomst: 'drawing', 'audio'
```

### Answers schema

`Record<questionId, Answer>` waar `Answer` matched het type:
- `text_short`/`text_long` → `string`
- `single_choice` → `{ value: string; other?: string }`
- `multi_choice` → `{ values: string[] }`
- `file_upload` → `{ uploadIds: string[] }`

### State machine (`requests.status`)

```
pending ──submit──▶ submitted ──pull──▶ pulled    (terminal)
   │                    │
   │                    └──edit──▶ submitted     (re-submit overschrijft finalAnswers)
   ▼                    ▼
cancelled            cancelled                    (terminal)
```

Belangrijke regels:
- Zodra `pulled` of `cancelled`: alle write-endpoints op de token geven 409 met
  semantische reden.
- Tussen `submitted` en `pulled` mag opdrachtgever de link reopenen en answers
  aanpassen — re-submit overschrijft `finalAnswers` + `submittedAt`.

## Data flow

### A — Setup (eenmalig per dev)

1. Dev signup op web (email + password) → email-verify of magic-link login.
2. Dashboard → "Connect Claude Code" → generate API token → toon plain token éénmaal.
3. Dev plakt MCP config in Claude Code:
   ```json
   {
     "mcpServers": {
       "loop": {
         "type": "http",
         "url": "https://loop.app/mcp",
         "headers": { "Authorization": "Bearer lp_xxx..." }
       }
     }
   }
   ```
4. Claude Code laadt MCP. Tools beschikbaar.

### B — Vraag stellen + delen

```
Claude (dev): "ik heb input van opdrachtgever nodig"
  ▼ MCP create_request({ title, intro?, context?, questions[], projectName? })
Server: auth Bearer → user → upsert project → INSERT request
        (status=pending, random token, gen slug van title)
  ▼ returns { id, slug, url, status: 'pending' }
Claude geeft url aan dev → dev plakt in WhatsApp
Claude gaat door coden (geen blocking)
```

### C — Beantwoorden (opdrachtgever)

```
Opdrachtgever opent /r/:token in browser
  ▼ SPA fetch GET /api/r/:token
     server checkt status ∉ {pulled, cancelled}
     returnt { displayName, projectName?, title, intro, questions, draftAnswers }
     (context is NIET in deze respons — privé voor dev)
  ▼ SPA toont intro + één-vraag-per-scherm
Bij vraag-wissel: PUT /api/r/:token/draft   (autosave, debounced ~800ms)

File upload pad:
  ▼ POST /api/r/:token/uploads/presign → { uploadUrl, uploadId }
  ▼ PUT direct naar R2 met presigned URL
  ▼ POST /api/r/:token/uploads/:id/confirm  (server checkt R2 head)

Eindscherm: POST /api/r/:token/submit
  ▼ server: status='submitted', finalAnswers=…, submittedAt=now
"Bedankt"-scherm, optie "antwoorden aanpassen" → terug naar form
  (zolang status ∉ {pulled, cancelled})
```

### D — Pullen (dev terug bij Claude)

```
Dev: "check de design-vragen"
  ▼ Claude: list_requests({ status: 'submitted' })       (optioneel, refresh)
  ▼ Claude: get_response({ ref: 'design-vragen' })       (ref = id of slug)
Server: auth, resolve ref → request
        Atomic UPDATE … SET status='pulled', pulledAt=now WHERE status='submitted'
        Returns { title, slug, status, context, answers, uploads (presigned GET), questions }
Claude krijgt gestructureerd antwoord, werkt door
```

### Race condition: submit terwijl Claude pullt

Pull doet `UPDATE requests SET status='pulled' WHERE id=? AND status='submitted'`
(atomic). In-flight submit ziet `status='pulled'` → 409. Tweede `get_response` op
zelfde id werkt nog, answers blijven beschikbaar — geen errors voor de dev.

## MCP tool surface

Vijf tools. Twee design-keuzes lopen er doorheen:
1. **Slug naast id** — Claude verzint een human-friendly slug uit de title bij
   `create_request`. Dev kan zeggen "pull de design-vragen", Claude resolved.
   Server: unique per user, conflict → suffix `-2`, `-3`, …
2. **Private `context` veld** — Claude vult dit met een briefing voor future-self,
   zichtbaar in `list_requests` (excerpt) en `get_response`/`peek_response` (volledig).
   Niet zichtbaar voor opdrachtgever.

### Tools

```
create_request({
  title:       string         // "Design feedback voor homepage"
  slug?:       string         // optioneel; server slugified de title als afwezig
  intro?:      string         // markdown, getoond aan opdrachtgever bovenaan form
  context?:    string         // STRONGLY RECOMMENDED. Briefing voor jezelf (en future
                              //   Claude sessies). Beschrijf: waar gaat dit linkje
                              //   over, welk project/feature, wat blokkeerde dit,
                              //   wat ga je doen met de antwoorden. NIET aan
                              //   opdrachtgever getoond.
  projectName?: string        // upsert per user+name
  questions:   Question[]     // schema hierboven, Zod-gevalideerd
}) → {
  id, slug, url, status: 'pending'
}

list_requests({
  status?: 'pending' | 'submitted' | 'pulled' | 'cancelled' | 'any'
             // default: 'pending,submitted' (alles wat nog claude's aandacht nodig kan hebben)
  projectName?: string
  limit?: number              // default 20
}) → Array<{
  id, slug, title, projectName?, status,
  contextExcerpt?,            // eerste ~200 chars van context
  createdAt, submittedAt?, answerCount, totalQuestions
}>

get_response({ ref: string }) → {
  id, slug, title, projectName?, status,
  context?,                   // volledig
  questions,                  // zodat Claude vraag+antwoord kan paren
  answers?,                   // alleen als status was 'submitted' (of 'pulled')
  uploads?: Array<{ questionId, filename, mimeType, sizeBytes, downloadUrl }>
                              // presigned R2 GET URLs, 1u geldig
}
// SIDE EFFECT: als status='submitted' → atomic update naar 'pulled'

peek_response({ ref: string })
// als get_response, maar geen side effect. Voor "even kijken zonder claimen."

cancel_request({ ref: string })
// markeert status='cancelled'. Voor verkeerd-gestuurde of niet-meer-nodige links.
```

### Tool-description principes (anti-hallucination)

- Geen `pull_all` — forceert Claude tot bewuste keuze per request.
- `list_requests` is goedkoop en idempotent — oriëntatie in nieuwe sessie.
- Tool descriptions zeggen expliciet "marks as pulled" vs "does NOT mark as pulled".
- Error responses geven semantische codes: `not_found`, `not_yet_submitted`,
  `already_pulled`, `cancelled`, `auth_failed`, `validation_failed`, `quota_exceeded`,
  `rate_limited`.

## Error handling

### MCP tool errors

Structured JSON met `code` + `message`:

```ts
{ error: { code: 'not_yet_submitted', message: '...', requestId, status: 'pending' } }
```

Codes: `auth_failed`, `not_found`, `not_yet_submitted`, `already_pulled`,
`cancelled`, `validation_failed`, `quota_exceeded`, `rate_limited`.

### Client-form (SPA)

- Auto-save netwerkfout → silent retry met exponential backoff, banner pas na 3 fails.
- Submit failure → blocking modal met retry.
- `pulled`/`cancelled`/onbestaande token → vriendelijke "deze link is afgesloten"-pagina.
- Upload > maxSizeMb of verkeerde mime → server rejected presign met 400, inline error.

### Dashboard

- SSR error page voor full-page failures.
- Inline error voor form submits.

### Failure-mode matrix

| Scenario | Behandeling |
|---|---|
| Ongeldig/expired Bearer token op MCP | 401 + `auth_failed` |
| Opdrachtgever opent al-pulled link | "Deze vragenlijst is al verwerkt" |
| Submit race met pull | 409 op submit, "deze vragenlijst is gesloten" |
| Upload limit overschreden | 400 op presign, inline SPA error |
| R2 down | Upload-presign fail, retry; text-answers blijven werken |
| Validation mismatch op create_request | `validation_failed` met details, Claude corrigeert |
| User wist token tijdens tool-call | 401 op next call |
| Twee Claude-sessies pullen tegelijk | Atomic UPDATE, tweede krijgt `already_pulled` met answers |

### Rate limiting

`hono-rate-limiter`, per-IP + per-token bucket op `/r/*` write-endpoints. Skip op reads.

### Quota's (MVP)

- Max 100 actieve (`pending`+`submitted`) requests per user.
- Max 50 vragen per request.
- Hard caps. Code: `quota_exceeded`.

### Logging

One-line JSON naar stdout, met `requestId`, `userId`, `tool`, `status`. Fly/Hetzner
capture via journald.

## Testing strategy

### Unit (per module, in-memory SQLite, `bun test`)

- `requests`, `answers`, `auth`, `uploads` — pure function units.
- Alleen tegen exported interface. Internals niet mocken.
- Doel: ~80% coverage op domain modules.

### Integration (HTTP-level tegen Hono app)

- Test setup: `app.request(...)` met test DB.
- Belangrijke flows:
  - end-to-end: create_request → answer → submit → get_response → status='pulled'
  - submit↔pull race: parallel Promise.all, assert exact one winner
  - file upload happy path met R2 mock
  - alle MCP tool error codes
  - alle `/r/:token` access cases (pending/submitted/pulled/cancelled/nonexistent)

### SPA tests (`apps/client-form`)

- Component tests met `@solidjs/testing-library`: step navigation, autosave
  debouncing, validation.
- Eén Playwright E2E: alle question types invullen + submit.
- Geen volle SPA coverage; logica zit op server.

### MCP integration test

- Echte MCP HTTP transport, test-client met `@modelcontextprotocol/sdk`.
- Verifieert tool listing + schemas + happy/error paths.

### Geen tests voor

- Dashboard UI (alleen smoke render-test)
- Bun/Hono framework behavior
- R2 SDK internals

### CI

GitHub Actions: `bun test` + Playwright op PR. Migrations runnen tegen Postgres
*én* SQLite om driver-divergentie te catchen.

## Implementation notes

- **Voor UI/UX werk:** raadpleeg de `/frontend-design` skill (zowel client form
  als dashboard).
- **MCP server skeleton:** `@modelcontextprotocol/sdk` met streamable HTTP transport.
- **Naming:** project heet "Loop". Repo blijft `loop-mcp` (matched al de directory).
- **Sequencing (volgordehints, geen plan):** db + auth eerst, dan requests/answers
  domain, dan MCP tools, dan client form SPA, dan dashboard. Uploads kunnen na de
  text-only happy path.
