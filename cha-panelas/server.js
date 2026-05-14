'use strict';

// ============================================================
// CONFIG — EDIT THESE VALUES BEFORE GOING LIVE
// ============================================================
const CONFIG = {
  nomes: 'Ana Clara & Isaque',
  dataEvento: '20 de junho de 2026',
  horaEvento: '13h00',
  endereco: 'Rua Engenheiro Francelino Mota, 417',

  // ── PIX ──────────────────────────────────────────────────────
  pixKey: 'COLOQUE_SUA_CHAVE_PIX_AQUI',   // CPF, e-mail, telefone ou chave aleatória
  pixNome: 'Ana Clara',                    // Nome que aparece no QR Code (máx 25 caracteres)
  pixCidade: 'Sao Paulo',                  // Sem acentos (padrão EMV)

  // ── TRANSFERÊNCIA BANCÁRIA ────────────────────────────────────
  bank: {
    banco: 'COLOQUE_SEU_BANCO',            // Ex: Nubank, Itaú, Bradesco
    agencia: '0000',
    conta: '00000-0',
    tipo: 'Conta Corrente',
    titular: 'Ana Clara',
    cpf: '',                               // Opcional — deixe vazio se preferir não exibir
  },

  // ── PAGAR.ME ──────────────────────────────────────────────────
  // Crie sua conta em pagar.me → Dashboard → Configurações → API Keys
  pagarme: {
    secretKey: '',    // sk_test_xxxxx (sandbox) ou sk_live_xxxxx (produção)
    publicKey: '',    // pk_test_xxxxx — usado no frontend (futuro)
    webhookSecret: '', // Dashboard Pagar.me → Webhooks → Criar webhook → copie o secret
  },

  adminPassword: 'admin2026',              // MUDE ISSO antes de publicar
  port: process.env.PORT || 3000,
};
// ============================================================

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { createStaticPix, hasError: pixHasError } = require('pix-utils');

const app = express();
const DB_PATH = path.join(__dirname, 'data.db');

