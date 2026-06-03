'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  nomes: 'Ana Clara & Isaque',
  dataEvento: '20 de junho de 2026',
  horaEvento: '13h00',
  endereco: 'Rua Engenheiro Francelino Mota, 417',

  // ── ABACATEPAY (PIX dinâmico com QR code nativo) ─────────────
  abacate: {
    apiKey: process.env.ABACATEPAY_API_KEY || '',
    webhookSecret: process.env.ABACATEPAY_WEBHOOK_SECRET || '',
    apiUrl: 'https://api.abacatepay.com/v2/transparents/create',
    expiresIn: 1800, // 30 minutos
  },
  get pixEnabled() { return !!this.abacate.apiKey; },

  // ── PIX ESTÁTICO (fallback se AbacatePay não configurado) ─────
  pixKey: '42c0a4b3-7a3d-42c4-980e-9ff9aa658e6c',
  pixNome: 'Ana Clara',
  pixCidade: 'Sao Paulo',

  // ── TRANSFERÊNCIA (mantida só pra exibição, se um dia voltar) ──
  bank: {
    banco: 'Safra (422)', agencia: '0288', conta: '24153-1',
    tipo: 'Conta Corrente', titular: 'Ana Clara', cpf: '',
  },

  // ── INFINITEPAY ───────────────────────────────────────────────
  // Setar INFINITEPAY_HANDLE com o InfiniteTag da conta (sem o $).
  // Quando presente, habilita o botão de cartão/Pix InfinitePay na confirmação.
  infinitepay: {
    handle: process.env.INFINITEPAY_HANDLE || '',
    apiUrl: 'https://api.checkout.infinitepay.io/links',
    // URL pública do site — usada no redirect e no webhook
    siteUrl: process.env.SITE_URL || 'https://cha.isana.ia.br',
  },
  get cardEnabled() { return !!this.infinitepay.handle; },

  // ── E-MAIL (código de login) ──────────────────────────────────
  email: {
    user: process.env.EMAIL_USER || '',
    appPassword: process.env.EMAIL_APP_PASSWORD || '',
    // Remetente do e-mail. No Brevo o login SMTP (EMAIL_USER) != endereço remetente,
    // então usamos EMAIL_FROM. Se vazio, cai no EMAIL_USER (ex.: Gmail).
    from: process.env.EMAIL_FROM || '',
  },

  // ── PAGAMENTO POR CARTÃO (mantido para retrocompatibilidade) ──
  // cardEnabled agora é um getter acima — não declarar aqui de novo

  adminPassword: process.env.ADMIN_PASSWORD || 'Isana2026@',
  port: process.env.PORT || 3000,
};
// ============================================================

const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { createStaticPix, hasError: pixHasError } = require('pix-utils');
const nodemailer = require('nodemailer');

const { supabase } = require('./lib/supabase');
const { issueSession, getSession, clearSession } = require('./lib/auth');
const ITEMS = require('./lib/items');

const app = express();

// ──────────────────────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function ok(res, data) { return res.json({ success: true, data }); }
function fail(res, status, error) { return res.status(status).json({ success: false, error }); }

async function requireAuth(req, res, next) {
  const s = await getSession(req);
  if (!s) return fail(res, 401, 'Não autenticado');
  req.user = s;
  next();
}
function requireAdmin(req, res, next) {
  if (req.query.pw !== CONFIG.adminPassword) return fail(res, 403, 'Senha incorreta');
  next();
}

// Map item_id -> 'reserved' | 'paid'
async function getReservedMap() {
  const { data } = await supabase.from('reserved_items').select('item_id, orders(status)');
  const map = new Map();
  if (data) for (const r of data) {
    map.set(r.item_id, (r.orders && r.orders.status === 'paid') ? 'paid' : 'reserved');
  }
  return map;
}
function enrichItem(item, map) {
  const state = map.get(item.id);
  return { ...item, reserved: !!state, paid: state === 'paid' };
}

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function isValidEmail(e) { return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }
function emailConfigured() { return !!(CONFIG.email.user && CONFIG.email.appPassword); }

