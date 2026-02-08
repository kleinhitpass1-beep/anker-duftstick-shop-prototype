/* =========================
   an:care Prototyp Logik
   Warenkorb und Nachfrage Tracking
   Speichert alles lokal im Browser
========================= */

const CART_KEY = "ancare_cart_v1";
const INTEREST_KEY = "ancare_interest_v1";

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
  return safeJsonParse(localStorage.getItem(CART_KEY), []);
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  setCartBadge();
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  setCartBadge();
  // falls auf Produktseite vorhanden
  renderMiniCart();
}

/**
 * addToCart kann:
 * - addToCart("an:care Stick Calm")
 * - addToCart({ id, name, note, price, qty })
 */
function addToCart(itemOrName) {
  const cart = loadCart();

  // Schutz vor undefined / null
  const isString = typeof itemOrName === "string";
  const isObject = itemOrName && typeof itemOrName === "object";

  let item;

  if (isString) {
    // String-Fallback: sinnvoller Default statt price:0
    const name = itemOrName.trim();
    item = {
      id: "ancare_" + slugify(name || "item"),
      name: name || "an:care",
      note: "",
      price: 13.99,
      qty: 1
    };

    // Wenn Calm irgendwo im Namen vorkommt, setzen wir die definierte ID
    if (name.toLowerCase().includes("calm")) {
      item.id = "ancare_stick_calm";
      item.name = "an:care Stick Calm";
      item.note = "Lavendel Bergamotte Vetiver";
      item.price = 13.99;
    }
  } else if (isObject) {
    // Objekt: Defaults + Validierung
    const name = (itemOrName.name || "an:care").trim();
    item = {
      id: itemOrName.id || ("ancare_" + slugify(name || "item")),
      name,
      note: (itemOrName.note || "").trim(),
      price: typeof itemOrName.price === "number"
        ? itemOrName.price
        : parseFloat(itemOrName.price || "0"),
      qty: Math.max(1, parseInt(itemOrName.qty || "1", 10))
    };

    // Preis nicht valide oder 0 -> Default, damit es nicht "kaputt" wirkt
    if (!Number.isFinite(item.price) || item.price <= 0) item.price = 13.99;
  } else {
    // Unbekannter Aufruf: nicht crashen, einfach abbrechen
    console.warn("[an:care] addToCart: ungültiger Parameter", itemOrName);
    return;
  }

  const existing = cart.find((x) => x.id === item.id);
  if (existing) {
    existing.qty = (parseInt(existing.qty || 0, 10) || 0) + item.qty;
  } else {
    cart.push({ ...item });
  }

  saveCart(cart);

  // UI Updates
  setCartBadge();
  renderMiniCart();

  console.log("[an:care] addToCart OK:", item);
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

/* Mini Cart Rendering: optional on product page */
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

  const rows = cart
    .map((x, idx) => {
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
    })
    .join("");

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
  return safeJsonParse(localStorage.getItem(INTEREST_KEY), {
    events: [],
    totals: {},
  });
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
    note: payload.note || "",
  };

  data.events.push(event);
  data.totals[event.variant] = (data.totals[event.variant] || 0) + 1;

  saveInterest(data);
  return data;
}

function exportInterestCsv() {
  const data = loadInterest();
  const header = ["timestamp", "variant", "name", "source", "note"];
  const lines = [header.join(";")];

  for (const e of data.events) {
    const row = [
      e.ts,
      e.variant,
      e.name,
      e.source,
      (e.note || "").replaceAll(";", ","),
    ];
    lines.push(row.join(";"));
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "ancare_nachfrage.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function renderInterestPanel() {
  const host = document.getElementById("interestPanel");
  if (!host) return;

  const data = loadInterest();
  const totals = data.totals || {};

  const items = Object.keys(totals)
    .sort((a, b) => totals[b] - totals[a])
    .map((k) => `<div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid var(--line)">
      <div style="font-weight:800">${k}</div>
      <div class="price">${totals[k]}</div>
    </div>`)
    .join("");

  host.innerHTML = `
    <div class="card shadowBig" style="margin-top:18px">
      <div class="padLg">
        <div class="kicker"><span class="dot" aria-hidden="true"></span> Nachfrage Tracking</div>
        <h2 style="margin:12px 0 6px; font-size:20px">Interesse an Varianten</h2>
        <p class="sub" style="margin:0 0 12px">Zählt Klicks auf Interesse Buttons. Alles lokal im Browser gespeichert.</p>

        <div style="border:1px solid var(--line); border-radius:18px; padding:14px; background:rgba(255,255,255,.65)">
          ${items || `<div class="sub">Noch keine Nachfrage erfasst.</div>`}
        </div>

        <div class="ctaRow" style="margin-top:14px">
          <button class="btn btnPrimary" type="button" id="exportInterest">CSV Export</button>
          <button class="btn" type="button" id="clearInterest">Zurücksetzen</button>
        </div>
      </div>
    </div>
  `;

  const exportBtn = document.getElementById("exportInterest");
  const clearBtn = document.getElementById("clearInterest");

  if (exportBtn) exportBtn.addEventListener("click", exportInterestCsv);
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem(INTEREST_KEY);
      renderInterestPanel();
      alert("Nachfrage im Prototyp zurückgesetzt.");
    });
  }
}

/* ---------- Auto wiring for Shop buttons ---------- */
function wireInterestButtons() {
  const buttons = document.querySelectorAll("[data-interest]");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const variant = btn.getAttribute("data-interest") || "unknown";
      const name = btn.getAttribute("data-name") || "an:care";
      const source = btn.getAttribute("data-source") || "shop";
      const note = btn.getAttribute("data-note") || "";

      const data = trackInterest({ variant, name, source, note });

      btn.textContent = "Interesse gespeichert";
      btn.disabled = true;

      renderInterestPanel();
      console.log("[an:care] Nachfrage gespeichert:", variant, data.totals);
    });
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  setCartBadge();
  renderMiniCart(); // macht nichts, wenn miniCart nicht existiert
  wireInterestButtons();
  renderInterestPanel();
});