// ──────────────────────────────────────────────────────────────
// ITEMS DATA
// ──────────────────────────────────────────────────────────────
const ITEMS = [
  // ITENS QUE JÁ TENHO
  {id:1,  name:'Jogo de chá completo',                     desc:'Peças completas do jogo de chá',                          cat:'Itens que já tenho', price:200, emoji:'☕'},
  {id:2,  name:'Faqueiro de 48 peças',                     desc:'Conjunto completo de faqueiro 48 peças',                  cat:'Itens que já tenho', price:200, emoji:'🍴'},
  {id:3,  name:'Kit de banheiro',                          desc:'Conjunto completo de acessórios de banheiro',             cat:'Itens que já tenho', price:180, emoji:'🚿'},
  {id:4,  name:'4 bowls da M&M',                           desc:'4 unidades de bowl M&M',                                  cat:'Itens que já tenho', price:150, emoji:'🥣'},
  {id:5,  name:'Jogo de toalhas com oitinho #1',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:200, emoji:'🌸'},
  {id:6,  name:'Jogo de toalhas com oitinho #2',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:200, emoji:'🌸'},
  {id:7,  name:'Jogo de toalhas com oitinho #3',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:200, emoji:'🌸'},
  {id:8,  name:'Jogo de toalhas com oitinho #4',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:200, emoji:'🌸'},
  {id:9,  name:'Jogo de toalhas com oitinho #5',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:200, emoji:'🌸'},
  {id:10, name:'Jogo de toalhas com oitinho #6',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:200, emoji:'🌸'},
  {id:11, name:'Jogo de toalhas com oitinho #7',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:180, emoji:'🌸'},
  {id:12, name:'Jogo de toalhas com oitinho #8',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:180, emoji:'🌸'},
  {id:13, name:'Jogo de toalhas com oitinho #9',           desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:180, emoji:'🌸'},
  {id:14, name:'Jogo de toalhas com oitinho #10',          desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:180, emoji:'🌸'},
  {id:15, name:'Jogo de toalhas com oitinho #11',          desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:170, emoji:'🌸'},
  {id:16, name:'Jogo de toalhas com oitinho #12',          desc:'Jogo completo com trabalho de oitinho artesanal',         cat:'Itens que já tenho', price:170, emoji:'🌸'},
  {id:17, name:'Jogo de toalhas bordadas #1',              desc:'Jogo de toalhas com bordado artesanal',                   cat:'Itens que já tenho', price:200, emoji:'🌺'},
  {id:18, name:'Jogo de toalhas bordadas #2',              desc:'Jogo de toalhas com bordado artesanal',                   cat:'Itens que já tenho', price:200, emoji:'🌺'},
  {id:19, name:'Sousplat com apoio de copo em crochê #1',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:200, emoji:'🌿'},
  {id:20, name:'Sousplat com apoio de copo em crochê #2',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:200, emoji:'🌿'},
  {id:21, name:'Sousplat com apoio de copo em crochê #3',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:180, emoji:'🌿'},
  {id:22, name:'Sousplat com apoio de copo em crochê #4',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:180, emoji:'🌿'},
  {id:23, name:'Sousplat com apoio de copo em crochê #5',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:180, emoji:'🌿'},
  {id:24, name:'Sousplat com apoio de copo em crochê #6',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:180, emoji:'🌿'},
  {id:25, name:'Sousplat com apoio de copo em crochê #7',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:170, emoji:'🌿'},
  {id:26, name:'Sousplat com apoio de copo em crochê #8',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:170, emoji:'🌿'},
  {id:27, name:'Sousplat com apoio de copo em crochê #9',  desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:170, emoji:'🌿'},
  {id:28, name:'Sousplat com apoio de copo em crochê #10', desc:'Conjunto sousplat + apoio de copo em crochê artesanal',  cat:'Itens que já tenho', price:160, emoji:'🌿'},
  {id:29, name:'Kit 6 copos cinzas',                       desc:'6 copos na cor cinza',                                   cat:'Itens que já tenho', price:160, emoji:'🥂'},
  {id:30, name:'Kit 6 copos transparentes',                desc:'6 copos transparentes',                                  cat:'Itens que já tenho', price:160, emoji:'🥂'},
  // KITS TEMÁTICOS
  {id:31, name:'Kit barman',                               desc:'Abridor de vinho elétrico + kit drinks + cortador de pizza', cat:'Kits Temáticos', price:130, emoji:'🍸'},
  {id:32, name:'Kit temperos e organização',               desc:'Moedor + ralador + óleo + 12 potes de tempero + funis', cat:'Kits Temáticos', price:100, emoji:'🧂'},
  {id:33, name:'Kit acessórios de cozinha',                desc:'6 pegadores + abridor de latas + plaina',               cat:'Kits Temáticos', price:50,  emoji:'🍳'},
  {id:34, name:'Kit frigideira + escorredor',              desc:'Frigideira 28cm + escorredor 4 peças',                  cat:'Kits Temáticos', price:80,  emoji:'🥘'},
  {id:35, name:'Copos do cotidiano',                       desc:'6 Copos Serena + 6 taças chopp 385ml',                  cat:'Kits Temáticos', price:80,  emoji:'🥛'},
  {id:36, name:'Kit café e chá',                           desc:'Caixa de chá + jarra medidora',                         cat:'Kits Temáticos', price:80,  emoji:'☕'},
  // CONJUNTOS DIVIDIDOS
  {id:37, name:'Formas forneaveis — conjunto 1',           desc:'3 formas forneaveis',                                   cat:'Conjuntos Divididos', price:80, emoji:'🫕'},
  {id:38, name:'Formas forneaveis — conjunto 2',           desc:'3 formas forneaveis',                                   cat:'Conjuntos Divididos', price:80, emoji:'🫕'},
  {id:39, name:'Formas forneaveis — conjunto 3',           desc:'3 formas forneaveis',                                   cat:'Conjuntos Divididos', price:80, emoji:'🫕'},
  {id:40, name:'Formas forneaveis — conjunto 4',           desc:'3 formas forneaveis',                                   cat:'Conjuntos Divididos', price:80, emoji:'🫕'},
  {id:41, name:'Formas forneaveis — conjunto 5',           desc:'3 formas forneaveis',                                   cat:'Conjuntos Divididos', price:80, emoji:'🫕'},
  {id:42, name:'Formas forneaveis — conjunto 6',           desc:'3 formas forneaveis',                                   cat:'Conjuntos Divididos', price:80, emoji:'🫕'},
  {id:43, name:'Potes herméticos mantimentos — conjunto A',desc:'5 potes herméticos para mantimentos',                   cat:'Conjuntos Divididos', price:80, emoji:'🫙'},
  {id:44, name:'Potes herméticos mantimentos — conjunto B',desc:'5 potes herméticos para mantimentos',                   cat:'Conjuntos Divididos', price:80, emoji:'🫙'},
  {id:45, name:'Potes herméticos 1040ml — conjunto A',     desc:'3 potes herméticos 1040ml',                             cat:'Conjuntos Divididos', price:50, emoji:'🫙'},
  {id:46, name:'Potes herméticos 1040ml — conjunto B',     desc:'3 potes herméticos 1040ml',                             cat:'Conjuntos Divididos', price:50, emoji:'🫙'},
  {id:47, name:'Potes herméticos 370ml — conjunto A',      desc:'5 potes herméticos 370ml',                              cat:'Conjuntos Divididos', price:50, emoji:'🫙'},
  {id:48, name:'Potes herméticos 370ml — conjunto B',      desc:'5 potes herméticos 370ml',                              cat:'Conjuntos Divididos', price:50, emoji:'🫙'},
  {id:49, name:'Potes herméticos 640ml — conjunto A',      desc:'5 potes herméticos 640ml',                              cat:'Conjuntos Divididos', price:50, emoji:'🫙'},
  {id:50, name:'Potes herméticos 640ml — conjunto B',      desc:'5 potes herméticos 640ml',                              cat:'Conjuntos Divididos', price:50, emoji:'🫙'},
  // ITENS INDIVIDUAIS
  {id:51, name:'Kit de churrasco',                         desc:'Utensílios completos para churrasco',                   cat:'Itens Individuais', price:50,  emoji:'🥩'},
  {id:52, name:'6 taças de vinho branco 520ml',            desc:'6 taças para vinho branco 520ml',                       cat:'Itens Individuais', price:80,  emoji:'🍾'},
  {id:53, name:'6 taças de vinho tinto 460ml',             desc:'6 taças para vinho tinto 460ml',                        cat:'Itens Individuais', price:50,  emoji:'🍷'},
  {id:54, name:'6 taças de gin 600ml',                     desc:'6 taças para gin 600ml',                                cat:'Itens Individuais', price:50,  emoji:'🍹'},
  {id:55, name:'6 taças de champanhe 210ml',               desc:'6 taças para champanhe 210ml',                          cat:'Itens Individuais', price:110, emoji:'🥂'},
  {id:56, name:'6 assadeiras de vidro',                    desc:'6 assadeiras de vidro refratário',                      cat:'Itens Individuais', price:130, emoji:'🥘'},
  {id:57, name:'3 bowls de inox',                          desc:'3 bowls de aço inox',                                   cat:'Itens Individuais', price:50,  emoji:'🥣'},
  {id:58, name:'Bandeja para frios com tampa',             desc:'Bandeja para servir frios com tampa',                   cat:'Itens Individuais', price:50,  emoji:'🧀'},
  {id:59, name:'4 facas de cerâmica + descascador',        desc:'4 facas de cerâmica + descascador',                     cat:'Itens Individuais', price:100, emoji:'🔪'},
  {id:60, name:'Kit utensílios cozinha',                   desc:'Kit completo de utensílios + tesoura + faca',           cat:'Itens Individuais', price:80,  emoji:'🥄'},
  {id:61, name:'3 kits lavanderia',                        desc:'3 kits completos de lavanderia',                        cat:'Itens Individuais', price:50,  emoji:'🧺'},
  {id:62, name:'Liquidificador',                           desc:'Liquidificador',                                        cat:'Itens Individuais', price:180, emoji:'🥤'},
  {id:63, name:'Batedeira',                                desc:'Batedeira',                                             cat:'Itens Individuais', price:100, emoji:'🎂'},
  {id:64, name:'Mixer',                                    desc:'Mixer',                                                 cat:'Itens Individuais', price:180, emoji:'🥄'},
  {id:65, name:'Cobre leito (rosa)',                       desc:'Cobre leito na cor rosa',                               cat:'Itens Individuais', price:110, emoji:'🛏️'},
  // ITENS ESPECIAIS
  {id:66, name:'6 taças bubble 300ml',                     desc:'6 taças bubble 300ml',                                  cat:'Itens Especiais', price:130, emoji:'🫧'},
  {id:67, name:'Aparelho de jantar opção 1 — pratos e bowl',desc:'24 peças: pratos e bowls',                             cat:'Itens Especiais', price:130, emoji:'🍽️'},
  {id:68, name:'Aparelho de jantar opção 1 — pires e xícaras',desc:'24 peças: pires e xícaras',                         cat:'Itens Especiais', price:130, emoji:'🍽️'},
  {id:69, name:'Aparelho de jantar opção 2 — conjunto mesa',desc:'24 peças: conjunto mesa',                              cat:'Itens Especiais', price:130, emoji:'🍽️'},
  {id:70, name:'Aparelho de jantar opção 2 — conjunto chá', desc:'24 peças: conjunto chá',                              cat:'Itens Especiais', price:130, emoji:'🍽️'},
  {id:71, name:'Jogo de panelas Tramontina Brava',          desc:'4 panelas Tramontina Brava',                           cat:'Itens Especiais', price:130, emoji:'🥘'},
  {id:72, name:'Panela elétrica',                           desc:'Panela elétrica',                                     cat:'Itens Especiais', price:130, emoji:'⚡'},
  {id:73, name:'Multiprocessador',                          desc:'Multiprocessador',                                     cat:'Itens Especiais', price:130, emoji:'⚙️'},
  {id:74, name:'Air Fryer',                                 desc:'Air Fryer',                                           cat:'Itens Especiais', price:130, emoji:'🌬️'},
  {id:75, name:'Jogo de lençol queen branco #1',            desc:'Jogo de lençol queen na cor branca',                  cat:'Itens Especiais', price:100, emoji:'🛏️'},
  {id:76, name:'Jogo de lençol queen branco #2',            desc:'Jogo de lençol queen na cor branca',                  cat:'Itens Especiais', price:100, emoji:'🛏️'},
  {id:77, name:'Jogo de lençol queen bege #1',              desc:'Jogo de lençol queen na cor bege',                    cat:'Itens Especiais', price:100, emoji:'🛏️'},
  {id:78, name:'Jogo de lençol queen bege #2',              desc:'Jogo de lençol queen na cor bege',                    cat:'Itens Especiais', price:100, emoji:'🛏️'},
  {id:79, name:'Kit cama posta (azul)',                     desc:'Kit completo cama posta na cor azul',                  cat:'Itens Especiais', price:150, emoji:'🛌'},
  {id:80, name:'Kit cama posta (verde)',                    desc:'Kit completo cama posta na cor verde',                 cat:'Itens Especiais', price:150, emoji:'🛌'},
];

