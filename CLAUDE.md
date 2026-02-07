# CLAUDE.md

## Project

Slack Bill Splitting - A Slack bill-splitting bot inspired by KBANK's Khunthong. Built with TypeScript, Slack Bolt, and SQLite.

## Commands

- `pnpm install` — Install dependencies
- `pnpm build` — Compile TypeScript
- `pnpm dev` — Run dev server with hot reload
- `pnpm db:migrate` — Run database migrations
- `pnpm db:reset` — Delete database and restart dev server

## Before Starting Any Task

**Always read these files first** to understand the project context and current progress:

- **`plan/PLAN.md`** — Implementation plan with phase checklists, feature descriptions, architecture, and project structure. This is the source of truth for what has been built, what is in progress, and what is planned next.
- **`README.md`** — Project overview, features, and quick start guide.

Do NOT begin working on any task until you have read and understood both files above.

## Important Rules

**Keep documentation in sync with code.** Whenever source code is changed or updated, you MUST also update the following files to reflect those changes:

- **`plan/index.md`** — Update phase checklists, feature descriptions, and any architectural details that changed.
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
