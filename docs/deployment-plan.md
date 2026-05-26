# Deployment Plan

## Feasibility

The requested direction is possible, but not as a pure "upload current project to Vercel" task.

The current app is an Express server with SQLite. Vercel can host the static frontend, but production data should move from SQLite to Supabase, and the API layer must either move to Vercel Serverless Functions, Supabase Edge Functions, or another Node hosting service.

## Current Verified State

- Git remote: `https://github.com/isaquediasdev/Ch-de-Panela.git`
- GitHub account: `isaquediasdev`
- GitHub permission: admin on the repo
- Vercel CLI: not installed locally
- Cloudflare Wrangler CLI: not installed locally
- Supabase CLI: not installed locally
- Supabase MCP: no resources/tools visible in this session

## Recommended Production Shape

### Option A: Vercel Frontend + Vercel API + Supabase Postgres

- `public/` becomes the frontend deployed by Vercel.
- API routes are converted from Express handlers to Vercel serverless functions.
- Supabase Postgres replaces SQLite.
- Good fit if the app should remain mostly JavaScript/Node.

### Option B: Vercel Frontend + Supabase Edge Functions + Supabase Postgres

- `public/` becomes the frontend deployed by Vercel.
- Supabase Edge Functions own backend logic.
- Supabase Postgres replaces SQLite.
- Good fit if the backend should live fully inside Supabase.

### Option C: Vercel Frontend + External Express Backend + Supabase Postgres

- Vercel hosts only frontend.
- Existing Express backend is kept and deployed to a Node host.
- Supabase Postgres replaces SQLite.
- Lowest migration effort for backend code, but adds another hosting surface.

## Cloudflare DNS

Exact records depend on the final domain, but the usual Vercel setup is:

- Apex domain (`isana.com.br`, example): `A` record to Vercel's apex IP or use Vercel-provided instructions.
- `www`: `CNAME` to `cname.vercel-dns.com`.
- Redirects:
  - `www` to apex, or apex to `www`, choose one canonical domain.
  - Any legacy paths can be configured with Cloudflare Redirect Rules or Vercel redirects.

Cloudflare changes require access to the zone for the Isana domain.

## Supabase Migration Targets

Tables to migrate:

- `users`
- `cart_items`
- `orders`
- `order_items`
- `reserved_items`
- `login_codes`

Production decisions needed:

- Use Supabase Auth OTP or keep the current custom OTP flow.
- Decide whether admin users are a role in Supabase or a separate admin table.
- Decide whether gift items stay as code/static JSON or move into a Supabase table.

## Immediate Next Steps

1. Rebuild local dependencies so the app runs with the current Node version.
2. Move secrets/config from `server.js` to environment variables.
3. Choose backend target: Vercel API, Supabase Edge Functions, or external Express host.
4. Create Supabase schema migrations.
5. Configure Vercel project from the GitHub repo.
6. Configure Cloudflare DNS after Vercel gives the target records.