// ──────────────────────────────────────────────────────────────
// DATABASE SETUP
// ──────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reserved_items (
    item_id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    reserved_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrações seguras (ignora se coluna já existe)
try { db.exec("ALTER TABLE orders ADD COLUMN pagarme_order_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'manual'"); } catch (_) {}

// ──────────────────────────────────────────────────────────────
// PAGAR.ME HELPER
// ──────────────────────────────────────────────────────────────
async function pagarmeRequest(method, endpoint, body) {
  const key = CONFIG.pagarme.secretKey;
  if (!key) throw new Error('Pagar.me não configurado');
  const auth = Buffer.from(key + ':').toString('base64');
  const resp = await fetch(`https://api.pagar.me/core/v5${endpoint}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || `Pagar.me ${resp.status}`);
  return data;
}

// ──────────────────────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
  secret: 'cha-panelas-secret-k3y-2026-xYz!',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}));

app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function ok(res, data) {
  return res.json({ success: true, data });
}

function fail(res, status, error) {
  return res.status(status).json({ success: false, error });
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return fail(res, 401, 'Não autenticado');
  next();
}

function requireAdmin(req, res, next) {
  if (req.query.pw !== CONFIG.adminPassword) return fail(res, 403, 'Senha incorreta');
  next();
}

function getReservedSet() {
  const rows = db.prepare('SELECT item_id FROM reserved_items').all();
  return new Set(rows.map(r => r.item_id));
}

function enrichItem(item, reservedSet) {
  return { ...item, reserved: reservedSet.has(item.id) };
}

// ──────────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────────

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── AUTH ──────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return fail(res, 400, 'Preencha todos os campos');
  if (password.length < 6) return fail(res, 400, 'Senha deve ter ao menos 6 caracteres');

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return fail(res, 409, 'E-mail já cadastrado');

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hash);

  req.session.userId = result.lastInsertRowid;
  req.session.userName = name;
  req.session.userEmail = email;

  return ok(res, { id: result.lastInsertRowid, name, email });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return fail(res, 400, 'Preencha todos os campos');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return fail(res, 401, 'E-mail ou senha incorretos');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return fail(res, 401, 'E-mail ou senha incorretos');

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userEmail = user.email;

  return ok(res, { id: user.id, name: user.name, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return ok(res, null);
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return fail(res, 401, 'Não autenticado');
  return ok(res, {
    id: req.session.userId,
    name: req.session.userName,
    email: req.session.userEmail,
  });
});

// ── PUBLIC ────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  return ok(res, {
    nomes: CONFIG.nomes,
    dataEvento: CONFIG.dataEvento,
    horaEvento: CONFIG.horaEvento,
    endereco: CONFIG.endereco,
    pixKey: CONFIG.pixKey,
    bank: CONFIG.bank,
    cardEnabled: !!CONFIG.pagarme.secretKey,
  });
});

app.get('/api/items/stats', (req, res) => {
  const reservedSet = getReservedSet();
  const reserved = reservedSet.size;
  return ok(res, {
    total: ITEMS.length,
    available: ITEMS.length - reserved,
    reserved,
  });
});

app.get('/api/items', (req, res) => {
  const reservedSet = getReservedSet();
  return ok(res, ITEMS.map(i => enrichItem(i, reservedSet)));
});

app.get('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = ITEMS.find(i => i.id === id);
  if (!item) return fail(res, 404, 'Item não encontrado');
  const reservedSet = getReservedSet();
  return ok(res, enrichItem(item, reservedSet));
});

// ── CART ──────────────────────────────────────────────────────

app.get('/api/cart', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT item_id FROM cart_items WHERE user_id = ?').all(req.session.userId);
  const reservedSet = getReservedSet();
  const cartItems = rows.map(r => {
    const item = ITEMS.find(i => i.id === r.item_id);
    if (!item) return null;
    return enrichItem(item, reservedSet);
  }).filter(Boolean);
  return ok(res, cartItems);
});

app.post('/api/cart', requireAuth, (req, res) => {
  const itemId = parseInt(req.body.itemId, 10);
  if (!itemId) return fail(res, 400, 'itemId inválido');

  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return fail(res, 404, 'Item não encontrado');

  const reserved = db.prepare('SELECT item_id FROM reserved_items WHERE item_id = ?').get(itemId);
  if (reserved) return fail(res, 409, 'Este presente já foi reservado por outra pessoa');

  try {
    db.prepare('INSERT INTO cart_items (user_id, item_id) VALUES (?, ?)').run(req.session.userId, itemId);
    return ok(res, { itemId });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return fail(res, 409, 'Item já está no carrinho');
    }
    throw e;
  }
});

app.delete('/api/cart/:itemId', requireAuth, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND item_id = ?').run(req.session.userId, itemId);
  return ok(res, null);
});

// ── ORDERS ────────────────────────────────────────────────────

app.post('/api/orders', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const cartRows = db.prepare('SELECT item_id FROM cart_items WHERE user_id = ?').all(userId);

  if (cartRows.length === 0) return fail(res, 400, 'Carrinho vazio');

  const placeOrder = db.transaction(() => {
    // Check for conflicts
    const conflicts = [];
    for (const row of cartRows) {
      const already = db.prepare('SELECT item_id FROM reserved_items WHERE item_id = ?').get(row.item_id);
      if (already) {
        const item = ITEMS.find(i => i.id === row.item_id);
        conflicts.push(item ? item.name : `Item #${row.item_id}`);
      }
    }
    if (conflicts.length > 0) {
      return { conflict: true, names: conflicts };
    }

    const itemsData = cartRows.map(r => ITEMS.find(i => i.id === r.item_id)).filter(Boolean);
    const total = itemsData.reduce((sum, i) => sum + i.price, 0);

    const order = db.prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)').run(userId, total);
    const orderId = order.lastInsertRowid;

    const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, item_id, price) VALUES (?, ?, ?)');
    const insertReserved = db.prepare('INSERT INTO reserved_items (item_id, order_id) VALUES (?, ?)');

    for (const item of itemsData) {
      insertOrderItem.run(orderId, item.id, item.price);
      insertReserved.run(item.id, orderId);
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

    return { conflict: false, orderId, total, items: itemsData };
  });

  const result = placeOrder();

  if (result.conflict) {
    return fail(res, 409, `Os seguintes itens já foram reservados: ${result.names.join(', ')}`);
  }

  return ok(res, {
    orderId: result.orderId,
    total: result.total,
    items: result.items,
    pixKey: CONFIG.pixKey,
  });
});

