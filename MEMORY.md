# Memory

## Project

- Name: Cha de Panelas / Isana.
- Repository: `isaquediasdev/Ch-de-Panela`.
- Current branch: `main`.
- Product: gift list for Ana Clara & Isaque's kitchen tea.
- Event date: June 20, 2026.

## Current Architecture

- Runtime: Node.js + Express.
- Entry point: `server.js`.
- Frontend: static HTML/CSS/JS in `public/`.
- Database: local SQLite files (`data.db`, `sessions.db`), ignored by Git.
- Auth: email one-time code stored in SQLite.
- Payments:
  - Static PIX through `pix-utils`.
  - Pagar.me integration exists but keys are not configured.
  - Manual/admin payment confirmation exists.

## Target Architecture

- GitHub: use Isaque's account/repository, currently `isaquediasdev/Ch-de-Panela`.
- Frontend hosting: Vercel.
- DNS: Cloudflare for the Isana domain.
- Database/backend services: Supabase, replacing local SQLite for production data.

## Known Local State

- GitHub CLI is authenticated as `isaquediasdev`.
- The authenticated GitHub account has admin permission on the repository.
- `vercel`, `wrangler`, and `supabase` CLIs are not installed locally.
- Supabase MCP **IS available** (confirmed in a Claude session, 2026-05-26): `list_projects`, `list_tables`, `execute_sql`, `apply_migration`, etc. all work.
- Supabase already has a project **"juda"** (`titpyhocbzvnzlieckde`, region sa-east-1) — but it belongs to **another system** (tables: tenants/user_tenants/sales with 915 rows). **Do NOT use it.** A dedicated Supabase project must be created for the chá (pending user confirmation).
- Current Node is `v26.0.0`; `better-sqlite3` in `node_modules` was compiled for a different Node ABI and needs rebuild/reinstall before the server runs locally.

## Important Risks

- Production secrets are currently hardcoded in `server.js` and should move to environment variables.
- The admin password is currently sent in query strings and should become session-based auth.
- Pagar.me webhook body parsing likely needs adjustment before production use.
- Static Vercel hosting alone cannot run the current Express/SQLite app; the backend/data layer must be migrated or hosted separately.
