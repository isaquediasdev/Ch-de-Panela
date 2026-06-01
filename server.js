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

  // ── PIX ──────────────────────────────────────────────────────
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

// ── PUBLIC ────────────────────────────────────────────────────
app.get('/api/config', (req, res) => ok(res, {
  nomes: CONFIG.nomes, dataEvento: CONFIG.dataEvento, horaEvento: CONFIG.horaEvento,
  endereco: CONFIG.endereco, pixKey: CONFIG.pixKey, bank: CONFIG.bank, cardEnabled: CONFIG.cardEnabled,
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
    throw new Error(`InfinitePay ${resp.status}: ${text}`);
  }
  return resp.json(); // { url, ... }
}

// ── CARTÃO / INFINITEPAY — gerar link ────────────────────────
app.post('/api/card-link', requireAuth, async (req, res) => {
  if (!CONFIG.cardEnabled) return fail(res, 503, 'Pagamento por cartão ainda não configurado.');
  const { orderId } = req.body;
  if (!orderId) return fail(res, 400, 'orderId obrigatório');
  const { data: order } = await supabase.from('orders')
    .select('id, total, status').eq('id', orderId).eq('user_id', req.user.id).maybeSingle();
  if (!order) return fail(res, 404, 'Pedido não encontrado');
  if (order.status === 'paid') return fail(res, 409, 'Pedido já está pago');

  const { data: ois } = await supabase.from('order_items').select('item_id, price').eq('order_id', order.id);
  const items = (ois || []).map(oi => {
    const it = ITEMS.find(i => i.id === oi.item_id);
    return { id: oi.item_id, name: it ? it.name : `Presente #${oi.item_id}`, price: Number(oi.price) };
  });

  try {
    const link = await createInfinitePayLink(order, items);
    // Registrar método de pagamento
    await supabase.from('orders').update({ payment_method: 'cartao_infinitepay' }).eq('id', order.id);
    return ok(res, { url: link.url || link.checkout_url || link.link });
  } catch (e) {
    console.error('[InfinitePay]', e.message);
    return fail(res, 502, 'Não foi possível gerar o link de pagamento. Tente PIX ou contate os noivos.');
  }
});

// ── WEBHOOK INFINITEPAY — confirmar pagamento ────────────────
// InfinitePay envia POST com { order_nsu, paid_amount, ... }
// Responder 200 = sucesso; 400 = retry.
app.post('/api/webhooks/infinitepay', express.json(), async (req, res) => {
  const { order_nsu, paid_amount, capture_method } = req.body || {};
  const orderId = parseInt(order_nsu, 10);
  if (!orderId) return res.status(400).json({ error: 'order_nsu ausente' });

  const { data: order } = await supabase.from('orders').select('id, total, status').eq('id', orderId).maybeSingle();
  if (!order) return res.status(400).json({ error: 'Pedido não encontrado' });
  if (order.status === 'paid') return res.status(200).json({ ok: true, already: true });

  // paid_amount vem em centavos
  const paidReais = paid_amount ? paid_amount / 100 : null;
  await supabase.from('orders').update({
    status: 'paid',
    payment_method: capture_method || 'cartao_infinitepay',
    ...(paidReais !== null ? { paid_amount: paidReais } : {}),
  }).eq('id', orderId);

  console.log(`[InfinitePay] Pedido #${orderId} marcado como pago (R$ ${paidReais ?? '?'})`);
  return res.status(200).json({ ok: true });
});

// ──────────────────────────────────────────────────────────────
// START (local) / EXPORT (Vercel)
// ──────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(CONFIG.port, () => console.log(`Chá de Panelas rodando em http://localhost:${CONFIG.port}`));
}
module.exports = app;