app.get('/api/orders/me', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  const getItems = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?');

  const enriched = orders.map(order => {
    const orderItems = getItems.all(order.id).map(oi => {
      const item = ITEMS.find(i => i.id === oi.item_id);
      return item ? { ...item, price: oi.price } : { id: oi.item_id, price: oi.price, name: 'Item removido' };
    });
    return { ...order, items: orderItems };
  });

  return ok(res, enriched);
});

// ── PIX QR CODE ───────────────────────────────────────────────

app.get('/api/pix-qr', requireAuth, async (req, res) => {
  const orderId = parseInt(req.query.orderId, 10);
  if (!orderId) return fail(res, 400, 'orderId obrigatório');

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.session.userId);
  if (!order) return fail(res, 404, 'Pedido não encontrado');

  // ── 1. Pagar.me (preferencial) ────────────────────────────
  if (CONFIG.pagarme.secretKey) {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
      const rows = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?').all(orderId);
      const pgItems = rows.map(r => {
        const it = ITEMS.find(x => x.id === r.item_id);
        return { amount: r.price * 100, description: (it ? it.name : `Item #${r.item_id}`).substring(0, 64), quantity: 1, code: String(r.item_id) };
      });

      const pgOrder = await pagarmeRequest('POST', '/orders', {
        items: pgItems,
        customer: { name: user.name, email: user.email, type: 'individual' },
        payments: [{ payment_method: 'pix', pix: { expires_in: 86400 } }],
        metadata: { our_order_id: String(orderId) },
      });

      db.prepare("UPDATE orders SET pagarme_order_id = ?, payment_method = 'pix' WHERE id = ?")
        .run(pgOrder.id, orderId);

      const tx = pgOrder.charges?.[0]?.last_transaction;
      if (!tx?.qr_code_url) throw new Error('QR Code não retornado pelo Pagar.me');

      const qrDataUrl = await QRCode.toDataURL(tx.qr_code_url, { width: 280, margin: 1, color: { dark: '#3D2B1F', light: '#FDFBF8' } });
      return ok(res, { qrCode: qrDataUrl, payload: tx.qr_code_url, total: order.total, source: 'pagarme' });
    } catch (e) {
      console.error('[Pagar.me PIX]', e.message);
      // continua para fallback
    }
  }

  // ── 2. Fallback: pix-utils (QR estático) ──────────────────
  if (!CONFIG.pixKey || CONFIG.pixKey === 'COLOQUE_SUA_CHAVE_PIX_AQUI') {
    return fail(res, 503, 'Chave PIX não configurada. Entre em contato com os noivos.');
  }
  try {
    const pix = createStaticPix({
      merchantName: CONFIG.pixNome,
      merchantCity: CONFIG.pixCidade,
      pixKey: CONFIG.pixKey,
      infoAdicional: `Cha de Panelas - Pedido ${orderId}`,
      txid: `ISANA${String(orderId).padStart(9, '0')}`,
      valor: order.total,
    });
    if (pixHasError(pix)) throw new Error('Payload PIX inválido');
    const payload = pix.toBRCode();
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 1, color: { dark: '#3D2B1F', light: '#FDFBF8' } });
    return ok(res, { qrCode: qrDataUrl, payload, total: order.total, source: 'static' });
  } catch (e) {
    return fail(res, 500, 'Erro ao gerar QR Code: ' + e.message);
  }
});

