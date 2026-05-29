# WORKLOG — shared agent log (Claude + Codex)

Append-only diary. **Newest entries on top.** Read this before starting a task; write
here whenever you finish something, decide something, or find a bug.

**Entry format:**

```
## [YYYY-MM-DD HH:MM] — <Claude|Codex> — <short title>
- **What:** what was done / found / decided
- **Files:** files touched (if any)
- **Next / open:** next step or open question
```

---

## [2026-05-27 03:00] — Claude — HANDOFF.md atualizado + commit dos artefatos do deploy
- **What:** A Ana pediu pra documentar tudo (vai abrir num novo chat). Reescrevi o
  `HANDOFF.md` pra refletir o estado REAL atual: o site já está em
  `https://cha-panelas.vercel.app` (deployed), Brevo integrado, falta SÓ o DNS no
  Cloudflare (4 registros Brevo + 1 CNAME pro subdomínio do chá).
- **Commit do deploy ainda não estava no Git:** `api/index.js`, `vercel.json`,
  `.vercelignore`, edits em `server.js` (Brevo + SHOW_DEV_CODE + dotenv quiet),
  `package.json`/`lock` (jose ^5), `.gitignore` (+.vercel) e as entradas anteriores
  do WORKLOG só existiam local. Commito todos juntos agora pra o próximo chat ver
  o estado real ao puxar o repo. `.env` continua gitignored.
- **Files:** `HANDOFF.md` (reescrito), `WORKLOG.md` (esta entrada).
- **Next:** Próximo chat → começar em `HANDOFF.md` → seção **PRÓXIMOS PASSOS**.
  Resumo: casal insere DNS no Cloudflare → autenticar domínio Brevo → setar
  `BREVO_API_KEY`+`EMAIL_FROM` na Vercel + remover `SHOW_DEV_CODE` → redeploy →
  CNAME `cha` no Cloudflare → adicionar domínio no projeto Vercel.

## [2026-05-27 02:25] — Claude — Brevo OK (IP liberado) + domínio add; faltam DNS
- **IP restriction desligada** → chave de API do Brevo funciona (200). Conta **Isana**
  (`isaquebarbosa.dev@gmail.com`), free 300/dia. Remetente ativo já existe:
  `isaquebarbosa.dev@gmail.com` (id 1). SMTP relay (caso precise): user
  `aca682001@smtp-brevo.com`, `smtp-relay.brevo.com:587`.
- **Domínio `isana.ia.br` adicionado no Brevo** (id `6a1655c39ca547d25903c24f`,
  authenticated:false). Registros DNS p/ autenticar (Brevo detectou provider=Cloudflare):
  - `CNAME brevo1._domainkey` → `b1.isana-ia-br.dkim.brevo.com`  (DNS only / sem proxy)
  - `CNAME brevo2._domainkey` → `b2.isana-ia-br.dkim.brevo.com`  (DNS only / sem proxy)
  - `TXT @` → `brevo-code:7862b9f89b71bb19475e6628497e6a36`
  - `TXT _dmarc` → `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`  (opcional, status já true)
- **Cloudflare MCP NÃO edita DNS** (só Workers/D1/KV/R2 + docs). Preciso de **token de
  API Cloudflare** (template "Edit zone DNS", zona `isana.ia.br`) OU casal no painel.
- **Próximo:** DNS no Cloudflare → autenticar domínio no Brevo → setar
  `BREVO_API_KEY`+`EMAIL_FROM` na Vercel → teste real de envio → **remover
  SHOW_DEV_CODE** → redeploy → `CNAME cha.isana.ia.br` → Vercel.

## [2026-05-26 23:40] — Claude — Brevo via API HTTP + bloqueio de IP descoberto
- **Change:** `sendLoginCodeEmail` agora envia pela **API HTTP do Brevo**
  (`POST /v3/smtp/email`, header `api-key`) quando `BREVO_API_KEY` está setada; SMTP/
  nodemailer vira fallback. Melhor p/ serverless (sem conexão SMTP). Chave do Brevo
  (a "MCP key" base64 que o casal mandou = `{"api_key":"xkeysib-…"}`) decodificada e
  guardada no `.env` (gitignored). **NÃO setada na Vercel ainda** — senão quebraria o
  modo devCode atual antes do domínio estar autenticado.
