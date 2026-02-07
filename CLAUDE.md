# CLAUDE.md

## Project

Copter - A Slack bill-splitting bot inspired by KBANK's Khunthong. Built with TypeScript, Slack Bolt, and SQLite.

## Commands

- `pnpm install` — Install dependencies
- `pnpm build` — Compile TypeScript
- `pnpm dev` — Run dev server with hot reload
- `pnpm db:migrate` — Run database migrations
- `pnpm db:reset` — Delete database and restart dev server

## Before Starting Any Task

**Always read these files first** to understand the project context and current progress:

- **`PLAN.md`** — Implementation plan with phase checklists, feature descriptions, architecture, and project structure. This is the source of truth for what has been built, what is in progress, and what is planned next.
- **`README.md`** — Project overview, features, and quick start guide.

Do NOT begin working on any task until you have read and understood both files above.

## Important Rules

**Keep documentation in sync with code.** Whenever source code is changed or updated, you MUST also update the following files to reflect those changes:

- **`PLAN.md`** — Update phase checklists, feature descriptions, and any architectural details that changed.
- **`README.md`** — Update if commands, features, or setup steps changed.
- **`SETUP_GUIDE.md`** — Update if scopes, commands, user-facing behavior, or setup steps changed.

Do not consider a task complete until all three documentation files are verified and updated as needed.
