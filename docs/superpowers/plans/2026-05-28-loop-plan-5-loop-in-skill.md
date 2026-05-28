# Loop — Plan 5: `loop-in` skill + `/loop-in` slash command + install docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two Claude Code surfaces that turn the Loop backend into something a developer actually uses naturally: a `loop-in` skill that auto-triggers on "I need input from someone" intent, and a `/loop-in` slash command for the explicit "send this now" moment. Plus install docs in the README so a new user can drop both files into `~/.claude/` and be productive in two minutes.

**Architecture:** Pure markdown artefacts checked into the repo under `dist/.claude/{skills,commands}/`. No build step. No code. Install = copy these files into the user's `~/.claude/` directory (or per-project `.claude/`). The skill file teaches Claude when and how to use the Loop MCP tools; the slash command file defines `/loop-in` with its argument-parsing and review-step behavior. Both files are designed to be self-sufficient — a Claude Code session with the Loop MCP configured + these two files installed should just work, without further onboarding.

**Tech Stack:** Markdown (Claude Code skill + slash command file formats). No runtime, no tests beyond a smoke-readthrough.

---

## Prerequisites

- Plan 1 backend is on `main` (PR #1 merged). The MCP server exposes `create_request`, `list_requests`, `get_response`, `peek_response`, `cancel_request`.
- Plan 2 SPA is on `main` (PR #2 merged). The form serves at `/r/:token`.
- This plan does NOT depend on Plan 3 (dashboard) or Plan 4 (uploads). The skill should be written to work today, against the current text-only question types.

## File structure (created by this plan)

```
loop-mcp/
├── dist/
│   └── .claude/
│       ├── skills/
│       │   └── loop-in.md           — auto-trigger skill (Claude Code skill format)
│       └── commands/
│           └── loop-in.md           — slash command definition (Claude Code command format)
├── docs/
│   └── invocation/
│       └── examples.md              — annotated example session showing the skill in action
└── README.md                        [MODIFY: add "Install /loop-in" section]
```

Format notes:
- **Skill files** in Claude Code use a YAML frontmatter (`name`, `description`) + body markdown that becomes the skill content. Activation is on the `description` field (and any trigger phrases the body recommends).
- **Slash command files** use a YAML frontmatter (`description`, `argument-hint`) + body markdown. The body is what Claude executes when the command is invoked. `$ARGUMENTS` placeholder receives the oneliner.

If the Claude Code skill/command format changes between now and execution, adapt the frontmatter — but keep the body content identical.

---

## Task 1: Write the `loop-in` skill file

**Files:**
- Create: `dist/.claude/skills/loop-in.md`

- [ ] **Step 1: Create the skill file with exact content below**

```markdown
---
name: loop-in
description: Use when the developer says they need input from another person to make progress — a client, colleague, expert, friend, or anyone outside the current Claude Code session. Triggers on phrases like "moet [iemand] vragen", "input nodig van [iemand]", "[naam] moet kiezen tussen", "wachten op feedback van", "even bij [iemand] checken", "weet [naam] of [topic]". Also use when about to guess or make an assumption that the developer just flagged should be confirmed by someone else.
---

# loop-in — request input from someone outside this session

Use the Loop MCP server to send a structured questionnaire to a non-developer and pull the answers back later. The developer shares the resulting link via WhatsApp/email; the recipient answers in a clean step-by-step form; you pull the structured answers back when the developer says "check ff" or "any updates" or similar.

## When this skill activates

Activate when the developer:
- Names a person and a topic that requires their input ("Annet moet kiezen tussen layout A en B")
- Says they're blocked on someone ("wachten op feedback van Mark", "moet eerst even bij de accountant checken")
- Is about to guess at something an external party should confirm ("ik weet niet of de klant USD-facturen wil — maar laten we Stripe nemen")
- Explicitly invokes `/loop-in`

If you're 50% sure this skill applies, run it. The worst case is one extra `list_requests` call.

## The MCP tools you have

You have five tools registered under the `loop` MCP server:

- `create_request({ title, intro?, context?, projectName?, slug?, questions[] })` — Returns `{ id, slug, url, status: 'pending' }`. The `url` is what the developer shares. Use `context` to leave a briefing for future-you (see below). NOT shown to recipient.
- `list_requests({ status?, projectName?, limit? })` — Default returns `pending` + `submitted`. Use at session start if the developer hints at "what's open" or returns from a break. Returns summaries with a `contextExcerpt`.
- `get_response({ ref })` — `ref` is the slug or id. **Side effect: transitions submitted → pulled.** After this, the recipient can no longer edit. Use this when the developer wants to act on the answers.
- `peek_response({ ref })` — Same shape, no side effect. Use when you want to look without claiming.
- `cancel_request({ ref })` — Closes the link. Irreversible.

## How to compose a good request

When you call `create_request`, the quality of these fields determines the quality of the answer you get back:

**`title`** — short, specific, recipient-facing. "Design feedback voor homepage" not "Vragen". The recipient sees this as the page heading.

**`intro`** (optional, markdown, recipient-facing) — 1–3 sentences in begrijpelijke taal. Explain the context to a non-developer. Mention how long this should take. Be warm, not corporate. Example:

> "Hi Annet — voor de nieuwe homepage wil ik je input op een paar keuzes. Duurt 3 minuten, je antwoorden komen direct bij mij terug."

**`context`** (optional but **strongly recommended**, NOT recipient-facing) — your briefing for future-you (or a future Claude session). Include:
- What project / feature this is about
- Why these specific questions, in enough detail that a fresh session understands
- What you intend to do with the answers
- Any file paths or decisions that are mid-air

Example:
> "Working on the homepage redesign for Acme (apps/web/src/pages/home.tsx). Annet has final say on the visual direction. After her answers I'll prototype the chosen layout, then pull her in again for the final hero copy. The 'Strak en zakelijk' option maps to the editorial direction we discussed yesterday."

**`projectName`** (optional) — groups requests in the dashboard and in `list_requests` output. Use the same string consistently across requests for the same project.

**`questions[]`** — the actual questions. Pick the right type for each:

- `text_short` for names, dates, short specifics
- `text_long` for free-form opinions, descriptions ("waarom?", "wat zou je toevoegen?")
- `single_choice` for "kies één", with 2–6 options. Add `allowOther: true` if the options likely don't cover everything.
- `multi_choice` for "kies alle die passen". Set `minSelections` / `maxSelections` when meaningful.

Each question gets:
- `id` — short, lowercase, descriptive (`vibe`, `must_have_features`, `naam`). Use these to interpret the answer.
- `prompt` — the actual question, recipient-facing. Be specific and short. If you need to provide examples, do it in the prompt itself; the recipient will read this without further context.
- `required: true` for questions you actually need an answer to.
- `placeholder` for text questions, only when it genuinely helps.

**Aim for the minimum viable questionnaire.** 3–6 questions is usually right. If you find yourself listing 10 questions, you probably haven't thought about what you actually need — sit with the developer's request again.

## The pull pattern

The developer is unblocked the moment they share the link. They might come back to you minutes or days later. When they do:

- "check ff" / "iets terug?" / "any updates?" → `list_requests({ status: 'submitted' })` first. If there's a match, `get_response({ ref })` to pull.
- "wat staat er open?" → `list_requests({})` (default: pending + submitted). Summarize back with context excerpts.
- Specific reference ("de design-vragen", "Annet's input") → `get_response({ ref: 'design-vragen' })` directly, using the slug. If it doesn't match, fall back to `list_requests`.
- If they say "cancel het [X]" → `cancel_request({ ref })`.

After a successful `get_response`, parse the `answers` object using the `questions` array (also returned) to pair question prompts with answers. Restate the key answers in your reply to the developer before acting on them — confirms they actually got what they wanted.

## When you're starting a new session

If the developer's first message hints at past Loop activity ("waar waren we", "ik denk dat Annet al heeft geantwoord"), call `list_requests({})` early to refresh on what's open. Read the `contextExcerpt` to remember what each link was about.

## Anti-patterns to avoid

- **Don't `get_response` to peek** — that pulls. Use `peek_response` if you just want to look.
- **Don't skip `context`** — when you come back to this in two weeks (or a different Claude session does), you'll thank yourself.
- **Don't write developer-jargon into `prompt`** — the recipient is not a developer. "API endpoint" → "manier waarop andere systemen jullie data kunnen ophalen".
- **Don't auto-create a request from a vague hint.** Confirm scope first: "Zal ik een Loop-link maken met deze vragen, of mis je nog iets?"
- **Don't share the URL before confirming the questions** — see the `/loop-in` review step.

## Working with the developer

Before you call `create_request`, you almost always want to confirm the question set with the developer. The recipient will see what you write — you only get one good draft. Show the developer the draft questions (and the intro you wrote) and ask: "Verstuur, aanpassen of annuleren?" Use the `/loop-in` slash command for the canonical version of this flow.
```

- [ ] **Step 2: Verify markdown renders cleanly**

Open the file in a markdown previewer (or `cat dist/.claude/skills/loop-in.md`). Confirm:
- YAML frontmatter is valid (single `---` block, name + description fields).
- No accidental triple-backtick nesting that breaks the file.
- The description ends without trailing whitespace.

- [ ] **Step 3: Commit**

```bash
git add dist/.claude/skills/loop-in.md
git commit -m "Add loop-in skill: auto-trigger when developer needs external input"
```

---

## Task 2: Write the `/loop-in` slash command

**Files:**
- Create: `dist/.claude/commands/loop-in.md`

- [ ] **Step 1: Create the slash command file**

```markdown
---
description: Send a structured questionnaire to someone outside this session (client, colleague, expert, anyone) via the Loop MCP. With no args, asks what you need and from whom; with args, drafts directly from the oneliner.
argument-hint: [optional: "<person> needs to decide on <topic>"]
---

# /loop-in — send a Loop questionnaire

You are about to compose and send a Loop questionnaire on the developer's behalf. The Loop MCP server is configured under the name `loop`. Use its `create_request` tool when the developer approves the draft.

## Step 1: Get the brief

Look at the arguments passed to this command.

**If no arguments were provided** ($ARGUMENTS is empty): ask the developer what they need and from whom, with concrete examples to anchor them. Use natural language, no bullet UI:

> Wat heb je nodig en van wie? Bijvoorbeeld:
> - "akkoord van Annet over de homepage copy"
> - "input van een accountant over BTW op buitenlandse facturen"
> - "Mark moet kiezen tussen layout A en B voor de hero"

Wait for their answer before continuing.

**If arguments were provided** ($ARGUMENTS is non-empty): treat that as the brief and skip the ask. Example arguments:
- "mark moet kiezen tussen layout A en B voor de homepage hero"
- "annet input op homepage copy"
- "accountant BTW vraag voor USD facturen"

## Step 2: Draft

Based on the brief, draft:

- **title** — short, specific, in the recipient's language (Dutch if the brief is Dutch, English otherwise). What the recipient sees as the page heading.
- **intro** — 1–3 warm sentences. Mention who is asking (the developer's first name if you know it), why, and roughly how long it'll take. No corporate boilerplate.
- **context** — your private briefing for future-you. What project/feature, why these questions, what you'll do with the answers. NOT shown to the recipient.
- **projectName** (optional) — if the brief implies a project, use a consistent string.
- **questions[]** — the smallest set of questions that actually unblocks the developer. 3–6 is usually right. Pick the right type per question:
  - `text_short` for names/short specifics
  - `text_long` for free-form
  - `single_choice` for "kies één" (use `allowOther: true` if your options likely don't cover everything)
  - `multi_choice` for "kies alle die passen" (set `minSelections` when meaningful)

Aim for prompts a non-developer will understand without context. Don't use jargon.

## Step 3: Review with the developer

Before sending, show the developer the draft. Use a structured choice (AskUserQuestion or equivalent) with three options:

- **Verstuur** — proceed to call `create_request` with the drafted fields, then return the resulting URL with a one-line suggestion of how to share it.
- **Aanpassen** — ask which question(s) need editing, or whether the intro/title/context needs work. Make the changes, then re-show the draft.
- **Annuleer** — drop the draft. Don't send.

When showing the draft, format it like this so the developer can scan it fast:

```
Project: <projectName or "—">
Title (recipient sees): <title>
Intro (recipient sees):
  <intro>

Context (private to you):
  <context>

Questions:
  1. [text_short] <prompt>
  2. [single_choice] <prompt>
     - <option 1>
     - <option 2>
  ...
```

## Step 4: Send

On "Verstuur", call:

```
loop.create_request({
  title: "...",
  intro: "...",
  context: "...",
  projectName: "...",
  questions: [...]
})
```

The response gives you a `url` and a `slug`. Reply to the developer with both, plus a short suggestion for how to share:

> Link: <url>
> Slug (om later naar te verwijzen): <slug>
>
> Stuur 'm via WhatsApp/mail. Zeg gewoon "check de [slug]" als je later wilt dat ik de antwoorden ophaal.

## Don't

- Don't ask the developer 10 clarifying questions before drafting. Draft something with the info you have, then iterate via the review step.
- Don't include questions about things you can answer yourself (e.g., implementation details).
- Don't skip the review step. Sent is sent — the recipient sees the questions immediately.
- Don't send without `context`. If you don't have enough info to fill it, ask the developer for two more sentences before the review step.

$ARGUMENTS
```

- [ ] **Step 2: Verify**

`cat dist/.claude/commands/loop-in.md` — confirm the frontmatter is valid and the body parses.

- [ ] **Step 3: Commit**

```bash
git add dist/.claude/commands/loop-in.md
git commit -m "Add /loop-in slash command with draft → review → send flow"
```

---

## Task 3: Annotated example session

**Files:**
- Create: `docs/invocation/examples.md`

- [ ] **Step 1: Create the example doc**

```markdown
# /loop-in in action

Three annotated examples showing how the `loop-in` skill + `/loop-in` slash command feel in practice.

## Example 1 — Explicit invoke with a oneliner

```
You: /loop-in mark moet kiezen tussen layout A en B voor de homepage hero

Claude: Hier is de draft:

  Project: Acme website
  Title (recipient sees): Hero layout — A of B?
  Intro (recipient sees):
    Hi Mark — even snel jouw input op de nieuwe homepage. We hebben
    twee richtingen voor de hero, en ik wil graag weten welke voor
    jullie merk het beste werkt. Duurt 1 minuut.

  Context (private to you):
    Working on the homepage redesign for Acme (apps/web/src/pages/
    home.tsx). Mark is the design lead. After this I'll pick the
    winning layout and ship it on staging for him to play with.
    Layout A = denser, B = airy editorial.

  Questions:
    1. [single_choice] Welke layout voelt voor jullie?
       - Layout A (denser, meer info zichtbaar)
       - Layout B (luchtig, editorial)
    2. [text_long] Iets dat je wil aanpassen aan de gekozen versie?

  [Verstuur] [Aanpassen] [Annuleer]

You: Verstuur

Claude: Link: https://loop.app/r/AbC123…
        Slug (om later naar te verwijzen): hero-layout-a-of-b

        Stuur 'm via WhatsApp/mail. Zeg gewoon "check de hero-layout-a-of-b"
        als je later wilt dat ik de antwoorden ophaal.
```

## Example 2 — No-arg invoke, conversational

```
You: /loop-in

Claude: Wat heb je nodig en van wie? Bijvoorbeeld:
        - "akkoord van Annet over de homepage copy"
        - "input van een accountant over BTW op buitenlandse facturen"
        - "Mark moet kiezen tussen layout A en B voor de hero"

You: Annet moet kiezen tussen Stripe en Mollie als payment provider,
     en weten of we facturen ook in USD moeten ondersteunen.

Claude: [drafts and shows the same review block]
```

## Example 3 — Auto-triggered by the skill (no slash command)

```
You: Ik ga de checkout bouwen. Stripe of Mollie?

Claude: Voor je dat vraagt — wil je niet liever Annet hierin meenemen?
        Het is een eenrichtings-keuze (later switchen kost veel) en
        zij heeft eerder gezegd dat ze betalingen wil aansturen.
        
        Ik kan een /loop-in maken met de vraag plus de USD-overweging
        die jullie gisteren noemden. Zo geen "ik dacht dat jij…"
        achteraf.

You: Doe maar.

Claude: [drafts via create_request, shows review block]
```

## Pulling answers

```
You: heeft mark al geantwoord op de hero-vraag?

Claude: [calls loop.list_requests({ status: 'submitted' })]

        Ja — Mark heeft "Layout B" gekozen, met als aanvulling:
        "graag de subkop één regel korter en de CTA als ghost button
        in plaats van filled."

        [internal: also called get_response, so the link is now pulled
        and Mark can no longer edit it]

        Zal ik die aanpassingen meteen verwerken?
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/invocation/examples.md
git commit -m "Add /loop-in invocation examples"
```

---

## Task 4: README install section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the install section to README**

Append a new top-level section after the existing "Client form SPA" section and before "Tests" (or wherever it makes sense in the existing structure). Use REAL triple backticks (not escaped) in the actual file:

```markdown
## Use Loop from Claude Code

Loop ships a small skill + slash command for Claude Code. With both installed, Claude will recognize when you need input from someone outside the session ("Annet moet kiezen tussen…") and either suggest `/loop-in` or run it itself.

### Install (one time, ~30 seconds)

\`\`\`bash
# 1. Make sure you have the Loop MCP configured in Claude Code.
#    Add this to your Claude Code MCP config (or use `claude mcp add`):
#
#    "loop": {
#      "type": "http",
#      "url": "https://loop.app/mcp",     # or your self-hosted base URL
#      "headers": { "Authorization": "Bearer lp_..." }
#    }

# 2. Drop the skill + slash command into Claude Code:
mkdir -p ~/.claude/skills ~/.claude/commands
cp dist/.claude/skills/loop-in.md     ~/.claude/skills/
cp dist/.claude/commands/loop-in.md   ~/.claude/commands/

# 3. Restart Claude Code (or just open a new session).
\`\`\`

That's it. In any session:

- Say something like *"Mark moet kiezen tussen layout A en B"* — the skill triggers and Claude proposes a draft.
- Or run `/loop-in` explicitly with an optional oneliner.

See `docs/invocation/examples.md` for annotated example flows.

### Per-project install

If you want the skill scoped to a single project instead of globally:

\`\`\`bash
mkdir -p .claude/skills .claude/commands
cp dist/.claude/skills/loop-in.md     .claude/skills/
cp dist/.claude/commands/loop-in.md   .claude/commands/
\`\`\`
```

- [ ] **Step 2: Update plan status section**

Change `- [ ] Plan 5 — Invocation files (\`loop-in\` skill + slash command)` to `- [x] Plan 5 — Invocation files (\`loop-in\` skill + slash command)`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Add Use Loop from Claude Code section + mark Plan 5 complete"
```

---

## Task 5: Smoke test — install locally and verify

**Files:** none

- [ ] **Step 1: Install the files into the current user's `~/.claude/`**

```bash
mkdir -p ~/.claude/skills ~/.claude/commands
cp dist/.claude/skills/loop-in.md   ~/.claude/skills/
cp dist/.claude/commands/loop-in.md ~/.claude/commands/
```

- [ ] **Step 2: Visual check**

```bash
cat ~/.claude/skills/loop-in.md | head -10
cat ~/.claude/commands/loop-in.md | head -10
```

Confirm both files exist and contain the expected frontmatter.

- [ ] **Step 3: Document the smoke**

This task is human-verified: there is no automated assertion. After installing, the developer can open a fresh Claude Code session and try `/loop-in`. The skill should be picked up automatically; the slash command should be tab-completable. If either is missing, check the file paths and frontmatter.

(There is no commit for this task — it's a one-time install action.)

---

## Plan 5 Completion Criteria

- [ ] All 4 deliverables present and committed: skill file, slash command file, examples doc, README install section.
- [ ] Plan status in README marked complete.
- [ ] Manual smoke (Task 5) done at least once by a real user, confirming `/loop-in` works in a fresh session against the deployed (or local) Loop MCP.

## Out of scope (deferred)

- An `install.sh` script that does the copy + verifies the MCP config — Plan 5 stays markdown-only.
- A `/loop check` or `/loop list` slash command — the skill's natural-language path handles those today; revisit only if it proves flaky in practice.
- Onboarding flow that creates an API token from inside Claude Code — that would require an interactive OAuth-ish dance; defer until the dashboard (Plan 3) exists.
- Translation / locale-aware behavior for non-Dutch users — the current skill is bilingual in spirit (the examples are Dutch but the activation triggers and `argument-hint` work in English too).