let _mailTransport = null;
function getMailTransport() {
  if (_mailTransport) return _mailTransport;
  if (!emailConfigured()) return null;
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const secure = (process.env.EMAIL_SECURE || 'true').toLowerCase() !== 'false';
  _mailTransport = nodemailer.createTransport({
    host, port, secure,
    auth: { user: CONFIG.email.user, pass: CONFIG.email.appPassword },
  });
  return _mailTransport;
}
async function sendLoginCodeEmail(to, code) {
  const subject = `Seu código de acesso: ${code}`;
  const fromAddr = CONFIG.email.from || CONFIG.email.user;
  const fromName = `Chá de Panelas — ${CONFIG.nomes}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;background:#FDFBF8;padding:36px 28px;border-radius:14px;border:1px solid #ecdfce;">
      <h1 style="color:#3D2B1F;font-size:22px;text-align:center;margin:0 0 2px;">Chá de Panelas</h1>
      <p style="color:#9a8c7a;text-align:center;margin:0 0 24px;font-size:14px;">${CONFIG.nomes}</p>
      <p style="color:#3D2B1F;font-size:15px;line-height:1.6;">Oi! Use o código abaixo para entrar na nossa lista de presentes:</p>
      <div style="text-align:center;margin:26px 0;">
        <span style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#B8860B;background:#fff;padding:16px 20px 16px 28px;border-radius:12px;border:2px dashed #D4AF37;display:inline-block;">${code}</span>
      </div>
      <p style="color:#9a8c7a;font-size:13px;text-align:center;line-height:1.6;">O código vale por 10 minutos.<br>Se não foi você que pediu, é só ignorar este e-mail. 💝</p>
    </div>`;

  // 1) Brevo — API HTTP (recomendado em serverless/Vercel; sem conexão SMTP persistente)
  if (process.env.BREVO_API_KEY) {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromAddr },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!resp.ok) throw new Error(`Brevo API ${resp.status}: ${await resp.text()}`);
    return true;
  }

  // 2) SMTP (nodemailer) — fallback p/ outros provedores (ex.: Gmail)
  const transport = getMailTransport();
  if (!transport) {
    console.log(`\n  [CÓDIGO DE LOGIN - modo teste] ${to} -> ${code}\n`);
    return false;
  }
  await transport.sendMail({ from: `"${fromName}" <${fromAddr}>`, to, subject, html });
  return true;
}

// ──────────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── AUTH (login por código de 6 dígitos) ──────────────────────
async function issueCode(res, { email, name, phone }) {
  const since = new Date(Date.now() - 45000).toISOString();
  const { count } = await supabase.from('login_codes')
    .select('id', { count: 'exact', head: true })
    .eq('email', email).gt('created_at', since);
  if (count && count > 0) return fail(res, 429, 'Aguarde alguns segundos antes de pedir um novo código.');

  const code = genCode();
  const expires = new Date(Date.now() + 10 * 60000).toISOString();
  await supabase.from('login_codes').insert({ email, code, name: name || null, phone: phone || null, expires_at: expires });
  // limpeza best-effort de códigos antigos
  await supabase.from('login_codes').delete().lt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());

  let sent = false;
  try { sent = await sendLoginCodeEmail(email, code); }
  catch (e) { console.error('[E-mail]', e.message); return fail(res, 502, 'Não conseguimos enviar o e-mail. Confira o endereço e tente de novo.'); }

  const payload = { sent, email };
  // Modo de teste pré-lançamento (e-mail ainda não configurado): devolve o código
  // na própria resposta pra mostrar na tela. Local: NODE_ENV != production.
  // Na Vercel/produção: defina SHOW_DEV_CODE=true.
  // ⚠️ REMOVER o SHOW_DEV_CODE assim que o envio por e-mail estiver ativo.
  const showDevCode = process.env.SHOW_DEV_CODE === 'true' || process.env.NODE_ENV !== 'production';
  if (!sent && showDevCode) payload.devCode = code;
  return ok(res, payload);
}