- **Bloqueio:** a chave de API veio com **"Authorised IPs" ativo** no Brevo → toda
  chamada dá `401 unrecognised IP`. Vercel não tem IP de saída fixo → tem que
  **DESLIGAR a restrição de IP** (app.brevo.com/security/authorised_ips), não
  whitelistar. Trava testes da API + autenticação de domínio até desligar.
- **Files:** `server.js` (sendLoginCodeEmail reescrito), `.env` (+BREVO_API_KEY,
  +EMAIL_HOST/PORT/SECURE Brevo, +EMAIL_FROM). Code change ainda NÃO redeployado
  (inerte na Vercel sem BREVO_API_KEY → devCode segue funcionando).
- **Aguardando casal:** (1) desligar Authorised IPs no Brevo; (2) acesso Cloudflare
  (token DNS ou painel). Depois (Claude): validar chave → add domínio via API → pegar
  DNS → Cloudflare → autenticar → setar BREVO_API_KEY+EMAIL_FROM na Vercel → teste
  real → remover SHOW_DEV_CODE → redeploy → apontar cha.isana.ia.br.

## [2026-05-26 23:10] — Claude — E-mail OTP: escolhido Brevo + suporte a EMAIL_FROM
- **Decisão (casal):** serviço de envio do código de login = **Brevo** (SMTP, plano
  grátis 300/dia, remetente do domínio). Resend foi a alternativa avaliada (entrega
  ligeiramente melhor, mas teto de 100/dia) — escolhido Brevo pela folga diária + PT-BR.
- **Change:** `server.js` agora aceita **`EMAIL_FROM`** separado do `EMAIL_USER` (no
  Brevo o login SMTP ≠ endereço remetente). Fallback p/ EMAIL_USER se EMAIL_FROM vazio
  (Gmail continua funcionando sem mudança). `.env` pré-preenchido com SMTP do Brevo
  (`smtp-relay.brevo.com:587`, secure=false, EMAIL_FROM=cha@isana.ia.br).
- **Files:** `server.js` (CONFIG.email.from + uso no campo `from`), `.env`.
- **Aguardando do casal:** (1) criar conta Brevo + gerar **chave SMTP**; (2) adicionar
  domínio no Brevo → ele gera **registros DNS** (DKIM/verificação); (3) **acesso ao
  Cloudflare** (token DNS ou painel) p/ inserir os registros.
- **Depois (Claude):** setar EMAIL_* na Vercel (Production) → autenticar domínio →
  enviar e-mail de teste real → **remover SHOW_DEV_CODE** → redeploy. Aí o domínio
  `cha.isana.ia.br` pode ser apontado.

## [2026-05-26 22:35] — Claude — Deploy na Vercel no ar (cha-panelas.vercel.app) ✅
- **What:** Empacotei o Express pra Vercel e publiquei em **produção**. Site testado
  **ponta a ponta** contra o Supabase real: estático (8 páginas → 200), API pública
  (config / items / stats), login por cookie JWT (verify→me), carrinho, checkout
  atômico (`place_order`), admin (senha certa 200 / errada 403). Banco **truncado**
  de novo (0 linhas) após o teste → base limpa.
- **URL de teste:** https://cha-panelas.vercel.app — projeto `cha-panelas`
  (`prj_qLWJK1NfQUoBRVCe8oblYGq779XE`, time `team_X6djzH2eg3IbgVr8yurfn6yk`).
- **Bug achado/corrigido:** `jose` v6 é **ESM-only**; `require('jose')` quebrava no
  Node da Vercel → `server.js` não carregava → TODA rota `/api/*` dava 500
  `FUNCTION_INVOCATION_FAILED` (estático funcionava). Fix: **`jose@^5`** (dual
  CJS/ESM, API idêntica, 0 mudança de código). Local passava por usar Node 22.12+
  (require-esm nativo).
