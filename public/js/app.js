// ── Shared frontend utilities ──────────────────────────────────
(function () {
  'use strict';

  // ── Toast notifications ──────────────────────────────────────
  let toastContainer = null;

  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(message, type = 'info') {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3200);
  }

  // ── Price formatting ─────────────────────────────────────────
  function formatPrice(p) {
    return 'R$ ' + Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Cart badge ───────────────────────────────────────────────
  async function updateCartCount() {
    const badge = document.querySelector('.cart-badge');
    if (!badge) return;
    try {
      const res = await fetch('/api/cart');
      if (!res.ok) { badge.textContent = ''; return; }
      const { data } = await res.json();
      const count = Array.isArray(data) ? data.length : 0;
      badge.textContent = count > 0 ? count : '';
    } catch {
      badge.textContent = '';
    }
  }

  // ── Nav user state ───────────────────────────────────────────
  async function initNav() {
    const navUser = document.getElementById('nav-user-area');
    if (!navUser) return;

    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const { data } = await res.json();
        navUser.innerHTML = `
          <span class="nav-user nav-user-desktop">Olá, <strong>${escapeHtml(data.name.split(' ')[0])}</strong></span>
          <a href="/meus-pedidos.html" class="btn btn-outline btn-sm nav-user-desktop">Meus Pedidos</a>
          <button class="btn btn-outline btn-sm" id="logout-btn">Sair</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          window.location.href = '/';
        });
        // "Meus Pedidos" agora fica no nav-user-area — não duplica nos links
        await updateCartCount();
      } else {
        navUser.innerHTML = `<a href="/login.html" class="btn btn-outline btn-sm">Entrar</a>`;
      }
    } catch {
      navUser.innerHTML = `<a href="/login.html" class="btn btn-outline btn-sm">Entrar</a>`;
    }
  }

  // ── Escape HTML ──────────────────────────────────────────────
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── API helper ───────────────────────────────────────────────
  async function apiFetch(url, options = {}) {
    const defaults = {
      headers: { 'Content-Type': 'application/json' },
    };
    const merged = { ...defaults, ...options };
    if (options.body && typeof options.body === 'object') {
      merged.body = JSON.stringify(options.body);
    }
    const res = await fetch(url, merged);
    const json = await res.json();
    return { ok: res.ok, status: res.status, ...json };
  }

  // ── Config loader ────────────────────────────────────────────
  async function loadConfig() {
    try {
      const res = await apiFetch('/api/config');
      if (res.ok) return res.data;
    } catch {}
    return null;
  }

  // ── Fill config placeholders in page ─────────────────────────
  async function fillConfigPlaceholders() {
    const config = await loadConfig();
    if (!config) return;
    document.querySelectorAll('[data-config]').forEach(el => {
      const key = el.dataset.config;
      if (config[key] !== undefined) el.textContent = config[key];
    });
  }

  // ── Cart CTA modal ───────────────────────────────────────────
  function showCartCTA(itemName) {
    const overlay = document.createElement('div');
    overlay.className = 'cart-cta-overlay';
    overlay.innerHTML = `
      <div class="cart-cta-box">
        <div class="cart-cta-icon">🎁</div>
        <p class="cart-cta-title">${escapeHtml(itemName)} reservado!</p>
        <p class="cart-cta-sub">Deseja finalizar agora ou continuar escolhendo?</p>
        <div class="cart-cta-actions">
          <button class="btn-cta-checkout" id="cta-checkout">Finalizar compra →</button>
          <button class="btn-cta-continue" id="cta-continue">✦ Continuar escolhendo ✦</button>
        </div>
      </div>`;

    function dismiss() {
      overlay.classList.add('removing');
      overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
    overlay.querySelector('#cta-checkout').addEventListener('click', () => { window.location.href = '/carrinho.html'; });
    overlay.querySelector('#cta-continue').addEventListener('click', () => { window.location.href = '/lista.html'; });

    document.body.appendChild(overlay);
  }

  // ── Init on DOM ready ────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    await initNav();
    await fillConfigPlaceholders();
  });

  // ── Expose public API ────────────────────────────────────────
  window.App = {
    showToast,
    showCartCTA,
    formatPrice,
    updateCartCount,
    apiFetch,
    loadConfig,
    escapeHtml,
  };
})();