app.post('/api/auth/register-request', async (req, res) => {
  let { name, email, phone } = req.body;
  name = (name || '').trim(); email = (email || '').trim().toLowerCase(); phone = (phone || '').trim();
  if (!name || !email || !phone) return fail(res, 400, 'Preencha nome, e-mail e telefone.');
  if (name.length < 3) return fail(res, 400, 'Digite seu nome completo.');
  if (!isValidEmail(email)) return fail(res, 400, 'E-mail inválido.');
  if (phone.replace(/\D/g, '').length < 10) return fail(res, 400, 'Telefone inválido. Inclua o DDD.');
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return fail(res, 409, 'Esse e-mail já tem cadastro. É só fazer login!');
  return issueCode(res, { email, name, phone });
});

app.post('/api/auth/login-request', async (req, res) => {
  let { email } = req.body; email = (email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return fail(res, 400, 'E-mail inválido.');
  const { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (!user) return fail(res, 404, 'Não encontramos esse e-mail. Faça seu cadastro primeiro.');
  return issueCode(res, { email });
});

app.post('/api/auth/verify', async (req, res) => {
  let { email, code } = req.body; email = (email || '').trim().toLowerCase(); code = (code || '').trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return fail(res, 400, 'Código inválido.');
  const { data: rows } = await supabase.from('login_codes')
    .select('*').eq('email', email).eq('code', code).eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('id', { ascending: false }).limit(1);
  const row = rows && rows[0];
  if (!row) return fail(res, 400, 'Código incorreto ou expirado. Peça um novo.');

  await supabase.from('login_codes').update({ used: true }).eq('id', row.id);

  let { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (!user) {
    if (!row.name) return fail(res, 400, 'Cadastro incompleto. Refaça o cadastro.');
    const { data: created, error } = await supabase.from('users')
      .insert({ name: row.name, email, phone: row.phone || null }).select().single();
    if (error) return fail(res, 500, 'Erro ao criar conta.');
    user = created;
  }
  await issueSession(res, user);
  return ok(res, { id: user.id, name: user.name, email: user.email });
});

app.post('/api/auth/logout', (req, res) => { clearSession(res); return ok(res, null); });

app.get('/api/auth/me', async (req, res) => {
  const s = await getSession(req);
  if (!s) return fail(res, 401, 'Não autenticado');
  return ok(res, { id: s.id, name: s.name, email: s.email });
});

app.put('/api/auth/me', requireAuth, async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) return fail(res, 400, 'Nome e e-mail são obrigatórios');
  const emailLower = email.trim().toLowerCase();

  // Verifica se e-mail já está em uso por outro usuário
  const { data: existing } = await supabase.from('users')
    .select('id').eq('email', emailLower).neq('id', req.user.id).maybeSingle();
  if (existing) return fail(res, 409, 'Este e-mail já está em uso por outra conta');

  const { error } = await supabase.from('users')
    .update({ name: name.trim(), email: emailLower })
    .eq('id', req.user.id);
  if (error) return fail(res, 500, 'Erro ao atualizar dados');

  // Atualiza o cookie JWT com os novos dados
  await issueSession(res, { id: req.user.id, name: name.trim(), email: emailLower });

  return ok(res, { name: name.trim(), email: emailLower });
});

// ── PUBLIC ────────────────────────────────────────────────────
app.get('/api/config', (req, res) => ok(res, {
  nomes: CONFIG.nomes, dataEvento: CONFIG.dataEvento, horaEvento: CONFIG.horaEvento,
  endereco: CONFIG.endereco, pixKey: CONFIG.pixKey, bank: CONFIG.bank,
  cardEnabled: CONFIG.cardEnabled, pixEnabled: CONFIG.pixEnabled,
}));

app.get('/api/items/stats', async (req, res) => {
  const map = await getReservedMap();
  return ok(res, { total: ITEMS.length, available: ITEMS.length - map.size, reserved: map.size });
});

app.get('/api/items', async (req, res) => {
  const map = await getReservedMap();
  return ok(res, ITEMS.map(i => enrichItem(i, map)));
});

app.get('/api/items/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = ITEMS.find(i => i.id === id);
  if (!item) return fail(res, 404, 'Item não encontrado');
  const map = await getReservedMap();
  return ok(res, enrichItem(item, map));
});