// ── CARTÃO VIA PAGAR.ME ───────────────────────────────────────

app.post('/api/card-link', requireAuth, async (req, res) => {
  const orderId = parseInt(req.body.orderId, 10);
  if (!orderId) return fail(res, 400, 'orderId obrigatório');

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.session.userId);
  if (!order) return fail(res, 404, 'Pedido não encontrado');

  if (!CONFIG.pagarme.secretKey) {
    return fail(res, 503, 'Pagamento por cartão ainda não configurado. Use PIX ou Transferência.');
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const rows = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?').all(orderId);
    const pgItems = rows.map(r => {
      const it = ITEMS.find(x => x.id === r.item_id);
      return { amount: r.price * 100, description: (it ? it.name : `Item #${r.item_id}`).substring(0, 64), quantity: 1, code: String(r.item_id) };
    });

    const pgOrder = await pagarmeRequest('POST', '/orders', {
      items: pgItems,
      customer: { name: user.name, email: user.email, type: 'individual' },
      payments: [{
        payment_method: 'checkout',
        checkout: {
          accepted_payment_methods: ['credit_card'],
          credit_card: {
            statement_descriptor: 'CHA PANELAS',
            installments: [{ number: 1, total: order.total * 100 }],
          },
          skip_checkout_success_page: false,
          billing_address_editable: false,
          customer_editable: false,
        },
      }],
      metadata: { our_order_id: String(orderId) },
    });

    db.prepare("UPDATE orders SET pagarme_order_id = ?, payment_method = 'credit_card' WHERE id = ?")
      .run(pgOrder.id, orderId);

    const checkoutUrl = pgOrder.checkouts?.[0]?.payment_url;
    if (!checkoutUrl) throw new Error('URL de checkout não retornada pelo Pagar.me');

    return ok(res, { url: checkoutUrl, pagarmeOrderId: pgOrder.id });
  } catch (e) {
    return fail(res, 500, 'Erro ao criar checkout de cartão: ' + e.message);
  }
});

