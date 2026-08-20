# CLAUDE.md — Lion Wallet

This file exists so Claude Code auto-ingests project context. The canonical single-file orientation is [`AGENTS.md`](./AGENTS.md) — read that for architecture, the message protocol, and where to add things.

For product philosophy see [`docs/PHILOSOPHY.md`](./docs/PHILOSOPHY.md). Coding conventions live in [`docs/STYLE_GUIDE.md`](./docs/STYLE_GUIDE.md) (append-only).

Quick reference (same as AGENTS.md):
- Framework: **Solid.js**, not React or Preact
- Build: **Vite** (popup) + **Rolldown** (background/content/inpage)
- Type-check: **tsgo** (`task typecheck`), not `tsc`
- Package manager: **pnpm** only
- Commands: **Task** (`Taskfile.yml`), not `package.json` scripts
- Lint/format: **Biome** (`task lint`, `task lint-fix`)

Always run `task typecheck` and `task lint` before opening a PR.
