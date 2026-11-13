# CLAUDE.md

## Project

Slack Bill Splitting - A Slack bill-splitting bot inspired by KBANK's Khunthong. Built with TypeScript, Slack Bolt, and SQLite.

## Commands

- `pnpm install` — Install dependencies
- `pnpm build` — Compile TypeScript
- `pnpm dev` — Run dev server with hot reload
- `pnpm start` — Run compiled build (`dist/app.js`)
- `pnpm db:migrate` — Run database migrations (also runs automatically on app start)
- `pnpm db:reset` — Delete database and restart dev server

No test suite or linter — `pnpm build` (tsc strict) is the only automated check; run it after every change.

## Architecture

- `src/app.ts` — Bolt app (Socket Mode), slash-command subcommand router, registers all handlers and schedulers
- `src/commands/`, `src/actions/` — each exports `registerXxx(app)`; new handlers must be registered in `app.ts`
- `src/views/` — Block Kit builders (pure functions); `src/models/` — SQLite queries per table
- `src/services/` — receipt OCR (tesseract.js, `eng+tha`), receipt parser, PromptPay QR
- `src/scheduler/` — node-cron jobs (reminders, Slack file cleanup)

## Gotchas

- **Schema changes go in two places**: `src/database/schema.ts` (fresh DBs) AND a new entry appended to `migrations` in `src/database/migrate.ts` (existing DBs). Never edit an already-applied migration.
- **Slash command name is configurable** via `SLASH_COMMAND` (default `slack-bill-splitting`). Use `` `/${config.slashCommand}` `` in user-facing text, never hardcode.
- All env vars are read in `src/config.ts` only — add new ones there and to `.env.example`.
- Socket Mode is always on (not just dev) — `SLACK_APP_TOKEN` (`xapp-…`) is required everywhere. Missing Slack tokens default to `""` and only fail at `app.start()`.
- `*.traineddata` in repo root are tesseract language caches (gitignored, auto-downloaded) — don't commit or delete.

## Before Starting Any Task

**Always read these files first** to understand the project context and current progress:

- **`plan/PLAN.md`** — Implementation plan with phase checklists, feature descriptions, architecture, and project structure. This is the source of truth for what has been built, what is in progress, and what is planned next.
- **`README.md`** — Project overview, features, and quick start guide.

Do NOT begin working on any task until you have read and understood both files above.

## Important Rules

**Keep documentation in sync with code.** Whenever source code is changed or updated, you MUST also update the following files to reflect those changes:

- **`plan/PLAN.md`** — Update phase checklists, feature descriptions, and any architectural details that changed.
- **`README.md`** — Update if commands, features, or setup steps changed.
- **`plan/SETUP_GUIDE.md`** — Update if scopes, commands, user-facing behavior, or setup steps changed.

Do not consider a task complete until all three documentation files are verified and updated as needed.

## Code Quality & SonarQube Conventions

This project enforces SonarQube rules. All new and modified code MUST follow these conventions.

### TypeScript Best Practices (S7772, S7773, S7723)

- **Node built-in imports** — Use the `node:` prefix: `import path from "node:path"`, not `"path"`.
- **Global methods** — Use `Number.parseFloat()`, `Number.parseInt()`, `Number.isNaN()` instead of the global `parseFloat`, `parseInt`, `isNaN`.
- **Array constructor** — Use `new Array()` instead of `Array()` (always use `new`).

### Optional Chaining & Null Safety (S6582)

- Prefer optional chain expressions over manual null guards:
  - `if (bill?.status !== "active")` instead of `if (!bill || bill.status !== "active")`
  - `bill?.channel_id` instead of `bill && bill.channel_id`

### String & RegExp Methods (S7781, S6594)

- **String replace** — Use `String#replaceAll()` instead of `String#replace()` with the `/g` flag. For simple patterns use a string argument: `.replaceAll(",", "")`.
- **RegExp exec** — Use `regex.exec(string)` instead of `string.match(regex)`.

### Regular Expressions (S5843, S6535)

- **Regex complexity** — Keep regex complexity under 20. Use Unicode property escapes (`\p{Script=Thai}` with the `u` flag) instead of raw Unicode ranges (`\u0E00-\u0E7F`) to reduce nesting complexity.
- **Unnecessary escapes** — Do not escape characters that don't need it inside character classes (e.g., use `/` not `\/`).

### Array Operations (S7778)

- **Consecutive push** — Do not call `Array#push()` multiple times in a row. Combine into a single call:
  ```ts
  // Bad
  blocks.push(a);
  blocks.push(b);

  // Good
  blocks.push(a, b);
  ```

### Control Flow & Complexity (S3776, S3358, S1751, S7785)

- **Cognitive complexity** — Keep function cognitive complexity at or below 15. Extract helper functions to reduce nested `if/else` branching.
- **Nested ternaries** — Extract nested ternary operations into a separate function or use `if` statements.
- **Valid loops** — Loop bodies must allow more than one iteration. If every path returns or throws, restructure using `continue`.
- **Async startup** — Prefer a named async function + call over an async IIFE: `async function start() { ... } start();`

### Error Handling (S2486)

- **Empty catch blocks** — Never leave a catch block empty. At minimum add `console.debug()` with context explaining why the error is expected/ignored.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (droppdeadz/slack-bill-splitting) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