- **Files:** `api/index.js` (entrypoint serverless → reexporta o app de server.js),
  `vercel.json` (rewrite `/api/(.*)`→`/api/index`; `public/` servido estático pela
  Vercel), `.vercelignore` (não sobe `.env`/`*.db`/`node_modules`/`*.md`), `.gitignore`
  (+`.vercel`), `server.js` (flag `SHOW_DEV_CODE` + `dotenv {quiet:true}`),
  `package.json`/`lock` (jose ^6→^5).
- **Env vars (Production, via `vercel env add` lendo do `.env`):** SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ADMIN_PASSWORD, SHOW_DEV_CODE=true.
  ⚠️ Não existe tool de env var no MCP da Vercel — feito pelo CLI (logado como
  `isaquebarbosadev-1000`).
- **Modo teste:** sem e-mail configurado, `SHOW_DEV_CODE=true` devolve o código de
  login na resposta (mostra na tela). A Vercel força `NODE_ENV=production` no runtime,
  então o gate antigo (`NODE_ENV!==production`) nunca mostraria o código. ⚠️ INSEGURO
  pro público — qualquer um loga como qualquer e-mail. Só pra teste no link `.vercel.app`.
- **Next / open (2 bloqueios, dependem do casal):**
  1. **E-mail OTP** (Isaque/Zoho): setar EMAIL_* na Vercel → remover SHOW_DEV_CODE →
     redeploy. Só então é seguro abrir pro público.
  2. **DNS `cha.isana.ia.br`** (Cloudflare): apontar SÓ depois do e-mail. Adicionar
     domínio no projeto Vercel + CNAME no Cloudflare. MCP Cloudflare não tem tool de
     DNS → precisa de API token ou dashboard.
- **Deploy é direto via CLI** (não ligado ao GitHub ainda) — futuras mudanças exigem
  `vercel deploy --prod` ou conectar o repo `isaquediasdev/Ch-de-Panela` na Vercel.

## [2026-05-26] — Claude — Backend migrated to Supabase + JWT (tested locally) ✅
- **What:** Rewrote `server.js` to use **Supabase** (instead of better-sqlite3) and a
  **stateless JWT cookie** (instead of express-session). New shared modules:
  `lib/supabase.js`, `lib/auth.js`, `lib/items.js` (77 items). Added deps
  `@supabase/supabase-js` + `jose`; removed `better-sqlite3`, `connect-sqlite3`,
  `express-session`, `bcryptjs` (unused now, and better-sqlite3 would break the Vercel
  build). `server.js` exports the Express `app` and only `listen`s when run directly
  (ready to wrap for Vercel).
- **DB function:** `place_order(p_user_id, p_items jsonb)` RPC = atomic checkout
  (conflict check + order + order_items + reserved_items + clear cart in one tx).
  Hardened: `execute` revoked from anon/authenticated (only service_role calls it).
- **Tested locally vs real Supabase — all green:** register→code→verify (cookie login),
  cart add/list, atomic order, cash, /orders/me, admin (name+phone+pay), reserve conflict
  (409), admin cancel (cascade frees gift). Test rows truncated afterwards.
- **Security:** RLS on all tables, no anon policies (service-role-only) — INFO advisories
  are expected/intended.
