/* =========================
   an:care Prototyp Logik
   Warenkorb und Nachfrage Tracking
   Speichert alles lokal im Browser
========================= */

const CART_KEY = "ancare_cart_v1";
const INTEREST_KEY = "ancare_interest_v1";

/* ---------- Storage (robust, auch im privaten Modus) ---------- */
const __memoryStore = {};

function storageGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v;
  } catch (e) {
    return Object.prototype.hasOwnProperty.call(__memoryStore, key) ? __memoryStore[key] : null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    __memoryStore[key] = value;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    delete __memoryStore[key];
  }
}

/* ---------- Helpers ---------- */
function euro(n) {
  const val = typeof n === "number" ? n : parseFloat(n || "0");
  return val.toFixed(2).replace(".", ",") + " EUR";
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* ---------- Cart ---------- */
function loadCart() {
  return safeJsonParse(storageGet(CART_KEY), []);
}

function saveCart(cart) {
  storageSet(CART_KEY, JSON.stringify(cart));
  setCartBadge();
}

function clearCart() {
  storageRemove(CART_KEY);
  setCartBadge();
  renderMiniCart();
}

/**
 * addToCart kann:
 * addToCart("an:care Stick Calm")
 * addToCart({ id, name, note, price, qty })
 */
function addToCart(itemOrName) {
  const cart = loadCart();

  const isString = typeof itemOrName === "string";
  const isObject = itemOrName && typeof itemOrName === "object";

  let item;

  if (isString) {
    const name = itemOrName.trim();
    item = {
      id: "ancare_" + slugify(name || "item"),
      name: name || "an:care",
      note: "",
      price: 13.99,
      qty: 1
    };

    if (name.toLowerCase().includes("calm")) {
      item.id = "ancare_stick_calm";
      item.name = "an:care Stick Calm";
      item.note = "Lavendel Bergamotte Vetiver";
      item.price = 13.99;
    }
  } else if (isObject) {
    const name = String(itemOrName.name || "an:care").trim();
    item = {
      id: itemOrName.id || ("ancare_" + slugify(name || "item")),
      name,
      note: String(itemOrName.note || "").trim(),
      price: typeof itemOrName.price === "number"
        ? itemOrName.price
        : parseFloat(itemOrName.price || "0"),
      qty: Math.max(1, parseInt(itemOrName.qty || "1", 10))
    };

    if (!Number.isFinite(item.price) || item.price <= 0) item.price = 13.99;
  } else {
    console.warn("[an:care] addToCart: ungueltiger Parameter", itemOrName);
    return null;
  }

  const existing = cart.find((x) => x.id === item.id);
  if (existing) {
    existing.qty = (parseInt(existing.qty || 0, 10) || 0) + item.qty;
  } else {
    cart.push({ ...item });
  }

  saveCart(cart);
  renderMiniCart();
  return item;
}

function cartCount() {
  const cart = loadCart();
  return cart.reduce((sum, x) => sum + (parseInt(x.qty || 0, 10) || 0), 0);
}

function cartTotal() {
  const cart = loadCart();
  return cart.reduce((sum, x) => sum + (Number(x.price || 0) * Number(x.qty || 0)), 0);
}

function setCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  el.textContent = String(cartCount());
}

/* Mini Cart Rendering: optional auf product.html */
function renderMiniCart() {
  const host = document.getElementById("miniCart");
  const totalEl = document.getElementById("miniCartTotal");
  if (!host) return;

  const cart = loadCart();

  if (!Array.isArray(cart) || cart.length === 0) {
    host.innerHTML = `<div class="sub">Dein Warenkorb ist aktuell leer.</div>`;
    if (totalEl) totalEl.textContent = euro(0);
    return;
  }

  const rows = cart.map((x, idx) => {
    const title = x.name || "an:care";
    const note = x.note ? `<div class="sub" style="margin-top:4px">${x.note}</div>` : "";
    const lineTotal = Number(x.price || 0) * Number(x.qty || 0);

    return `
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--line)">
        <div style="min-width:0">
          <div style="font-weight:800">${title}</div>
          ${note}
          <div class="sub" style="margin-top:6px">Menge: ${x.qty}</div>
        </div>
        <div style="text-align:right">
          <div class="price">${euro(lineTotal)}</div>
          <button class="btn btnSmall" type="button" data-remove-index="${idx}" style="margin-top:8px">Entfernen</button>
        </div>
      </div>
    `;
  }).join("");

  host.innerHTML = rows;

  host.querySelectorAll("[data-remove-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-remove-index"), 10);
      const next = loadCart();
      next.splice(i, 1);
      saveCart(next);
      renderMiniCart();
    });
  });

  if (totalEl) totalEl.textContent = euro(cartTotal());
}