// ── CART ──────────────────────────────────────────────────────
app.get('/api/cart', requireAuth, async (req, res) => {
  const { data: rows } = await supabase.from('cart_items').select('item_id').eq('user_id', req.user.id);
  const map = await getReservedMap();
  const items = (rows || []).map(r => { const it = ITEMS.find(i => i.id === r.item_id); return it ? enrichItem(it, map) : null; }).filter(Boolean);
  return ok(res, items);
});

app.post('/api/cart', requireAuth, async (req, res) => {
  const itemId = parseInt(req.body.itemId, 10);
  if (!itemId) return fail(res, 400, 'itemId inválido');
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return fail(res, 404, 'Item não encontrado');
  const { data: reserved } = await supabase.from('reserved_items').select('item_id').eq('item_id', itemId).maybeSingle();
  if (reserved) return fail(res, 409, 'Este presente já foi reservado por outra pessoa');
  const { error } = await supabase.from('cart_items').insert({ user_id: req.user.id, item_id: itemId });
  if (error) {
    if (error.code === '23505') return fail(res, 409, 'Item já está no carrinho');
    return fail(res, 500, 'Erro ao adicionar ao carrinho');
  }
  return ok(res, { itemId });
});

app.delete('/api/cart/:itemId', requireAuth, async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  await supabase.from('cart_items').delete().eq('user_id', req.user.id).eq('item_id', itemId);
  return ok(res, null);
});

// ── ORDERS ────────────────────────────────────────────────────
app.post('/api/orders', requireAuth, async (req, res) => {
  const { data: cartRows } = await supabase.from('cart_items').select('item_id').eq('user_id', req.user.id);
  if (!cartRows || cartRows.length === 0) return fail(res, 400, 'Carrinho vazio');
  const itemsData = cartRows.map(r => ITEMS.find(i => i.id === r.item_id)).filter(Boolean);
  const pItems = itemsData.map(i => ({ item_id: i.id, price: i.price }));

  const { data: orderId, error } = await supabase.rpc('place_order', { p_user_id: req.user.id, p_items: pItems });
  if (error) {
    if ((error.message || '').includes('CONFLICT')) {
      const ids = ((error.message.split('CONFLICT:')[1] || '').match(/\d+/g) || []).map(Number);
      const names = ids.map(id => { const it = ITEMS.find(i => i.id === id); return it ? it.name : `Item #${id}`; });
      return fail(res, 409, names.length
        ? `Os seguintes itens já foram reservados: ${names.join(', ')}`
        : 'Alguns presentes já foram reservados. Atualize a página.');
    }
    console.error('[place_order]', error.message);
    return fail(res, 500, 'Erro ao finalizar pedido');
  }
  const total = itemsData.reduce((s, i) => s + i.price, 0);
  return ok(res, { orderId, total, items: itemsData, pixKey: CONFIG.pixKey });
});