- **Next / open:** Vercel deploy = wrap app + `vercel.json` + set env vars on Vercel
  (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_PASSWORD`,
  `NODE_ENV=production`) → then Cloudflare DNS for `cha.isana.ia.br`. Email service TBD.
- **For Codex:** frontend (`public/*`) is essentially unchanged (same `/api` endpoints).
  Backend (`server.js`, `lib/`) is Claude's workstream — please don't edit those.

## [2026-05-26] — Claude — Access verified (Vercel + Cloudflare) + domain = isana.ia.br
- **Domain:** `isana.ia.br` (DNS on Cloudflare). Chá subdomain **confirmed by user:
  `cha.isana.ia.br`** (`casamento.` is the couple's other Vite site).
- **Vercel:** team "Isaque's projects" (`team_X6djzH2eg3IbgVr8yurfn6yk`). Existing
  projects: juda, countdown, fincontrol, leticia-50, **casamento**. ⚠️ "casamento" is a
  **separate Vite app** already serving `casamento.isana.ia.br` — NOT our chá. We must
  create a **NEW Vercel project** for this repo (`Ch-de-Panela`).
- **Cloudflare:** account `cca2706351d43ee2c7ac894059541c97`
  (Isaquebarbosa.dev@gmail.com). ⚠️ The connected Cloudflare MCP is Workers/D1/KV/R2-
  focused — **no DNS-record tools visible**. The chá subdomain DNS may need an API token
  or the dashboard.
- **Supabase:** API URL `https://fwhnsizxqthbugviraoo.supabase.co`.
- **Blocker (need from Isaque):** Supabase **service_role** secret key — NOT exposed via
  MCP; copy from Supabase dashboard → Project Settings → API. Needed as a Vercel env var
  (`SUPABASE_SERVICE_ROLE_KEY`) + local `.env` so the serverless functions can read/write
  the DB. Also will need a `JWT_SECRET` (any long random string) for cookie auth.
- **Next / open:** confirm subdomain + get service_role key → then build migration
  (Express → `/api/*` serverless + Supabase + JWT cookie auth) and deploy via Vercel MCP.

## [2026-05-26] — Claude — Supabase project + schema created
- **What:** Created dedicated Supabase project **cha-panelas-isana** (ref
  `fwhnsizxqthbugviraoo`, sa-east-1, free $0/mo) and applied migration `initial_schema`:
  tables `users`, `cart_items`, `orders`, `order_items`, `reserved_items`,
  `login_codes` — all RLS-enabled (API uses the **service_role** key, which bypasses
  RLS; no anon/public access).
- **Schema notes:** dropped legacy `password_hash` (OTP-only auth now).
  `reserved_items.order_id` is now `on delete cascade` (cancelling/deleting an order
  auto-frees the gift). Gift items stay in code for now (not yet a DB table).
- **Next / open:** Vercel access, Cloudflare token, email service still pending. The
  code migration (Express routes → `/api/*` serverless + Supabase client + JWT cookie
  auth) can start now; split with Codex per the AGENTS.md workstreams.

## [2026-05-26] — Claude — Coordination set up + Supabase MCP confirmed

- **What:** Read Codex's `AGENTS.md`, `MEMORY.md` and `docs/deployment-plan.md` and
  aligned with them. Added the mandatory **logging rule** to `AGENTS.md`, created
  `CLAUDE.md`, and created this `WORKLOG.md` as the shared diary both agents must use.
- **Supabase:** MCP **is** available (Codex couldn't see it before). Existing project
  **"juda"** (`titpyhocbzvnzlieckde`, sa-east-1) belongs to ANOTHER system
  (tenants/sales, 915 rows) → **do NOT use it.** Need a dedicated project for the chá.
- **Decision:** backend target = **Option A** (Vercel serverless API + Supabase
  Postgres). Sessions must become **stateless JWT in an httpOnly cookie**
  (express-session can't run on Vercel serverless).
- **Files:** `AGENTS.md`, `CLAUDE.md`, `MEMORY.md`, `WORKLOG.md`.
- **Next / open (blockers awaiting the couple):**
  1. Confirm creating a **dedicated Supabase project** for the chá.
  2. **Vercel** access (connect the GitHub repo / CLI token).
  3. **Cloudflare** API token for the Isana zone (to create DNS records).
  4. **Email** service decision for the OTP code (ZeptoMail/Resend/SMTP).
  Once unblocked: create schema migration → port API routes to `/api/*` → wire
  Supabase client + JWT auth → deploy to Vercel → point Cloudflare DNS.
