# HANDOFF — Chá de Panelas (Isana)

> **Para o próximo agente / próximo chat.** Leia este arquivo **antes** de qualquer
> outra coisa, depois `WORKLOG.md` (linha do tempo completa), `AGENTS.md`,
> `CLAUDE.md` e `MEMORY.md`.
>
> Última atualização: 2026-05-27 — by Claude. Ana vai abrir num **novo chat**; o
> trabalho deve continuar exatamente daqui.

---

## TL;DR

- **O site JÁ ESTÁ NO AR** em `https://cha-panelas.vercel.app` (testado ponta-a-ponta
  contra o Supabase de produção). 🎉
- Stack: **Vercel** (frontend estático + 1 função Express serverless) + **Supabase**
  Postgres + envio de e-mail via **Brevo** (HTTP API).
- **O que falta** é só **DNS no Cloudflare** (4 registros pro Brevo + 1 CNAME pro
  subdomínio do chá) — depende do casal autorizar / colocar.
- Quando o DNS estiver pronto, são ~5 passos pra deixar pronto pro público:
  autenticar domínio no Brevo → setar `BREVO_API_KEY`/`EMAIL_FROM` na Vercel →
  remover `SHOW_DEV_CODE` → redeploy → CNAME `cha.isana.ia.br` → testar.

---

## ⚠️ Aviso de segurança ATUAL

O Vercel hoje está com `SHOW_DEV_CODE=true`. Isso faz o servidor **devolver o código
de login na resposta HTTP** (pra dar pra testar antes do e-mail estar pronto).
**Qualquer pessoa que acessar `cha-panelas.vercel.app` hoje consegue logar como
qualquer e-mail.** É **só pra testes**. Antes de divulgar o link real
(`cha.isana.ia.br`), tem que **remover essa flag e redeployar**.

---

## Fatos do projeto

- **Repo:** `isaquediasdev/Ch-de-Panela` (branch `main`).
- **Casal:** Ana Clara & Isaque. **Evento:** 20/06/2026.
- **Domínio:** `isana.ia.br` (DNS na **Cloudflare**).
- **Subdomínio do chá:** `cha.isana.ia.br` (confirmado pelo casal).
- **Outro site:** `casamento.isana.ia.br` (projeto Vite separado — **não tocar**).
- Valores **simbólicos**, nunca preço de loja. Textos em **português**.

---

## Stack ALVO (= o que está implementado HOJE)

| Camada | Onde | Estado |
|---|---|---|
| Frontend estático | `public/` | ✅ servido pela Vercel |
| API | função serverless única (`api/index.js` → reexporta `server.js`) | ✅ no ar |
| Banco | **Supabase** Postgres `cha-panelas-isana` | ✅ |
| Sessão | **JWT em cookie httpOnly** (`lib/auth.js`, jose **^5**) | ✅ |
| E-mail OTP | **Brevo** API HTTP (fallback SMTP) | ⚙️ código pronto; falta domínio autenticado |
| Hospedagem | **Vercel** projeto `cha-panelas` | ✅ deployed |
| DNS | **Cloudflare** | ⏳ falta inserir registros |

---

## Identificadores / refs / contas

### Vercel (MCP funciona; CLI também — logado como `isaquebarbosadev-1000`)
- **Time:** `Isaque's projects` → `team_X6djzH2eg3IbgVr8yurfn6yk`
- **Projeto do chá:** `cha-panelas` → **`prj_qLWJK1NfQUoBRVCe8oblYGq779XE`**
- **URL atual (teste):** `https://cha-panelas.vercel.app`
- ⚠️ Deploy hoje é via **CLI** (`vercel deploy --prod`). Não está ligado ao GitHub.
  Se quiserem auto-deploy: Settings → Git → Connect Repository →
  `isaquediasdev/Ch-de-Panela`.

### Supabase (MCP funciona)
- **Projeto:** `cha-panelas-isana` → ref **`fwhnsizxqthbugviraoo`**
- **URL:** `https://fwhnsizxqthbugviraoo.supabase.co`
- **Região:** `sa-east-1` (São Paulo) · **Org:** `iofkieyvotvyknoukvpu`
- ⚠️ Outro projeto chamado `juda` existe na mesma org — **NÃO USAR** (é outro sistema).

### Brevo (envio do código)
- Conta **Isana** (`isaquebarbosa.dev@gmail.com`), free 300/dia.
- Remetente já verificado (e-mail individual): `isaquebarbosa.dev@gmail.com` (id 1).
- Domínio `isana.ia.br` adicionado → id `6a1655c39ca547d25903c24f`,
  **`authenticated:false`** até os DNS abaixo serem inseridos.
- API key no `.env` local (gitignored). **Não setada na Vercel ainda** — quando ligar
  lá, o servidor passa a enviar e-mail pra valer (e a flag `SHOW_DEV_CODE` deve sair).
- SMTP relay (caso queira evitar a API): user `aca682001@smtp-brevo.com`,
  `smtp-relay.brevo.com:587` (STARTTLS).
- ⚠️ A restrição **"Authorised IPs"** do Brevo foi DESLIGADA pelo casal (Vercel não tem
  IP de saída fixo). Não religar.

