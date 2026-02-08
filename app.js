/* =========================
   an:care Prototyp Logik
   Warenkorb, Interesse, Podcast
   Speichert alles lokal im Browser
========================= */

"use strict";

/* ---------- Keys ---------- */
const CART_KEY = "ancare_cart_v1";
const INTEREST_KEY = "ancare_interest_v1";

// Podcast: wir unterstützen alt und neu, damit nichts bricht
const PODCAST_KEY_NEW = "ancare_podcast_v1";
const PODCAST_KEY_OLD = "anker_podcast_v1";

/* ---------- Helpers ---------- */
function euro(n) {
  const val = typeof n === "number" ? n : parseFloat(n || "0");
  return val.toFixed(2).replace(".", ",") + " EUR";
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
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

function qsa(sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
}

/* =========================
   CART
========================= */
function loadCart() {
  return safeJsonParse(localStorage.getItem(CART_KEY), []);
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  setCartBadge();
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  setCartBadge();
  renderMiniCart();
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
      price: typeof itemOrName.price === "number" ? itemOrName.price : parseFloat(itemOrName.price || "0"),
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

function renderMiniCart() {
  const host = document.getElementById("miniCart");
  const totalEl = document.getElementById("miniCartTotal");
  if (!host) return;

  const cart = loadCart();

  if (cart.length === 0) {
    host.innerHTML = `<div class="sub">Dein Warenkorb ist aktuell leer.</div>`;
    if (totalEl) totalEl.textContent = euro(0);
    return;
  }

  const rows = cart.map((x, idx) => {
    const title = x.name || "an:care";
    const note = x.note ? `<div class="sub" style="margin-top:4px">${x.note}</div>` : "";
    return `
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--line)">
        <div style="min-width:0">
          <div style="font-weight:800">${title}</div>
          ${note}
          <div class="sub" style="margin-top:6px">Menge: ${x.qty}</div>
        </div>
        <div style="text-align:right">
          <div class="price">${euro(Number(x.price || 0) * Number(x.qty || 0))}</div>
          <button class="btn btnSmall" type="button" data-remove-index="${idx}" style="margin-top:8px">Entfernen</button>
        </div>
      </div>
    `;
  }).join("");

  host.innerHTML = rows;

  qsa("[data-remove-index]", host).forEach((btn) => {
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

/* =========================
   INTEREST
========================= */
function loadInterest() {
  return safeJsonParse(localStorage.getItem(INTEREST_KEY), { events: [], totals: {} });
}

function saveInterest(data) {
  localStorage.setItem(INTEREST_KEY, JSON.stringify(data));
}

function trackInterest(payload) {
  const data = loadInterest();

  const event = {
    ts: new Date().toISOString(),
    variant: payload.variant || "unknown",
    name: payload.name || "an:care",
    source: payload.source || "shop",
    note: payload.note || ""
  };

  data.events.push(event);
  data.totals[event.variant] = (data.totals[event.variant] || 0) + 1;

  saveInterest(data);
  return data;
}

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
      localStorage.removeItem(INTEREST_KEY);
      renderInterestPanel();
      alert("Nachfrage im Prototyp zurueckgesetzt.");
    });
  }
}

function wireInterestButtons() {
  const buttons = qsa("[data-interest]");
  if (!buttons.length) return;

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

/* =========================
   PODCAST
   podcast.html erwartet:
   loadPodcastEpisodes()
   seedPodcastEpisodes()
========================= */
function _getPodcastKeyInUse() {
  const hasNew = !!localStorage.getItem(PODCAST_KEY_NEW);
  const hasOld = !!localStorage.getItem(PODCAST_KEY_OLD);
  if (hasNew) return PODCAST_KEY_NEW;
  if (hasOld) return PODCAST_KEY_OLD;
  return PODCAST_KEY_NEW;
}

function loadPodcastEpisodes() {
  const key = _getPodcastKeyInUse();
  const data = safeJsonParse(localStorage.getItem(key), { episodes: [] });
  return Array.isArray(data.episodes) ? data.episodes : [];
}

function savePodcastEpisodes(episodes) {
  const key = PODCAST_KEY_NEW;
  localStorage.setItem(key, JSON.stringify({ episodes: episodes || [] }));
}

function seedPodcastEpisodes() {
  const episodes = [
    {
      id: "ep_001",
      number: "01",
      title: "Der erste Reset in 60 Sekunden",
      teaser: "Ein kurzer Impuls, wie du in Stress Momenten wieder in deinen Koerper kommst.",
      description: "Prototyp Episode. Fokus auf Ausatmen, eine klare Mini Entscheidung und freundliche Selbstansprache.",
      duration: "06:10",
      publishedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      audioUrl: "",
      spotifyUrl: "#",
      appleUrl: "#",
      webUrl: "#"
    },
    {
      id: "ep_002",
      number: "02",
      title: "Uebergaenge statt Druck",
      teaser: "Wie du zwischen Terminen nicht wieder in den Tunnel faellst.",
      description: "Prototyp Episode. Kleine Rituale, klare Kanten, kein Perfektionismus.",
      duration: "08:25",
      publishedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      audioUrl: "",
      spotifyUrl: "#",
      appleUrl: "#",
      webUrl: "#"
    },
    {
      id: "ep_003",
      number: "03",
      title: "Abend Routine, die wirklich machbar ist",
      teaser: "Drei Minuten statt ein neues Leben.",
      description: "Prototyp Episode. Weniger Input, mehr Ruhe, ein einfacher Abschluss.",
      duration: "07:05",
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      audioUrl: "",
      spotifyUrl: "#",
      appleUrl: "#",
      webUrl: "#"
    }
  ];

  savePodcastEpisodes(episodes);
  return episodes;
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  try {
    setCartBadge();
    renderMiniCart();
    wireInterestButtons();
    renderInterestPanel();

    // Debug, falls wieder etwas nicht reagiert
    console.log("[an:care] app.js geladen", {
      cartCount: cartCount(),
      hasInterestButtons: qsa("[data-interest]").length
    });
  } catch (e) {
    console.error("[an:care] app init error", e);
  }
});

/* ---------- Global exports (wichtig fuer inline onclick) ---------- */
window.addToCart = addToCart;
window.clearCart = clearCart;
window.loadCart = loadCart;
window.renderMiniCart = renderMiniCart;
window.setCartBadge = setCartBadge;

window.trackInterest = trackInterest;
window.renderInterestPanel = renderInterestPanel;

window.loadPodcastEpisodes = loadPodcastEpisodes;
window.seedPodcastEpisodes = seedPodcastEpisodes;

