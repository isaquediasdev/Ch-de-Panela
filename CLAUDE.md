# CLAUDE.md

**`AGENTS.md` is the shared source of truth for this project.** Read it before any task.
This file exists so Claude Code picks up the same rules Codex follows.

## ⚠️ Logging Rule (MANDATORY)

Whenever you finish a change, find a bug, make a decision, or notice anything relevant
about the project:

1. Append an entry to **`WORKLOG.md`** (repo root): timestamp, author (`Claude`/`Codex`),
   what/why, files touched, next step.
2. Before starting a task, **read `WORKLOG.md`** to align with the other agent (Codex).

Architecture, parallel workstreams, data model and migration plan live in
**`AGENTS.md`** and **`docs/deployment-plan.md`**.

## Project quick facts

- Repo: `isaquediasdev/Ch-de-Panela` (branch `main`). Wedding/kitchen-tea, event 20/06/2026.
- Couple: Ana Clara & Isaque. Domain: **Isana** (DNS on Cloudflare).
- **Target stack:** Vercel (static frontend + serverless API) + Supabase Postgres +
  Cloudflare DNS. Email OTP via an HTTP service (ZeptoMail/Resend) or SMTP — TBD.
- **Legacy (being migrated):** single `server.js` (Express + better-sqlite3 +
  express-session). Run locally with Node 22:
  `/opt/homebrew/opt/node@22/bin/node server.js` (port 3000).
- **Rules of thumb:** values are *symbolic contributions*, never store prices;
  user-facing text in Portuguese; never commit secrets (`.env` is gitignored);
  test before marking done, then log it in `WORKLOG.md`.
