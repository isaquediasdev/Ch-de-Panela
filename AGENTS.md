# Agents

> **Shared source of truth for all AI agents (Claude Code, Codex). Read before any task.**

## ⚠️ Logging Rule (MANDATORY for every agent)

Whenever you (Claude **or** Codex) finish a change, find a bug, make an architecture
decision, or notice anything relevant about the project:

1. **Immediately append an entry to [`WORKLOG.md`](./WORKLOG.md)** (repo root) with:
   timestamp, author (`Claude`/`Codex`), what was done/found, files touched, and the
   next step / open item.
2. **Before starting any task, READ `WORKLOG.md`** to stay aligned with the other agent.

This keeps both agents in sync — no duplicated work, no conflicts.

## Operating Rules

- Preserve user changes. Do not revert files unless explicitly requested.
- Keep production secrets out of Git.
- Prefer small, reviewable changes.
- When changing behavior, run the closest available verification.
- Do not edit SQLite database files as source artifacts.

## Project Commands

```bash
npm install
npm rebuild
npm start
node --check server.js
npm audit --omit=dev
```

## Workstreams For Parallel Codex Agents

### Agent 1: Frontend/Vercel

- Keep user-facing pages in `public/`.
- Prepare a static frontend deployable to Vercel.
- Replace direct assumptions about local Express routes only after backend API URLs are finalized.
- Add Vercel config only when the final frontend/backend routing decision is made.

### Agent 2: Supabase/Data

- Design Supabase Postgres schema for users, carts, orders, order items, reserved items, and login codes.
- Replace SQLite access in `server.js` or split API functions to use Supabase.
- Create migration scripts instead of manual database edits.
- Confirm Row Level Security and service-role boundaries before production.

### Agent 3: Auth/Admin/Security

- Move config/secrets from `server.js` to `.env`.
- Replace admin password in query string with login/session or Supabase-backed admin role.
- Harden sessions/cookies for production.
- Fix Pagar.me webhook raw-body validation before enabling card/Pagar.me payments.

### Agent 4: DNS/Deployment

- Cloudflare should own DNS for the Isana domain.
- Vercel should receive the frontend domain.
- Backend/API destination must be chosen before DNS rules are finalized.
- Document all DNS records and redirects in `docs/deployment-plan.md`.

## Current Blockers

- Need access to Cloudflare zone for the Isana domain.
- Need Vercel account/project access.
- Need visible Supabase MCP tooling or Supabase credentials/project reference.
- Need final domain names, for example apex domain and `www`.