### Cloudflare (MCP é o de Workers/D1/KV/R2; **não edita DNS**)
- Conta: `Isaquebarbosa.dev@gmail.com's Account` → `cca2706351d43ee2c7ac894059541c97`.
- **Para inserir os registros DNS** abaixo, o casal precisa:
  - usar o **painel Cloudflare** (mais simples), OU
  - gerar um **API Token** com permissão `Zone:DNS:Edit` na zona `isana.ia.br` e me
    passar (eu insiro por curl/API).

### GitHub
- CLI logada como `isaquediasdev`. Admin no repo.

---

## 🔧 Registros DNS PENDENTES no Cloudflare (mais importante)

Inserir **todos como "DNS only" (nuvem cinza, sem proxy)**:

### Pro Brevo autenticar `isana.ia.br` (envio de e-mail)

| Tipo | Nome | Valor | Observação |
|---|---|---|---|
| `CNAME` | `brevo1._domainkey` | `b1.isana-ia-br.dkim.brevo.com` | DKIM #1 |
| `CNAME` | `brevo2._domainkey` | `b2.isana-ia-br.dkim.brevo.com` | DKIM #2 |
| `TXT` | `@` (apex) | `brevo-code:7862b9f89b71bb19475e6628497e6a36` | verificação |
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | opcional, DMARC já está true |

Depois de inserir, voltar no painel Brevo → Senders, Domains & Dedicated IPs →
clicar **Authenticate this domain**.

### Pro subdomínio do chá apontar pra Vercel (só depois de cuidar do SHOW_DEV_CODE)

| Tipo | Nome | Valor | Observação |
|---|---|---|---|
| `CNAME` | `cha` | `cname.vercel-dns.com` | **DNS only** (nuvem cinza) |

E no painel Vercel: Project `cha-panelas` → Settings → Domains → adicionar
`cha.isana.ia.br`.

---

## Variáveis de ambiente

### No `.env` LOCAL (gitignored, não commitar)
- `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `JWT_SECRET` · `ADMIN_PASSWORD`
- `EMAIL_FROM=cha@isana.ia.br` · `BREVO_API_KEY=xkeysib-…`
- `EMAIL_HOST=smtp-relay.brevo.com` · `EMAIL_PORT=587` · `EMAIL_SECURE=false`
  · `EMAIL_USER=` · `EMAIL_APP_PASSWORD=` (fallback SMTP)

### Já setadas na Vercel (Production)
Foi feito via CLI (`vercel env add`, logado como `isaquebarbosadev-1000`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_PASSWORD`,
  `SHOW_DEV_CODE=true`.

### Ainda PRECISAM ser setadas na Vercel (quando o DNS Brevo passar)
- `BREVO_API_KEY` (do `.env` local)
- `EMAIL_FROM` (= `cha@isana.ia.br`)
- **REMOVER** `SHOW_DEV_CODE` (ou setar `false`) → daí redeploy.

⚠️ O MCP da Vercel **não tem ferramenta de env var**. Tem que ser CLI (`vercel env add NOME production`) ou painel (Project → Settings → Environment Variables → Production).

---

## Banco (Supabase)

### Schema `public`

| Tabela | Função |
|---|---|
| `users` | id, name, email (único), phone, created_at |
| `cart_items` | user_id, item_id, unique(user_id, item_id) |
| `orders` | id, user_id, total, status (`pending`/`paid`), payment_method, external_payment_id |
| `order_items` | snapshot do preço. `ON DELETE CASCADE` |
| `reserved_items` | item_id PK, order_id. `ON DELETE CASCADE` (cancelar libera) |
| `login_codes` | OTP: email, code, name, phone, expires_at, used |

Todas com **RLS on, sem policies** = só `service_role` acessa. Esperado.

### Função RPC

- `place_order(p_user_id bigint, p_items jsonb)` → checkout atômico (confere conflito
  → cria order → order_items → reserved_items → limpa cart). `EXECUTE` revogado de
  `anon`/`authenticated` (só `service_role` chama).

### Migrations aplicadas
1. `initial_schema` · 2. `place_order_function` · 3. `lock_down_place_order`

---

## Estrutura de arquivos

```
/
├── server.js              # Express + Supabase + JWT. Exporta `app`. Listen só se rodado direto.
├── api/
│   └── index.js           # Entrypoint da Vercel: module.exports = require('../server.js')
├── vercel.json            # Rewrites /api/(.*) → /api/index; public/ é estático.
├── .vercelignore          # Não sobe .env, .git, *.db, node_modules, *.md, docs/
├── .gitignore             # +.vercel adicionado
├── lib/
│   ├── supabase.js        # cliente com service_role
│   ├── auth.js            # cookie JWT (jose ^5)
│   └── items.js           # 77 itens
├── public/                # frontend estático (intacto desde o legado)
├── package.json           # deps: express, @supabase/supabase-js, jose ^5,
│                          #       dotenv, qrcode, pix-utils, nodemailer
├── .env                   # GITIGNORED — segredos
├── AGENTS.md / CLAUDE.md  # regras compartilhadas (regra de log obrigatória)
├── WORKLOG.md             # diário cronológico — LEIA aqui antes de mexer
├── MEMORY.md              # fatos do projeto
└── HANDOFF.md             # ESTE arquivo
```

