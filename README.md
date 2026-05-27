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

Tests: `bun test`