app.get('/api/orders/me', requireAuth, async (req, res) => {
  const { data: orders } = await supabase.from('orders').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  const result = [];
  for (const o of (orders || [])) {
    const { data: ois } = await supabase.from('order_items').select('item_id, price').eq('order_id', o.id);
    const items = (ois || []).map(oi => { const it = ITEMS.find(i => i.id === oi.item_id); return it ? { ...it, price: Number(oi.price) } : { id: oi.item_id, price: Number(oi.price), name: 'Item removido' }; });
    result.push({ ...o, total: Number(o.total), items });
  }
  return ok(res, result);
});

// Cancelar pedido pendente (libera reserva via CASCADE)
app.delete('/api/orders/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { data: order } = await supabase.from('orders').select('id, status').eq('id', id).eq('user_id', req.user.id).maybeSingle();
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  if (order.status === 'paid') return fail(res, 400, 'Não é possível cancelar um pedido já pago');
  await supabase.from('orders').delete().eq('id', id);
  return ok(res, { cancelled: true });
});

app.post('/api/orders/:id/cash', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { data: order } = await supabase.from('orders').select('id').eq('id', id).eq('user_id', req.user.id).maybeSingle();
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  await supabase.from('orders').update({ payment_method: 'dinheiro' }).eq('id', id);
  return ok(res, { orderId: id, paymentMethod: 'dinheiro' });
});

// ── PIX QR (por pedido) ───────────────────────────────────────
app.get('/api/pix-qr', requireAuth, async (req, res) => {
  const orderId = parseInt(req.query.orderId, 10);
  if (!orderId) return fail(res, 400, 'orderId obrigatório');
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).eq('user_id', req.user.id).maybeSingle();
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  if (!CONFIG.pixKey) return fail(res, 503, 'Chave PIX não configurada. Entre em contato com os noivos.');
  try {
    const pix = createStaticPix({
      merchantName: CONFIG.pixNome, merchantCity: CONFIG.pixCidade, pixKey: CONFIG.pixKey,
      infoAdicional: `Cha de Panelas - Pedido ${orderId}`,
      txid: `ISANA${String(orderId).padStart(9, '0')}`, valor: Number(order.total),
    });
    if (pixHasError(pix)) throw new Error('Payload PIX inválido');
    const payload = pix.toBRCode();
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 1, color: { dark: '#3D2B1F', light: '#FDFBF8' } });
    return ok(res, { qrCode: qrDataUrl, payload, total: Number(order.total), source: 'static' });
  } catch (e) { return fail(res, 500, 'Erro ao gerar QR Code: ' + e.message); }
});

// ── ADMIN ─────────────────────────────────────────────────────
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const { data: orders } = await supabase.from('orders')
    .select('*, users(name, email, phone)').order('created_at', { ascending: false });
  const enriched = [];
  for (const o of (orders || [])) {
    const { data: ois } = await supabase.from('order_items').select('item_id, price').eq('order_id', o.id);
    const items = (ois || []).map(oi => { const it = ITEMS.find(i => i.id === oi.item_id); return it ? { ...it, price: Number(oi.price) } : { id: oi.item_id, price: Number(oi.price), name: 'Item removido' }; });
    enriched.push({
      ...o, total: Number(o.total),
      user_name: o.users && o.users.name, user_email: o.users && o.users.email, user_phone: o.users && o.users.phone,
      items,
    });
  }
  const totalPaid = enriched.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
  const totalPending = enriched.filter(o => o.status === 'pending').reduce((s, o) => s + o.total, 0);
  const guests = new Set(enriched.map(o => o.user_id)).size;
  return ok(res, { orders: enriched, summary: { totalPaid, totalPending, guests } });
});

app.post('/api/admin/orders/:id/paid', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { data: order } = await supabase.from('orders').select('id').eq('id', id).maybeSingle();
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  await supabase.from('orders').update({ status: 'paid' }).eq('id', id);
  return ok(res, { orderId: id, status: 'paid' });
});

app.post('/api/admin/orders/:id/cancel', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { data: order } = await supabase.from('orders').select('id').eq('id', id).maybeSingle();
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  // order_items e reserved_items têm ON DELETE CASCADE → liberam o presente
  await supabase.from('orders').delete().eq('id', id);
  return ok(res, { orderId: id, cancelled: true });
});