---

## ⚠️ Gotchas (cuidado!)

- **`jose` precisa ser `^5`** (não `^6`). v6 é ESM-only e quebra o `require()` na
  Vercel — toda rota `/api/*` virava 500. Local funciona pq Node 22+ permite
  require-ESM, mas Vercel não. **Se subir pra ^6 de novo, vai quebrar.**
- **`SHOW_DEV_CODE` é INSEGURO em produção** — qualquer um loga como qualquer e-mail.
  Manter `true` SÓ no domínio `.vercel.app` enquanto testa. **Remover antes do
  `cha.isana.ia.br` ir pro ar.**
- A Vercel força `NODE_ENV=production`. Foi por isso que precisou da flag explícita
  (o gate antigo `NODE_ENV!==production` nunca rodava lá).
- `.env` **nunca commitar** (já está no .gitignore). Tem segredos do Supabase e Brevo.
- `pix-utils` está fixado em `1.0.0` (versões maiores quebravam).
- `better-sqlite3`/`connect-sqlite3`/`express-session`/`bcryptjs` foram **REMOVIDOS** —
  não rodam em serverless e travariam o build. Não reinstalar.
- Cloudflare MCP atual **não edita DNS** — Workers/D1/KV/R2 só. Pra DNS: token ou painel.

---

## ✅ Já testado em produção (cha-panelas.vercel.app)

Fluxo end-to-end contra Supabase real:
- Estático: 8 páginas (200).
- API pública: `/api/config`, `/api/items`, `/api/items/stats` (200).
- Auth: cadastro → devCode → verify (cookie JWT) → `/api/auth/me`.
- Carrinho: add/list.
- Checkout: pedido atômico via `place_order` RPC.
- Admin: senha certa 200 / errada 403.
- Banco **truncado** (`users`, `orders`, `login_codes` cascade) → base limpa pro launch.

---

## 🚀 PRÓXIMOS PASSOS (faça nesta ordem)

1. **Casal insere os 4 registros DNS no Cloudflare** (tabela acima — Brevo).
2. Brevo → "Authenticate this domain" (vai verificar os CNAMEs/TXT). Status deve
   passar pra `authenticated:true`.
3. Cadastrar `BREVO_API_KEY` e `EMAIL_FROM` na **Vercel** (Production).
4. **Remover** `SHOW_DEV_CODE` da Vercel (ou setar `false`).
5. Redeploy: `vercel deploy --prod` (ou push se o GitHub estiver ligado).
6. Teste real: cadastrar com e-mail próprio → o código tem que **chegar no inbox** de
   `cha@isana.ia.br`-from. Logar normalmente. `/api/auth/...` não deve devolver
   `devCode` mais.
7. Casal adiciona o **CNAME `cha` → `cname.vercel-dns.com`** no Cloudflare.
8. Vercel → projeto `cha-panelas` → Settings → Domains → adicionar `cha.isana.ia.br`.
   Esperar SSL (~minutos).
9. Acessar `https://cha.isana.ia.br` → fluxo completo.
10. (Opcional, mas bom) **Conectar o repo GitHub** na Vercel pra auto-deploy nos
    próximos pushes. Não obrigatório.

---

## Coordenação dos agentes (Claude + Codex)

**REGRA DE OURO** (em `AGENTS.md` e `CLAUDE.md`):
- Terminou algo / achou bug / decidiu algo → **registrar em `WORKLOG.md`**.
- Antes de qualquer task → **ler `WORKLOG.md`**.

Divisão sugerida:
- **Claude:** backend (`server.js`, `lib/`, `api/`), banco, deploy.
- **Codex:** frontend (`public/`), conteúdo, integrações de produto.

O frontend está praticamente intacto — bate nos mesmos endpoints `/api/*`. Não deve
precisar de mudança pra ficar pronto.

---

## Mapa de commits

```
94092c3 Migra backend para Supabase + login por cookie JWT  ← último commit
8c8b60d Confirma subdomínio do chá: cha.isana.ia.br
ebc06b2 Registra acessos verificados (Vercel/Cloudflare), domínio e pendências
0c75865 Cria projeto Supabase dedicado e schema inicial do chá
6524a29 Estrutura de coordenação dos agentes (Claude + Codex)
```

**⚠️ ATENÇÃO:** o trabalho do deploy (api/index.js, vercel.json, .vercelignore,
mudanças em server.js, package.json, .gitignore) e as últimas entradas do WORKLOG
**ainda NÃO estão no commit** — vão entrar junto com este HANDOFF, no próximo commit.

---

## Como abrir no novo chat

Cole a linha:
> *"Leia HANDOFF.md primeiro, depois WORKLOG.md, AGENTS.md, CLAUDE.md e MEMORY.md.
> Continue a partir da seção 'PRÓXIMOS PASSOS' do HANDOFF — o site já está deployed
> em cha-panelas.vercel.app, falta DNS no Cloudflare."*

Boa! 💝
