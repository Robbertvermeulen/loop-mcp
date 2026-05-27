# Loop MCP

Async human-in-the-loop service for AI coding sessions. Claude (via MCP) creates a questionnaire, gets a shareable link, you share it with a non-developer, they answer in a web form, Claude pulls the structured answers back later.

Status: backend foundation (Plan 1). See `docs/superpowers/specs/2026-05-27-loop-mcp-design.md` for the design.

## Dev setup

```bash
bun install
cp .env.example .env
bun run db:generate
bun run db:migrate
bun run dev
```

Then exercise the API end-to-end via curl:

```bash
# 1. Create an account
curl -X POST localhost:3000/api/app/signup \
  -H 'content-type: application/json' \
  -c cookies.txt \
  -d '{"email":"me@example.com","password":"hunter2hunter2","displayName":"Robbert"}'

# 2. Create an API token
curl -X POST localhost:3000/api/app/tokens \
  -H 'content-type: application/json' \
  -b cookies.txt \
  -d '{"label":"laptop"}'
# Save the "plain" field from the response (starts with lp_).

# 3. Create a Loop request via MCP
curl -X POST localhost:3000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer lp_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_request","arguments":{"title":"Test","context":"first test","questions":[{"id":"q1","type":"text_short","prompt":"name?"}]}}}'

# 4. The response contains a URL like http://localhost:3000/r/<token>.
# Plan 1 has no SPA — exercise the public API directly:
curl localhost:3000/api/r/<token>
curl -X POST localhost:3000/api/r/<token>/submit \
  -H 'content-type: application/json' \
  -d '{"q1":"hi"}'

# 5. Pull
curl -X POST localhost:3000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer lp_..." \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_response","arguments":{"ref":"test"}}}'
```

## Tests

```bash
bun test
```

88 tests across unit (in-memory libsql) and integration (HTTP through Hono + MCP through SDK).

## Plan status

- [x] Plan 1 — Backend foundation + MCP MVP (text-only)
- [ ] Plan 2 — Client form SPA (Vite + Solid)
- [ ] Plan 3 — Dashboard
- [ ] Plan 4 — File uploads (R2)
- [ ] Plan 5 — Invocation files (`loop-in` skill + slash command)