// ── WEBHOOK PAGAR.ME ─────────────────────────────────────────

app.post('/api/webhook/pagarme', express.raw({ type: '*/*' }), (req, res) => {
  if (CONFIG.pagarme.webhookSecret) {
    const crypto = require('crypto');
    const sig = req.headers['x-pagarme-signature'];
    const expected = crypto.createHmac('sha256', CONFIG.pagarme.webhookSecret)
      .update(req.body).digest('hex');
    if (sig !== expected) return res.status(401).send('Invalid signature');
  }
  try {
    const event = JSON.parse(req.body.toString());
    if (event.type === 'order.paid') {
      const pgId = event.data?.id;
      if (pgId) db.prepare("UPDATE orders SET status = 'paid' WHERE pagarme_order_id = ?").run(pgId);
    }
  } catch (e) { console.error('[Webhook]', e.message); }
  res.sendStatus(200);
});

// ── ADMIN ─────────────────────────────────────────────────────

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `).all();

  const getItems = db.prepare('SELECT item_id, price FROM order_items WHERE order_id = ?');

  const enriched = orders.map(order => {
    const orderItems = getItems.all(order.id).map(oi => {
      const item = ITEMS.find(i => i.id === oi.item_id);
      return item ? { ...item, price: oi.price } : { id: oi.item_id, price: oi.price, name: 'Item removido' };
    });
    return { ...order, items: orderItems };
  });

  const totalPaid = enriched.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
  const totalPending = enriched.filter(o => o.status === 'pending').reduce((s, o) => s + o.total, 0);
  const guests = new Set(enriched.map(o => o.user_id)).size;

  return ok(res, {
    orders: enriched,
    summary: { totalPaid, totalPending, guests },
  });
});

app.post('/api/admin/orders/:id/paid', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(id);
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', id);
  return ok(res, { orderId: id, status: 'paid' });
});

// ──────────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────────
app.listen(CONFIG.port, () => {
  console.log(`Chá de Panelas server running at http://localhost:${CONFIG.port}`);
});