/* ---------- Interest Tracking ---------- */
function loadInterest() {
  return safeJsonParse(storageGet(INTEREST_KEY), { events: [], totals: {} });
}

function saveInterest(data) {
  storageSet(INTEREST_KEY, JSON.stringify(data));
}

function trackInterest(payload) {
  const data = loadInterest();

  const event = {
    ts: new Date().toISOString(),
    variant: payload.variant || "unknown",
    name: payload.name || "an:care",
    source: payload.source || "shop",
    note: payload.note || "",
    email: payload.email || ""
  };

  data.events.push(event);
  data.totals[event.variant] = (data.totals[event.variant] || 0) + 1;

  saveInterest(data);
  return data;
}

/* Optional Panel auf shop.html (div id="interestPanel") */
function renderInterestPanel() {
  const host = document.getElementById("interestPanel");
  if (!host) return;

  const data = loadInterest();
  const totals = data.totals || {};

  const items = Object.keys(totals)
    .sort((a, b) => totals[b] - totals[a])
    .map((k) => `
      <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid var(--line)">
        <div style="font-weight:800">${k}</div>
        <div class="price">${totals[k]}</div>
      </div>
    `)
    .join("");

  host.innerHTML = `
    <div class="card shadowBig" style="margin-top:18px">
      <div class="padLg">
        <div class="kicker"><span class="dot" aria-hidden="true"></span> Nachfrage Tracking</div>
        <h2 style="margin:12px 0 6px; font-size:20px">Interesse an Varianten</h2>
        <p class="sub" style="margin:0 0 12px">Alles lokal im Browser gespeichert.</p>

        <div style="border:1px solid var(--line); border-radius:18px; padding:14px; background:rgba(255,255,255,.65)">
          ${items || `<div class="sub">Noch keine Nachfrage erfasst.</div>`}
        </div>

        <div class="ctaRow" style="margin-top:14px">
          <button class="btn" type="button" id="clearInterest">Zuruecksetzen</button>
        </div>
      </div>
    </div>
  `;

  const clearBtn = document.getElementById("clearInterest");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      storageRemove(INTEREST_KEY);
      renderInterestPanel();
      alert("Nachfrage im Prototyp zurueckgesetzt.");
    });
  }
}

/* ---------- Auto wiring ---------- */
function wireCartButtons() {
  const buttons = document.querySelectorAll("[data-add-to-cart]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id") || ("ancare_" + slugify(btn.getAttribute("data-name") || "item"));
      const name = btn.getAttribute("data-name") || "an:care";
      const note = btn.getAttribute("data-note") || "";
      const price = parseFloat(btn.getAttribute("data-price") || "0");
      const qty = parseInt(btn.getAttribute("data-qty") || "1", 10);

      addToCart({ id, name, note, price, qty });
      alert("Im Prototyp in den Warenkorb gelegt.");
    });
  });
}

function wireInterestButtons() {
  const buttons = document.querySelectorAll("[data-interest]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const variant = btn.getAttribute("data-interest") || "unknown";
      const name = btn.getAttribute("data-name") || "an:care";
      const source = btn.getAttribute("data-source") || "shop";
      const note = btn.getAttribute("data-note") || "";

      trackInterest({ variant, name, source, note });
      renderInterestPanel();

      btn.textContent = "Interesse gespeichert";
      btn.disabled = true;
    });
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  setCartBadge();
  renderMiniCart();
  wireCartButtons();
  wireInterestButtons();
  renderInterestPanel();
});

/* Global verfügbar lassen (für inline onclick) */
window.addToCart = addToCart;
window.clearCart = clearCart;
window.loadCart = loadCart;
window.renderMiniCart = renderMiniCart;
window.setCartBadge = setCartBadge;
window.trackInterest = trackInterest;
window.renderInterestPanel = renderInterestPanel;