// ── ABACATEPAY — criar cobrança PIX dinâmica ─────────────────
async function createAbacatePixCharge({ amount, description, externalId, customer }) {
  const { apiKey, apiUrl, expiresIn } = CONFIG.abacate;
  const body = {
    method: 'PIX',
    data: {
      amount: Math.round(amount * 100), // centavos
      description,
      expiresIn,
      externalId: String(externalId),
      ...(customer ? { customer } : {}),
    },
  };
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (!resp.ok || !json.success) throw new Error(`AbacatePay ${resp.status}: ${JSON.stringify(json.error)}`);
  return json.data; // { id, brCode, brCodeBase64, amount, expiresAt, status }
}

// ── PIX DINÂMICO — gerar QR code (AbacatePay) ────────────────
// Cria payment_session + cobrança AbacatePay. Retorna QR code pra
// exibir direto no site sem redirecionar o convidado.
app.post('/api/pix-charge', requireAuth, async (req, res) => {
  if (!CONFIG.pixEnabled) return fail(res, 503, 'PIX dinâmico não configurado');

  // Limpar sessões expiradas do usuário
  await supabase.from('payment_sessions')
    .delete().eq('user_id', req.user.id).lt('expires_at', new Date().toISOString());

  const { data: cartRows } = await supabase.from('cart_items').select('item_id').eq('user_id', req.user.id);
  if (!cartRows || cartRows.length === 0) return fail(res, 400, 'Carrinho vazio');

  const itemsData = cartRows.map(r => ITEMS.find(i => i.id === r.item_id)).filter(Boolean);
  if (itemsData.length === 0) return fail(res, 400, 'Nenhum item válido no carrinho');

  const total = itemsData.reduce((s, i) => s + i.price, 0);
  const sessionItems = itemsData.map(i => ({ item_id: i.id, price: i.price }));

  // Criar sessão temporária
  const { data: session, error: sessErr } = await supabase.from('payment_sessions')
    .insert({ user_id: req.user.id, items: sessionItems, total })
    .select('id').single();
  if (sessErr || !session) return fail(res, 500, 'Erro ao criar sessão');

  const names = itemsData.map(i => i.name).join(', ');
  const description = names.length > 100 ? names.slice(0, 97) + '…' : names;

  try {
    const charge = await createAbacatePixCharge({
      amount: total,
      description: `Chá de Panelas — ${description}`,
      externalId: session.id,
      customer: { name: req.user.name, email: req.user.email },
    });

    // Guardar charge id na sessão para lookup no webhook
    await supabase.from('payment_sessions').update({ charge_id: charge.id }).eq('id', session.id);

    return ok(res, {
      sessionId: session.id,
      chargeId: charge.id,
      brCode: charge.brCode,
      brCodeBase64: charge.brCodeBase64,
      total,
      expiresAt: charge.expiresAt,
    });
  } catch (e) {
    await supabase.from('payment_sessions').delete().eq('id', session.id);
    console.error('[AbacatePay]', e.message);
    return fail(res, 502, 'Não foi possível gerar o QR Code PIX. Tente novamente.');
  }
});

// ── PIX STATUS — polling do frontend ─────────────────────────
app.get('/api/pix-status', requireAuth, async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return fail(res, 400, 'sessionId obrigatório');
  const { data: session } = await supabase.from('payment_sessions')
    .select('used, user_id').eq('id', sessionId).eq('user_id', req.user.id).maybeSingle();
  if (!session) return fail(res, 404, 'Sessão não encontrada');
  return ok(res, { paid: session.used === true });
});

