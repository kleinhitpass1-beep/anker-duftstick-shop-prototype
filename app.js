/* =========================
   an:care Prototyp Logik
   Warenkorb, Interesse, Podcast
   Speichert alles lokal im Browser
========================= */

(function () {
  "use strict";

  const CART_KEY = "ancare_cart_v1";
  const INTEREST_KEY = "ancare_interest_v1";
  const PODCAST_KEY = "anker_podcast_v1";

  /* ---------- Safe Storage ---------- */
  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("[an:care] localStorage get blockiert", e);
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn("[an:care] localStorage set blockiert", e);
      return false;
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn("[an:care] localStorage remove blockiert", e);
      return false;
    }
  }

  /* ---------- Helpers ---------- */
  function euro(n) {
    const val = typeof n === "number" ? n : parseFloat(n || "0");
    return (Number.isFinite(val) ? val : 0).toFixed(2).replace(".", ",") + " EUR";
  }

  function safeJsonParse(str, fallback) {
    if (str == null || str === "") return fallback; // <<< entscheidender Fix
    try {
      const parsed = JSON.parse(str);
      return parsed == null ? fallback : parsed;
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

  /* =========================
     CART
  ========================= */
  function loadCart() {
    const raw = safeGet(CART_KEY);
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : []; // <<< Fix: immer Array
  }

  function saveCart(cart) {
    const list = Array.isArray(cart) ? cart : [];
    safeSet(CART_KEY, JSON.stringify(list));
    setCartBadge();
  }

  function clearCart() {
    safeRemove(CART_KEY);
    setCartBadge();
    renderMiniCart();
  }

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
      if (!Number.isFinite(item.qty) || item.qty <= 0) item.qty = 1;
    } else {
      console.warn("[an:care] addToCart ungueltiger Parameter", itemOrName);
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

  function wireCartButtons() {
    const buttons = document.querySelectorAll("[data-add-to-cart]");
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id") || ("ancare_" + slugify(btn.getAttribute("data-name") || "item"));
        const name = btn.getAttribute("data-name") || "an:care";
        const note = btn.getAttribute("data-note") || "";
        const price = parseFloat(btn.getAttribute("data-price") || "0");
        const qty = parseInt(btn.getAttribute("data-qty") || "1", 10);

        addToCart({ id, name, note, price, qty });
      });
    });
  }

  /* =========================
     INTEREST
  ========================= */
  function loadInterest() {
    const parsed = safeJsonParse(safeGet(INTEREST_KEY), { events: [], totals: {} });
    return parsed && typeof parsed === "object" ? parsed : { events: [], totals: {} };
  }

  function saveInterest(data) {
    safeSet(INTEREST_KEY, JSON.stringify(data || { events: [], totals: {} }));
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

    data.events = Array.isArray(data.events) ? data.events : [];
    data.totals = data.totals && typeof data.totals === "object" ? data.totals : {};

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
        safeRemove(INTEREST_KEY);
        renderInterestPanel();
      });
    }
  }

  function wireInterestButtons() {
    const buttons = document.querySelectorAll("[data-interest]");
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
  ========================= */
  function loadPodcastEpisodes() {
    const parsed = safeJsonParse(safeGet(PODCAST_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function savePodcastEpisodes(list) {
    safeSet(PODCAST_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }

  function seedPodcastEpisodes() {
    const episodes = [
      {
        id: "ep_01",
        number: "01",
        title: "An:care im Detail",
        teaser: "Wer oder was steckt hinter an:care?",
        description: "Ein neues Werkzeug mit ganz viel Potenzial",
        duration: "12:10",
        publishedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        audioUrl: "episode01.mp3",
        spotifyUrl: "#",
        appleUrl: "#",
        webUrl: "#"
      },
      {
        id: "ep_02",
        number: "02",
        title: "Wenn der Kopf zu laut ist",
        teaser: "Drei Mini Schritte, um gedankliches Kreisen zu stoppen.",
        description: "Prototyp Episode. Du bekommst eine einfache Struktur für akute Unruhe.",
        duration: "03:40",
        publishedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        audioUrl: "",
        spotifyUrl: "#",
        appleUrl: "#",
        webUrl: "#"
      },
      {
        id: "ep_03",
        number: "03",
        title: "Abendritual ohne Perfektion",
        teaser: "So baust du ein Ritual auf, das du wirklich durchhaeltst.",
        description: "Prototyp Episode. Kleine Schritte, hohe Verlaesslichkeit.",
        duration: "04:05",
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
  function init() {
    setCartBadge();
    renderMiniCart();
    wireCartButtons();
    wireInterestButtons();
    renderInterestPanel();
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      init();
    } catch (e) {
      console.error("[an:care] Fehler in app.js", e);
    }
  });

  /* =========================
     Global Exports
  ========================= */
  window.addToCart = addToCart;
  window.clearCart = clearCart;
  window.loadCart = loadCart;
  window.renderMiniCart = renderMiniCart;
  window.setCartBadge = setCartBadge;

  window.trackInterest = trackInterest;
  window.renderInterestPanel = renderInterestPanel;

  window.loadPodcastEpisodes = loadPodcastEpisodes;
  window.seedPodcastEpisodes = seedPodcastEpisodes;
})();

/* =========================
   Versand und Zahlung (Prototyp)
========================= */
(function(){
  const CHECKOUT_KEY = "ancare_checkout_v1";

  function formatEUR(n){
    const v = Number(n || 0);
    return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";
  }

  function safeParse(str, fallback){
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function loadCheckout(){
    const raw = localStorage.getItem(CHECKOUT_KEY);
    const base = safeParse(raw || "{}", {});
    return {
      shipping: base.shipping || "dhl_399",
      payment: base.payment || "paypal"
    };
  }

  function saveCheckout(next){
    localStorage.setItem(CHECKOUT_KEY, JSON.stringify(next));
  }

  function getShippingPrice(code){
    if(code === "dhl_399") return 3.99;
    if(code === "pickup_0") return 0.00;
    return 0.00;
  }

  function getCartSubtotal(){
    // WICHTIG: loadCart ist nur als window.loadCart exportiert
    if(typeof window.loadCart !== "function") return 0;
    const cart = window.loadCart() || [];
    return cart.reduce((sum, item) => {
      const p = Number(item.price || 0);
      const q = Number(item.qty || 0);
      return sum + (p * q);
    }, 0);
  }

  function renderGrandTotal(){
    const el = document.getElementById("grandTotal");
    if(!el) return;

    const checkout = loadCheckout();
    const subtotal = getCartSubtotal();
    const shipping = getShippingPrice(checkout.shipping);
    const grand = subtotal + shipping;

    el.textContent = formatEUR(grand);
  }

  function bindCheckoutUI(){
    const shippingSelect = document.getElementById("shippingSelect");
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');

    if(!shippingSelect && paymentRadios.length === 0) return;

    const checkout = loadCheckout();

    if(shippingSelect){
      shippingSelect.value = checkout.shipping;
      shippingSelect.addEventListener("change", () => {
        const next = loadCheckout();
        next.shipping = shippingSelect.value;
        saveCheckout(next);
        renderGrandTotal();
      });
    }

    if(paymentRadios.length > 0){
      paymentRadios.forEach(r => {
        r.checked = (r.value === checkout.payment);
        r.addEventListener("change", () => {
          if(!r.checked) return;
          const next = loadCheckout();
          next.payment = r.value;
          saveCheckout(next);
        });
      });
    }

    renderGrandTotal();
  }

  function hookCartRerenders(){
    // Wenn renderMiniCart existiert, hängen wir uns dran, ohne etwas zu zerstören
    if(typeof window.renderMiniCart === "function" && !window.__ancareGrandHooked){
      window.__ancareGrandHooked = true;
      const original = window.renderMiniCart;
      window.renderMiniCart = function(){
        const res = original.apply(this, arguments);
        try { renderGrandTotal(); } catch {}
        return res;
      };
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindCheckoutUI();
    hookCartRerenders();
    renderGrandTotal();

    // Sicherheitsnetz: nach Klicks ebenfalls aktualisieren
    ["addBtn","fakePay","clear"].forEach(id => {
      const b = document.getElementById(id);
      if(b) b.addEventListener("click", () => setTimeout(renderGrandTotal, 60));
    });
  });
})();
// Vision: Wort-für-Wort Reveal + Unterlegung
(() => {
  const el = document.getElementById("visionLine");
  if (!el) return;

  const words = Array.from(el.querySelectorAll("span"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        el.classList.add("isVisible");

        words.forEach((w, i) => {
          w.style.transitionDelay = `${i * 0.12}s`; // Wort für Wort
        });

        observer.disconnect();
      });
    },
    { threshold: 0.45 }
  );

  observer.observe(el);
})();
// Vision: erst Label poppt auf, dann Wörter nacheinander + Underline läuft mit
(() => {
  const block = document.getElementById("visionBlock");
  const label = document.getElementById("visionLabel");
  const text = document.getElementById("visionText");
  const underline = document.getElementById("visionUnderline");
  if (!block || !label || !text || !underline) return;

  const spans = Array.from(text.querySelectorAll("span"));

  const moveUnderlineTo = (fromSpan, toSpan) => {
    const wrapRect = text.getBoundingClientRect();
    const a = fromSpan.getBoundingClientRect();
    const b = toSpan.getBoundingClientRect();

    const left = a.left - wrapRect.left;
    const right = b.right - wrapRect.left;

    underline.style.transform = `translateX(${left}px)`;
    underline.style.width = `${Math.max(0, right - left)}px`;
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;

      block.classList.add("isVisible");

      // 1) Label zuerst kurz aufploppen
      await new Promise(r => setTimeout(r, 450));

      // 2) Underline startet beim ersten Wort (wenn vorhanden)
      if (spans.length > 0) {
        moveUnderlineTo(spans[0], spans[0]);
      }

      // 3) Wörter nacheinander + Underline wächst mit
      spans.forEach((span, i) => {
        setTimeout(() => {
          span.style.opacity = "1";
          span.style.transform = "translateY(0)";
          moveUnderlineTo(spans[0], span);
        }, 250 + i * 180);
      });

      observer.disconnect();
    });
  }, { threshold: 0.45 });

  observer.observe(block);
})();