// ── WEBHOOK ABACATEPAY — confirmar pagamento PIX ─────────────
// AbacatePay envia POST com evento transparent.completed
// Valida via secret na query string + HMAC-SHA256 no header
app.post('/api/webhooks/abacatepay', express.json(), async (req, res) => {
  // Validar secret na query string
  const { secret } = req.query;
  if (CONFIG.abacate.webhookSecret && secret !== CONFIG.abacate.webhookSecret) {
    return res.status(401).json({ error: 'Secret inválido' });
  }

  const { event, data } = req.body || {};
  if (event !== 'transparent.completed') return res.status(200).json({ ok: true, ignored: true });

  const externalId = data?.transparent?.externalId || data?.externalId;
  if (!externalId) return res.status(400).json({ error: 'externalId ausente' });

  const { data: session } = await supabase.from('payment_sessions')
    .select('*').eq('id', externalId).maybeSingle();

  if (!session) return res.status(400).json({ error: 'Sessão não encontrada' });
  if (session.used) return res.status(200).json({ ok: true, already: true });

  // Criar pedido e reservar itens
  const { data: orderId, error: orderErr } = await supabase.rpc('place_order', {
    p_user_id: session.user_id, p_items: session.items,
  });

  if (orderErr) {
    console.error('[AbacatePay webhook] place_order:', orderErr.message);
    if ((orderErr.message || '').includes('CONFLICT')) {
      await supabase.from('payment_sessions').update({ used: true }).eq('id', session.id);
      return res.status(200).json({ ok: false, reason: 'items_already_reserved' });
    }
    return res.status(400).json({ error: 'Erro ao criar pedido' });
  }

  // Marcar como pago
  const paidAmount = data?.transparent?.amount ? data.transparent.amount / 100 : session.total;
  await supabase.from('orders').update({
    status: 'paid',
    payment_method: 'pix_abacatepay',
    paid_amount: paidAmount,
  }).eq('id', orderId);

  // Limpar carrinho e sessão
  await supabase.from('cart_items').delete().eq('user_id', session.user_id);
  await supabase.from('payment_sessions').update({ used: true }).eq('id', session.id);

  console.log(`[AbacatePay] Pedido #${orderId} pago via PIX (R$ ${paidAmount})`);
  return res.status(200).json({ ok: true, orderId });
});

// ── INFINITEPAY — criar link de pagamento ────────────────────
async function createInfinitePayLink(order, items) {
  const { handle, apiUrl, siteUrl } = CONFIG.infinitepay;
  const body = {
    handle,
    order_nsu: String(order.id),
    redirect_url: `${siteUrl}/confirmacao.html?orderId=${order.id}&paid=1`,
    webhook_url: `${siteUrl}/api/webhooks/infinitepay`,
    items: items.map(i => ({
      quantity: 1,
      price: Math.round(Number(i.price) * 100), // centavos
      description: i.name,
    })),
  };
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error('[InfinitePay] request body:', JSON.stringify(body));
    console.error('[InfinitePay] response:', resp.status, text);
    throw new Error(`InfinitePay ${resp.status}: ${text}`);
  }
  return resp.json(); // { url, ... }
}

// ── CARTÃO / INFINITEPAY — gerar link ────────────────────────
// ── CARTÃO / INFINITEPAY — gerar link SEM criar pedido ───────
// O carrinho fica intacto. O pedido só é criado quando o webhook
// confirmar o pagamento. A sessão expira em 30 min se não pago.
app.post('/api/card-link', requireAuth, async (req, res) => {
  if (!CONFIG.cardEnabled) return fail(res, 503, 'Pagamento por cartão ainda não configurado.');

  // Limpar sessões expiradas deste usuário (best-effort)
  await supabase.from('payment_sessions')
    .delete().eq('user_id', req.user.id).lt('expires_at', new Date().toISOString());

  // Ler carrinho atual
  const { data: cartRows } = await supabase.from('cart_items').select('item_id').eq('user_id', req.user.id);
  if (!cartRows || cartRows.length === 0) return fail(res, 400, 'Carrinho vazio');

  const itemsData = cartRows.map(r => ITEMS.find(i => i.id === r.item_id)).filter(Boolean);
  if (itemsData.length === 0) return fail(res, 400, 'Nenhum item válido no carrinho');

  const total = itemsData.reduce((s, i) => s + i.price, 0);
  const sessionItems = itemsData.map(i => ({ item_id: i.id, price: i.price }));

  // Criar sessão de pagamento temporária (30 min)
  const { data: session, error: sessErr } = await supabase.from('payment_sessions')
    .insert({ user_id: req.user.id, items: sessionItems, total })
    .select('id').single();
  if (sessErr || !session) return fail(res, 500, 'Erro ao criar sessão de pagamento');

  // Gerar link InfinitePay com order_nsu = session.id
  try {
    const fakeOrder = { id: session.id, total };
    const link = await createInfinitePayLink(fakeOrder, itemsData);
    return ok(res, { url: link.url || link.checkout_url || link.link });
  } catch (e) {
    // Limpar sessão se falhar
    await supabase.from('payment_sessions').delete().eq('id', session.id);
    console.error('[InfinitePay]', e.message);
    return fail(res, 502, 'Não foi possível gerar o link de pagamento. Tente outro método ou contate os noivos.');
  }
});

// ── WEBHOOK INFINITEPAY — confirmar pagamento e criar pedido ──
// InfinitePay envia POST com { order_nsu, paid_amount, ... }
// order_nsu = payment_session.id (uuid)
// Responder 200 = sucesso; 400 = retry.
app.post('/api/webhooks/infinitepay', express.json(), async (req, res) => {
  const { order_nsu, paid_amount, capture_method } = req.body || {};
  if (!order_nsu) return res.status(400).json({ error: 'order_nsu ausente' });

  // Buscar sessão de pagamento
  const { data: session } = await supabase.from('payment_sessions')
    .select('*').eq('id', order_nsu).maybeSingle();

  if (!session) return res.status(400).json({ error: 'Sessão não encontrada ou expirada' });
  if (session.used) return res.status(200).json({ ok: true, already: true });
  if (new Date(session.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Sessão expirada' });
  }

  // Criar pedido e reservar itens via RPC atômica
  const pItems = session.items; // [{item_id, price}]
  const { data: orderId, error: orderErr } = await supabase.rpc('place_order', {
    p_user_id: session.user_id, p_items: pItems,
  });

  if (orderErr) {
    console.error('[InfinitePay webhook] place_order:', orderErr.message);
    // Se for conflito de item já reservado, retornar 200 pra evitar retry infinito
    if ((orderErr.message || '').includes('CONFLICT')) {
      await supabase.from('payment_sessions').update({ used: true }).eq('id', session.id);
      return res.status(200).json({ ok: false, reason: 'items_already_reserved' });
    }
    return res.status(400).json({ error: 'Erro ao criar pedido' });
  }

  // Marcar pedido como pago
  const paidReais = paid_amount ? paid_amount / 100 : session.total;
  await supabase.from('orders').update({
    status: 'paid',
    payment_method: capture_method || 'infinitepay',
    paid_amount: paidReais,
  }).eq('id', orderId);

  // Limpar carrinho do usuário
  await supabase.from('cart_items').delete().eq('user_id', session.user_id);

  // Marcar sessão como usada
  await supabase.from('payment_sessions').update({ used: true }).eq('id', session.id);

  console.log(`[InfinitePay] Pedido #${orderId} criado e pago (R$ ${paidReais}) — sessão ${session.id}`);
  return res.status(200).json({ ok: true, orderId });
});

// ──────────────────────────────────────────────────────────────
// START (local) / EXPORT (Vercel)
// ──────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(CONFIG.port, () => console.log(`Chá de Panelas rodando em http://localhost:${CONFIG.port}`));
}
module.exports = app;
