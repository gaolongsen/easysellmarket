/* ==========================================================
   小铺 · Curated Secondhand
   Single-file SPA — hash routing, Firestore backend.
   ========================================================== */

// ---------- Firebase initialization ----------
const CFG = window.FIREBASE_CONFIG || {};
const CONFIGURED = CFG.apiKey && CFG.apiKey !== "YOUR_API_KEY" && CFG.projectId && CFG.projectId !== "YOUR_PROJECT_ID";

let db = null;
if (CONFIGURED) {
  try {
    firebase.initializeApp(CFG);
    db = firebase.firestore();
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

// ---------- tiny helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (html) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
};
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));

const fmtPrice = (p) => {
  if (p === null || p === undefined || p === "") return "面议";
  const n = Number(p);
  if (isNaN(n)) return String(p);
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
};
const fmtTime = (ts) => {
  if (!ts) return "";
  let d;
  if (ts.toDate) d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
  if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + " 天前";
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
};
const initials = (name = "") => {
  const s = String(name).trim();
  if (!s) return "?";
  return s.slice(0, 1).toUpperCase();
};
const toast = (msg, type = "") => {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (type === "err" ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = "toast"; }, 2400);
};

const GOOGLE_MAPS_API_KEY = window.GOOGLE_MAPS_API_KEY || "";

function fmtApproxCoords(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function extractApproxLocationLabel(geocodeResult) {
  if (!geocodeResult || !Array.isArray(geocodeResult.address_components)) return "";
  const comps = geocodeResult.address_components;
  const pick = (...types) => {
    const match = comps.find(c => types.some(type => c.types.includes(type)));
    return match ? match.long_name : "";
  };
  const area = pick("sublocality_level_1", "sublocality", "neighborhood");
  const city = pick("locality", "administrative_area_level_2", "administrative_area_level_1");
  return [area, city].filter(Boolean).join(", ") || geocodeResult.formatted_address || "";
}

async function reverseGeocodeApproxLocation(lat, lng) {
  if (!GOOGLE_MAPS_API_KEY) return { label: fmtApproxCoords(lat, lng), source: "coords" };
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google Geocoding request failed");
  const data = await res.json();
  const top = Array.isArray(data.results) ? data.results[0] : null;
  return {
    label: extractApproxLocationLabel(top) || fmtApproxCoords(lat, lng),
    source: "google",
  };
}

function fillLocationFields(location) {
  const labelInput = $("#f-location");
  const latInput = $("#f-location-lat");
  const lngInput = $("#f-location-lng");
  const sourceInput = $("#f-location-source");
  if (labelInput) labelInput.value = location && location.label ? location.label : "";
  if (latInput) latInput.value = location && typeof location.lat === "number" ? String(location.lat) : "";
  if (lngInput) lngInput.value = location && typeof location.lng === "number" ? String(location.lng) : "";
  if (sourceInput) sourceInput.value = location && location.source ? location.source : "";
}

function readLocationFields() {
  const label = ($("#f-location") && $("#f-location").value.trim()) || "";
  const latRaw = ($("#f-location-lat") && $("#f-location-lat").value) || "";
  const lngRaw = ($("#f-location-lng") && $("#f-location-lng").value) || "";
  const source = ($("#f-location-source") && $("#f-location-source").value.trim()) || "";
  const lat = latRaw === "" ? null : Number(latRaw);
  const lng = lngRaw === "" ? null : Number(lngRaw);
  return {
    label,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    source,
  };
}

function reloadCurrentPage() {
  const hash = location.hash || "";
  const url = new URL(location.href);
  url.searchParams.set("refresh", String(Date.now()));
  url.hash = hash;
  location.href = url.toString();
}

function setupRefreshDock() {
  const dock = $("#refresh-dock");
  const btn = $("#refresh-dock-btn");
  if (!dock || !btn || setupRefreshDock._done) return;
  setupRefreshDock._done = true;

  let hideTimer = null;
  const openDock = () => {
    dock.classList.add("open");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => dock.classList.remove("open"), 2200);
  };
  const closeDock = () => {
    clearTimeout(hideTimer);
    dock.classList.remove("open");
  };

  dock.addEventListener("mouseenter", openDock);
  dock.addEventListener("mouseleave", closeDock);
  btn.addEventListener("focus", openDock);
  btn.addEventListener("blur", closeDock);
  btn.addEventListener("touchstart", (e) => {
    if (!dock.classList.contains("open")) {
      e.preventDefault();
      openDock();
    }
  }, { passive: false });
  btn.addEventListener("click", () => {
    toast("正在刷新最新内容…");
    setTimeout(reloadCurrentPage, 120);
  });
}

const ADMIN_KEY = "xiaopu_admin_ok";
const PUBLISHER_KEY = "xiaopu_publisher_session";

function normalizeCode(code = "") {
  return String(code).trim().toUpperCase();
}

function normalizePublisherCodeEntry(entry, id = "") {
  if (typeof entry === "string") {
    return { id, code: String(entry).trim(), label: "", enabled: true };
  }
  return {
    id: id || String(entry && entry.id || "").trim(),
    code: String(entry && entry.code || "").trim(),
    label: String(entry && entry.label || "").trim(),
    enabled: entry && entry.enabled !== false,
    createdAt: entry && entry.createdAt,
    updatedAt: entry && entry.updatedAt,
  };
}

function getPublisherCodes() {
  if (state.publisherCodesLoaded) return state.publisherCodes;
  const raw = Array.isArray(window.PUBLISHER_CODES) ? window.PUBLISHER_CODES : [];
  return raw.map((entry, index) => normalizePublisherCodeEntry(entry, `default-${index + 1}`))
    .filter(entry => entry.code);
}

function findPublisherCode(code) {
  const wanted = normalizeCode(code);
  return getPublisherCodes().find(entry => entry.enabled && normalizeCode(entry.code) === wanted) || null;
}

function getPublisherSession() {
  try {
    const raw = localStorage.getItem(PUBLISHER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function getActivePublisherSession() {
  const session = getPublisherSession();
  if (!session || !session.code) return null;
  const match = findPublisherCode(session.code);
  if (!match) return null;
  return {
    ...session,
    code: match.code,
    label: match.label,
  };
}

function savePublisherSession(session) {
  localStorage.setItem(PUBLISHER_KEY, JSON.stringify(session));
}

function clearPublisherSession() {
  localStorage.removeItem(PUBLISHER_KEY);
}

function isAdminMode() { return localStorage.getItem(ADMIN_KEY) === "1"; }
function isPublisherMode() { return !!getActivePublisherSession(); }

function isPublisherItemOwner(item, session = getActivePublisherSession()) {
  return !!(session && item && item.ownerType === "publisher" &&
    normalizeCode(item.publisherCode) === normalizeCode(session.code));
}

function canEditItem(item) {
  return isAdminMode() || isPublisherItemOwner(item);
}

function getItemOwnerName(item) {
  if (item && item.ownerType === "publisher") return item.publisherName || "认证发布者";
  return window.SELLER_NAME || "店主";
}

function getItemOwnerContact(item) {
  if (item && item.ownerType === "publisher") return item.publisherContact || "";
  return window.SELLER_WECHAT || "";
}

// ---------- categories / statuses ----------
const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "electronics", label: "电子产品" },
  { id: "furniture", label: "家具" },
  { id: "kitchen", label: "厨房用品" },
  { id: "clothing", label: "衣物" },
  { id: "books", label: "书籍" },
  { id: "beauty", label: "美妆个护" },
  { id: "sports", label: "运动器材" },
  { id: "other", label: "其他" },
];
const STATUS_LABEL = {
  available: "在售",
  reserved: "洽谈中",
  sold: "已售出"
};
const CONDITIONS = ["全新未拆", "几乎全新", "九成新", "八成新", "七成新", "有使用痕迹"];

// ---------- router ----------
const routes = [];
function route(pattern, handler) { routes.push({ pattern, handler }); }
function parseHash() {
  let h = location.hash.slice(1) || "/";
  if (!h.startsWith("/")) h = "/" + h;
  return h;
}
async function runRouter() {
  const path = parseHash();
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (m) {
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
      await r.handler(m, path);
      return;
    }
  }
  renderNotFound();
}
function navigate(path) { location.hash = path; }
window.navigate = navigate;
window.addEventListener("hashchange", runRouter);

// ---------- data layer (Firestore + local state cache) ----------
const state = {
  items: [],
  itemsLoaded: false,
  itemsUnsub: null,
  publisherCodes: [],
  publisherCodesLoaded: false,
  publisherCodesUnsub: null,
  currentCategory: "all",
  currentStatusFilter: "all",
};

function watchItems() {
  if (!db || state.itemsUnsub) return;
  state.itemsUnsub = db.collection("items")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      state.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.itemsLoaded = true;
      if (parseHash() === "/" || parseHash().startsWith("/?")) renderHome();
      if (parseHash() === "/admin") renderAdminDashboard();
      if (parseHash() === "/publish") renderPublisher();
    }, err => {
      console.error(err);
      toast("加载商品失败，请检查 Firebase 配置", "err");
    });
}

function watchPublisherCodes() {
  if (!db || state.publisherCodesUnsub) return;
  state.publisherCodesUnsub = db.collection("publisherCodes")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      state.publisherCodes = snap.docs
        .map(d => normalizePublisherCodeEntry({ id: d.id, ...d.data() }, d.id))
        .filter(entry => entry.code);
      state.publisherCodesLoaded = true;
      const path = parseHash();
      if (path === "/publish") renderPublisher();
      if (path === "/admin") renderAdminDashboard();
    }, err => {
      console.error(err);
      toast("加载序列码失败，请检查 Firebase 配置", "err");
    });
}

async function addPublisherCode(entry) {
  return db.collection("publisherCodes").add({
    code: normalizeCode(entry.code),
    label: String(entry.label || "").trim(),
    enabled: entry.enabled !== false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function updatePublisherCode(id, patch) {
  const next = { ...patch };
  if (next.code !== undefined) next.code = normalizeCode(next.code);
  if (next.label !== undefined) next.label = String(next.label || "").trim();
  return db.collection("publisherCodes").doc(id).update({
    ...next,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function deletePublisherCode(id) {
  return db.collection("publisherCodes").doc(id).delete();
}

async function addItem(item) {
  return db.collection("items").add({
    ...item,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
async function updateItem(id, patch) {
  return db.collection("items").doc(id).update({
    ...patch,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
async function deleteItem(id) {
  // delete subcollections first (comments, queue)
  for (const sub of ["comments", "queue"]) {
    const snap = await db.collection("items").doc(id).collection(sub).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    if (snap.docs.length) await batch.commit();
  }
  return db.collection("items").doc(id).delete();
}

// ---------- image compression ----------
async function compressImage(file, maxW = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxW) {
          h = Math.round(h * (maxW / w));
          w = maxW;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================================
// VIEW: setup screen (shown when firebase not configured)
// ==========================================================
function renderSetup() {
  $("#view").innerHTML = `
    <div class="container setup-screen">
      <div class="setup-card">
        <h1>你还差<em>一步</em>。</h1>
        <p>欢迎！这是一个轻量的二手物品展示站。部署到 GitHub Pages 之前，请先完成 Firebase 配置（完全免费，5 分钟）：</p>
        <ol>
          <li>前往 <a href="https://console.firebase.google.com" target="_blank" style="color:var(--accent-dark);text-decoration:underline;">Firebase 控制台</a> 创建一个新项目</li>
          <li>在项目中启用 <code>Firestore Database</code>（选"测试模式"开始即可）</li>
          <li>进入 <em>项目设置 · 常规</em>，添加一个 Web 应用，复制 <code>firebaseConfig</code></li>
          <li>打开 <code>index.html</code>，把配置填入 <code>window.FIREBASE_CONFIG</code></li>
          <li>修改 <code>window.ADMIN_PASSWORD</code> 为你的管理密码</li>
          <li>推送到 GitHub 仓库，开启 Pages，完成 🎉</li>
        </ol>
        <p>详细步骤见仓库里的 <code>README.md</code>。完成后刷新此页面即可。</p>
      </div>
    </div>
  `;
}

// ==========================================================
// VIEW: home
// ==========================================================
function renderHome() {
  const category = state.currentCategory;
  const status = state.currentStatusFilter;
  let items = state.items;

  if (category !== "all") items = items.filter(i => i.category === category);
  if (status === "available") items = items.filter(i => i.status !== "sold");
  if (status === "sold") items = items.filter(i => i.status === "sold");

  const countAll = state.items.length;
  const countAvail = state.items.filter(i => i.status !== "sold").length;
  const countSold = state.items.filter(i => i.status === "sold").length;

  const view = $("#view");
  view.innerHTML = `
    <section class="hero container reveal">
      <div class="hero-meta">
        <span>EST. ${new Date().getFullYear()}</span>
        <span class="sep"></span>
        <span>个人二手物品</span>
        <span class="sep"></span>
        <span>${countAvail} 件在售 · ${countSold} 件已售</span>
      </div>
      <h1 class="hero-title">不想再<span class="em">刷屏扰民</span>了，<br/>就把它们挂在这里。</h1>
      <p class="hero-lede">每一件都是我本人用过、愿意讲清楚来龙去脉的物品。感兴趣就留言或者排个队，我们一个个来——不用一遍遍发照片在群里、不用来回发PDF，拒绝扰民。</p>
      <p class="hero-lede">Note: 有任何关于物品的问题请直接在物品下方留言，看到后第一时间会答复，确认购买后再加微信，节约彼此时间</p>
      </section>

    <section class="container">
      <div class="filters" id="filters"></div>
      <div class="filters" id="status-filters" style="padding-top:0;"></div>
    </section>

    <section class="container items-section">
      <div class="grid" id="grid"></div>
    </section>
  `;

  // render category chips
  const catEl = $("#filters");
  CATEGORIES.forEach(c => {
    const count = c.id === "all" ? state.items.length : state.items.filter(i => i.category === c.id).length;
    const chip = el(`<button class="chip ${c.id === category ? 'active' : ''}" data-cat="${c.id}">
      ${esc(c.label)}<span class="count">${count}</span>
    </button>`);
    chip.onclick = () => { state.currentCategory = c.id; renderHome(); };
    catEl.appendChild(chip);
  });

  const statusFilters = [
    { id: "all", label: "全部", count: countAll },
    { id: "available", label: "在售", count: countAvail },
    { id: "sold", label: "已售", count: countSold },
  ];
  const sEl = $("#status-filters");
  statusFilters.forEach(s => {
    const chip = el(`<button class="chip ${s.id === status ? 'active' : ''}">
      ${esc(s.label)}<span class="count">${s.count}</span>
    </button>`);
    chip.onclick = () => { state.currentStatusFilter = s.id; renderHome(); };
    sEl.appendChild(chip);
  });

  // render grid
  const grid = $("#grid");
  if (!state.itemsLoaded) {
    for (let i = 0; i < 8; i++) {
      grid.appendChild(el(`<div class="skeleton-card">
        <div class="skeleton-photo"></div>
        <div class="skeleton-line" style="width:80%"></div>
        <div class="skeleton-line" style="width:40%"></div>
      </div>`));
    }
    return;
  }

  if (!items.length) {
    grid.appendChild(el(`<div class="empty">
      <h3>这里还很空</h3>
      <p>${state.items.length === 0 ? "店主还没上架任何物品。" : "这个分类下没有商品。"}</p>
    </div>`));
    return;
  }

  items.forEach(item => {
    const cover = (item.photos && item.photos[0]) || null;
    const statusBadge = item.status === "available" || !item.status
      ? ""
      : `<div class="item-status ${item.status}">${STATUS_LABEL[item.status] || item.status}</div>`;
    const queueBadge = (item.queueCount && item.queueCount > 0 && item.status !== "sold")
      ? `<div class="item-queue-badge">${item.queueCount} 人想要 →</div>`
      : "";
    const catLabel = (CATEGORIES.find(c => c.id === item.category) || {}).label || "";

    const card = el(`
      <article class="item-card" data-id="${item.id}">
        <div class="item-photo">
          ${cover ? `<img src="${cover}" alt="${esc(item.title)}" loading="lazy" />` : `<div class="no-img">?</div>`}
          ${statusBadge}
        </div>
        <div class="item-info">
          <div class="item-title">${esc(item.title || "未命名")}</div>
          <div class="item-meta">
            <div class="item-price"><span class="currency">$</span>${fmtPrice(item.price)}</div>
            <div class="item-cat">${esc(catLabel)}</div>
          </div>
          ${queueBadge}
        </div>
      </article>
    `);
    card.onclick = () => navigate("/item/" + item.id);
    grid.appendChild(card);
  });
}

// ==========================================================
// VIEW: item detail
// ==========================================================
let currentItemUnsubs = [];
function clearItemWatchers() {
  currentItemUnsubs.forEach(u => { try { u(); } catch(e){} });
  currentItemUnsubs = [];
}

async function renderItemDetail(id) {
  clearItemWatchers();
  const view = $("#view");
  view.innerHTML = `<div class="container detail">
    <div class="back" onclick="navigate('/')">
      <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
      <span>返回</span>
    </div>
    <div class="detail-layout reveal">
      <div class="gallery">
        <div class="skeleton-photo" style="aspect-ratio:4/5;border-radius:14px;"></div>
      </div>
      <div>
        <div class="skeleton-line" style="width:50%;height:18px;margin-bottom:16px;"></div>
        <div class="skeleton-line" style="width:80%;height:32px;margin-bottom:14px;"></div>
        <div class="skeleton-line" style="width:35%;height:40px;margin-bottom:24px;"></div>
        <div class="skeleton-line" style="width:100%;height:14px;margin-bottom:10px;"></div>
        <div class="skeleton-line" style="width:92%;height:14px;margin-bottom:10px;"></div>
        <div class="skeleton-line" style="width:70%;height:14px;"></div>
      </div>
    </div>
  </div>`;

  let item = state.items.find(i => i.id === id);
  if (!item) {
    try {
      const snap = await db.collection("items").doc(id).get();
      if (!snap.exists) { renderNotFound(); return; }
      item = { id: snap.id, ...snap.data() };
    } catch (e) {
      console.error(e);
      renderNotFound();
      return;
    }
  }

  // watch changes to this specific item
  const unsub1 = db.collection("items").doc(id).onSnapshot(snap => {
    if (!snap.exists) { navigate("/"); return; }
    item = { id: snap.id, ...snap.data() };
    paintItem(item);
  });
  currentItemUnsubs.push(unsub1);

  paintItem(item);
}

function paintItem(item) {
  const id = item.id;
  const view = $("#view");
  const photos = item.photos || [];
  const statusClass = item.status || "available";
  const condition = item.condition ? esc(item.condition) : "—";
  const catLabel = (CATEGORIES.find(c => c.id === item.category) || {}).label || "—";
  const ownerName = getItemOwnerName(item);
  const ownerContact = getItemOwnerContact(item);
  const locationLabel = item.locationLabel || "";
  const hasCoords = typeof item.locationLat === "number" && typeof item.locationLng === "number";
  const mapsQuery = locationLabel || (hasCoords ? fmtApproxCoords(item.locationLat, item.locationLng) : "");
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : "";
  const ownerLabel = item.ownerType === "publisher" ? "认证发布者" : "店主";
  const contactLabel = item.ownerType === "publisher" ? "发布者联系方式" : "店主联系方式";

  view.innerHTML = `
    <div class="container detail">
      <div class="back" onclick="navigate('/')">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        <span>全部物品</span>
      </div>
      <div class="detail-layout reveal">
        <div class="gallery" id="gallery"></div>

        <div class="info-panel">
          <div class="tiny-tag">${esc(catLabel)} · ${esc(condition)}</div>
          <h1>${esc(item.title || "未命名")}</h1>

          <div class="price-row">
            <div class="price-big"><span class="currency">$</span>${fmtPrice(item.price)}</div>
            ${item.originalPrice ? `<div class="price-original">原价 $${fmtPrice(item.originalPrice)}</div>` : ""}
            <span class="status-big ${statusClass}" style="margin-left:auto;">${STATUS_LABEL[item.status] || "在售"}</span>
          </div>

          <div class="meta-list">
            <div class="meta-item">
              <div class="tiny">成色</div>
              <div class="val">${condition}</div>
            </div>
            <div class="meta-item">
              <div class="tiny">类别</div>
              <div class="val">${esc(catLabel)}</div>
            </div>
            <div class="meta-item">
              <div class="tiny">上架时间</div>
              <div class="val">${fmtTime(item.createdAt) || "—"}</div>
            </div>
            <div class="meta-item">
              <div class="tiny">${ownerLabel}</div>
              <div class="val">${esc(ownerName)}</div>
            </div>
            ${locationLabel ? `
              <div class="meta-item">
                <div class="tiny">大致位置</div>
                <div class="val">${esc(locationLabel)}</div>
              </div>
            ` : ""}
          </div>

          <div class="description">${esc(item.description || "（暂无描述）")}</div>

          ${locationLabel ? `
            <div class="queue-box" style="margin-bottom:16px;">
              <h3>大致位置</h3>
              <div style="font-size:1rem;color:var(--ink);word-break:break-word;">${esc(locationLabel)}</div>
              <div class="queue-hint" style="padding-bottom:0;">
                仅显示大致区域，具体交易点请和发布者联系确认。
                ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="margin-left:8px;color:var(--accent-dark);text-decoration:underline;">在 Google Maps 打开</a>` : ""}
              </div>
            </div>
          ` : ""}

          ${ownerContact ? `
            <div class="queue-box" style="margin-bottom:16px;">
              <h3>${contactLabel}</h3>
              <div style="font-size:1rem;color:var(--ink);word-break:break-word;">${esc(ownerContact)}</div>
              <div class="queue-hint" style="padding-bottom:0;">
                ${item.ownerType === "publisher" ? "这件物品由已验证过身份的发布者上架，联系时可以备注商品名。" : "如需直接联系店主，可以使用上面的联系方式。"}
              </div>
            </div>
          ` : ""}

          <div class="queue-box" id="queue-box"></div>

          ${item.status !== "sold" ? `
            <button class="btn accent block" onclick="openQueueDialog('${id}')">
              <svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              我也想要 · 加入排队
            </button>
          ` : `
            <button class="btn ghost block" disabled>这件物品已经售出</button>
          `}
        </div>
      </div>

      <section class="comments-section">
        <h2>留言墙<span class="count" id="comment-count">0</span></h2>
        <div class="comment-form">
          <div class="row">
            <div class="field">
              <label>你的称呼</label>
              <input type="text" id="c-author" placeholder="怎么称呼你？" maxlength="30" />
            </div>
            <div class="field">
              <label>联系方式 · 选填</label>
              <input type="text" id="c-contact" placeholder="微信号 / email" maxlength="60" />
            </div>
          </div>
          <div class="field" style="margin-bottom:12px;">
            <label>留言内容</label>
            <textarea id="c-text" placeholder="尺寸？能便宜点吗？还能保留吗？…" maxlength="500"></textarea>
          </div>
          <button class="btn small" onclick="submitComment('${id}')">发布留言</button>
        </div>
        <div class="comment-list" id="comment-list"></div>
      </section>
    </div>
  `;

  paintGallery(photos);
  watchQueue(id);
  watchComments(id);
}

// ---- gallery ----
function paintGallery(photos) {
  const wrap = $("#gallery");
  if (!wrap) return;
  if (!photos || !photos.length) {
    wrap.innerHTML = `<div class="gallery-main"><div class="no-img" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-3);font-family:var(--font-display);font-style:italic;font-size:2rem;">无图</div></div>`;
    return;
  }
  let idx = 0;
  const render = () => {
    wrap.innerHTML = `
      <div class="gallery-main">
        <img src="${photos[idx]}" alt="" data-open-viewer="${idx}" />
        ${photos.length > 1 ? `
          <button class="gallery-nav prev" id="g-prev"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
          <button class="gallery-nav next" id="g-next"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
          <div class="gallery-counter">${idx + 1} / ${photos.length}</div>
        ` : ""}
      </div>
      ${photos.length > 1 ? `
        <div class="gallery-thumbs">
          ${photos.map((p, i) => `<div class="gallery-thumb ${i === idx ? 'active' : ''}" data-i="${i}"><img src="${p}" /></div>`).join("")}
        </div>
      ` : ""}
    `;
    const prev = $("#g-prev");
    const next = $("#g-next");
    if (prev) prev.onclick = () => { idx = (idx - 1 + photos.length) % photos.length; render(); };
    if (next) next.onclick = () => { idx = (idx + 1) % photos.length; render(); };
    const mainImage = $("[data-open-viewer]", wrap);
    if (mainImage) {
      mainImage.onclick = () => openImageViewer(photos, idx);
    }
    $$(".gallery-thumb", wrap).forEach(t => {
      t.onclick = () => { idx = Number(t.dataset.i); render(); };
    });

    // swipe on mobile
    const main = $(".gallery-main", wrap);
    if (main && photos.length > 1) {
      let sx = 0;
      main.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
      main.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) {
          idx = dx < 0 ? (idx + 1) % photos.length : (idx - 1 + photos.length) % photos.length;
          render();
        }
      });
    }
  };
  render();
}

function openImageViewer(photos, startIndex = 0) {
  if (!photos || !photos.length) return;
  const root = $("#modal-root");
  if (!root) return;

  let idx = startIndex;
  let scale = 1;
  const clampScale = (value) => Math.min(4, Math.max(0.75, value));

  const render = () => {
    root.innerHTML = `
      <div class="image-viewer-backdrop" id="image-viewer-backdrop">
        <div class="image-viewer">
          <div class="image-viewer-toolbar">
            <div>${idx + 1} / ${photos.length}</div>
            <div class="image-viewer-actions">
              <button class="image-viewer-btn" id="iv-zoom-out" type="button">缩小</button>
              <button class="image-viewer-btn" id="iv-zoom-reset" type="button">重置</button>
              <button class="image-viewer-btn" id="iv-zoom-in" type="button">放大</button>
              ${photos.length > 1 ? `<button class="image-viewer-btn" id="iv-prev" type="button">上一张</button>
              <button class="image-viewer-btn" id="iv-next" type="button">下一张</button>` : ""}
              <button class="image-viewer-btn" id="iv-close" type="button">关闭</button>
            </div>
          </div>
          <div class="image-viewer-stage" id="image-viewer-stage">
            <img src="${photos[idx]}" alt="" id="image-viewer-img" />
          </div>
        </div>
      </div>
    `;

    const img = $("#image-viewer-img");
    const stage = $("#image-viewer-stage");
    const backdrop = $("#image-viewer-backdrop");
    const applyScale = () => {
      if (img) img.style.transform = `scale(${scale})`;
    };
    applyScale();

    $("#iv-close").onclick = closeModal;
    $("#iv-zoom-in").onclick = () => { scale = clampScale(scale + 0.25); applyScale(); };
    $("#iv-zoom-out").onclick = () => { scale = clampScale(scale - 0.25); applyScale(); };
    $("#iv-zoom-reset").onclick = () => { scale = 1; applyScale(); if (stage) stage.scrollTo({ top: 0, left: 0, behavior: "smooth" }); };

    const goPrev = () => { idx = (idx - 1 + photos.length) % photos.length; scale = 1; render(); };
    const goNext = () => { idx = (idx + 1) % photos.length; scale = 1; render(); };
    const prevBtn = $("#iv-prev");
    const nextBtn = $("#iv-next");
    if (prevBtn) prevBtn.onclick = goPrev;
    if (nextBtn) nextBtn.onclick = goNext;

    if (stage) {
      stage.onwheel = (e) => {
        e.preventDefault();
        scale = clampScale(scale + (e.deltaY < 0 ? 0.2 : -0.2));
        applyScale();
      };
    }
    if (backdrop) {
      backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };
    }
    document.onkeydown = (e) => {
      if (!$("#image-viewer-backdrop")) {
        document.onkeydown = null;
        return;
      }
      if (e.key === "Escape") closeModal();
      else if (e.key === "ArrowLeft" && photos.length > 1) goPrev();
      else if (e.key === "ArrowRight" && photos.length > 1) goNext();
      else if (e.key === "+" || e.key === "=") { scale = clampScale(scale + 0.25); applyScale(); }
      else if (e.key === "-") { scale = clampScale(scale - 0.25); applyScale(); }
    };
  };

  render();
}

// ---- queue watcher & rendering ----
function watchQueue(itemId) {
  const unsub = db.collection("items").doc(itemId).collection("queue")
    .orderBy("joinedAt", "asc")
    .onSnapshot(snap => {
      const queue = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(q => q.status !== "removed" && q.status !== "passed");
      paintQueue(itemId, queue);
      // update queueCount on item doc (best-effort)
      const activeCount = queue.length;
      const item = state.items.find(i => i.id === itemId);
      if (item && item.queueCount !== activeCount) {
        db.collection("items").doc(itemId).update({ queueCount: activeCount }).catch(()=>{});
      }
    });
  currentItemUnsubs.push(unsub);
}

function paintQueue(itemId, queue) {
  const box = $("#queue-box");
  if (!box) return;
  const current = queue.find(q => q.status === "active");
  const waiting = queue.filter(q => q.status !== "active");
  const renderQueueNote = (q) => {
    if (!q.note) return "";
    return `
      <details class="queue-note-toggle">
        <summary>查看想说的话</summary>
        <div class="queue-note-text">${esc(q.note)}</div>
      </details>
    `;
  };

  box.innerHTML = `
    <h3>排队情况 <span class="count">${queue.length} 人</span></h3>
    <div class="queue-list">
      ${queue.length === 0 ? `<div class="queue-empty">还没人排队 · 第一个就是你</div>` : ""}
      ${current ? `
        <div class="queue-item active">
          <span class="queue-pos" style="background:rgba(255,255,255,.25);color:#fff;">洽</span>
          <div class="queue-item-body">
            <div class="queue-item-main">
              <span class="queue-name">${esc(current.name)}</span>
              <span class="queue-contact">${esc(current.contact || "")}</span>
              <span class="queue-time">${fmtTime(current.joinedAt)}</span>
            </div>
            ${renderQueueNote(current)}
          </div>
        </div>
      ` : ""}
      ${waiting.map((q, i) => {
        const pos = current ? i + 1 : i + 1;
        return `
        <div class="queue-item">
          <span class="queue-pos">${pos}</span>
          <div class="queue-item-body">
            <div class="queue-item-main">
              <span class="queue-name">${esc(q.name)}</span>
              <span class="queue-contact">${esc(q.contact || "")}</span>
              <span class="queue-time">${fmtTime(q.joinedAt)}</span>
            </div>
            ${renderQueueNote(q)}
          </div>
        </div>
      `;
      }).join("")}
    </div>
    <div class="queue-hint">
      ${current ? `店主正在和 <b>${esc(current.name)}</b> 沟通。如果这单没成，会按顺序联系下一位。` :
        queue.length > 0 ? `店主还没开始联系，按时间先后排序。` :
        `你可以直接加入排队或者先在下方留言问问。`}
    </div>
  `;
}

// ---- queue dialog ----
function openQueueDialog(itemId) {
  const root = $("#modal-root");
  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <button class="modal-close" onclick="closeModal()">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6"/></svg>
        </button>
        <h2>加入排队</h2>
        <p class="sub">店主会按排队顺序联系。如果你填了联系方式，其他人看不到，只有店主能看到（但都会存在 Firestore 里）。</p>
        <div class="field" style="margin-bottom:12px;">
          <label>称呼 *</label>
          <input type="text" id="q-name" placeholder="昵称或真名" maxlength="30" />
        </div>
        <div class="field" style="margin-bottom:12px;">
          <label>联系方式 *</label>
          <input type="text" id="q-contact" placeholder="微信号 / email / 电话" maxlength="80" />
        </div>
        <div class="field" style="margin-bottom:18px;">
          <label>想说的话 · 选填</label>
          <textarea id="q-note" placeholder="比如希望的取货时间…" maxlength="200"></textarea>
        </div>
        <button class="btn accent block" id="q-submit">确认加入排队</button>
      </div>
    </div>
  `);
  backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };
  root.appendChild(backdrop);
  setTimeout(() => $("#q-name").focus(), 100);

  $("#q-submit").onclick = async () => {
    const name = $("#q-name").value.trim();
    const contact = $("#q-contact").value.trim();
    const note = $("#q-note").value.trim();
    if (!name || !contact) {
      toast("请填称呼和联系方式", "err");
      return;
    }
    $("#q-submit").disabled = true;
    $("#q-submit").textContent = "提交中…";
    try {
      await db.collection("items").doc(itemId).collection("queue").add({
        name, contact, note,
        status: "waiting",
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      closeModal();
      toast("已加入排队 ✓");
    } catch (e) {
      console.error(e);
      toast("提交失败，请稍后重试", "err");
      $("#q-submit").disabled = false;
      $("#q-submit").textContent = "确认加入排队";
    }
  };
}

function closeModal() {
  const root = $("#modal-root");
  root.innerHTML = "";
  document.onkeydown = null;
}
window.closeModal = closeModal;
window.openQueueDialog = openQueueDialog;

// ---- comments ----
function watchComments(itemId) {
  const unsub = db.collection("items").doc(itemId).collection("comments")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      paintComments(itemId, list);
    });
  currentItemUnsubs.push(unsub);
}

function paintComments(itemId, list) {
  $("#comment-count").textContent = list.length;
  const box = $("#comment-list");
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<div style="text-align:center;padding:30px 0;color:var(--ink-3);font-style:italic;font-family:var(--font-display);">还没人留言 · 你是第一个</div>`;
    return;
  }
  const isAdmin = isAdminMode();
  box.innerHTML = list.map(c => `
    <div class="comment">
      <div class="comment-avatar">${esc(initials(c.author))}</div>
      <div class="comment-body">
        <div class="comment-head">
          <span class="comment-author">${esc(c.author || "匿名")}</span>
          <span class="comment-time">${fmtTime(c.createdAt)}</span>
          ${isAdmin ? `<span class="comment-del" data-id="${c.id}">删除</span>` : ""}
        </div>
        <div class="comment-text">${esc(c.text || "")}</div>
        ${isAdmin && c.contact ? `<div class="comment-time" style="margin-top:4px;">📮 ${esc(c.contact)}</div>` : ""}
      </div>
    </div>
  `).join("");

  if (isAdmin) {
    $$(".comment-del").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("确定删除这条留言？")) return;
        try {
          await db.collection("items").doc(itemId).collection("comments").doc(btn.dataset.id).delete();
          toast("已删除");
        } catch (e) { toast("删除失败", "err"); }
      };
    });
  }
}

async function submitComment(itemId) {
  const author = $("#c-author").value.trim() || "匿名路人";
  const contact = $("#c-contact").value.trim();
  const text = $("#c-text").value.trim();
  if (!text) { toast("说点什么吧", "err"); return; }
  try {
    await db.collection("items").doc(itemId).collection("comments").add({
      author, contact, text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    $("#c-author").value = "";
    $("#c-contact").value = "";
    $("#c-text").value = "";
    toast("留言已发布 ✓");
  } catch (e) {
    console.error(e);
    toast("发布失败", "err");
  }
}
window.submitComment = submitComment;

// ==========================================================
// VIEW: publisher
// ==========================================================
let publisherTab = "add";

function renderPublisher() {
  watchPublisherCodes();
  if (!isPublisherMode()) { renderPublisherLogin(); return; }
  renderPublisherDashboard();
}

function renderPublisherLogin() {
  const codes = getPublisherCodes();
  $("#view").innerHTML = `
    <div class="container admin-wrap">
      <div style="max-width:560px;margin:40px auto;">
        <h1>发布者入口</h1>
        <p class="lede">只有拿到你手动发放的序列码的人才能发布闲置。登录后发布的物品会绑定发布者身份和联系方式。</p>
        <div class="field" style="margin-bottom:14px;">
          <label>序列码</label>
          <input type="text" id="p-code" placeholder="输入你拿到的序列码" />
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label>你的称呼</label>
          <input type="text" id="p-name" placeholder="真实姓名或方便识别的称呼" maxlength="30" />
        </div>
        <div class="field" style="margin-bottom:18px;">
          <label>联系方式</label>
          <input type="text" id="p-contact" placeholder="微信号 / email / 电话" maxlength="80" />
        </div>
        <button class="btn accent block" id="p-login">用序列码进入发布中心</button>
        <div class="queue-hint" style="margin-top:16px;padding:0;">
          当前已配置 ${codes.length} 个可用序列码。管理员可以在后台的“序列码管理”里随时新增、停用或删除。
        </div>
      </div>
    </div>
  `;
  const attempt = () => {
    const code = $("#p-code").value.trim();
    const name = $("#p-name").value.trim();
    const contact = $("#p-contact").value.trim();
    const match = findPublisherCode(code);
    if (!match) { toast("序列码无效或已停用", "err"); return; }
    if (!name || !contact) { toast("请填写称呼和联系方式", "err"); return; }
    savePublisherSession({
      code: match.code,
      publisherName: name,
      publisherContact: contact,
    });
    toast("验证通过，可以开始发布了 ✓");
    renderPublisherDashboard();
  };
  $("#p-login").onclick = attempt;
  ["#p-code", "#p-name", "#p-contact"].forEach(sel => {
    $(sel).onkeydown = (e) => { if (e.key === "Enter") attempt(); };
  });
}

function renderPublisherDashboard() {
  const session = getActivePublisherSession();
  if (!session) { renderPublisherLogin(); return; }
  const ownItems = state.items.filter(item => isPublisherItemOwner(item, session));
  $("#view").innerHTML = `
    <div class="container admin-wrap reveal">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;">
        <div>
          <h1>发布者中心</h1>
          <p class="lede">欢迎你，${esc(session.publisherName)}。你可以发布自己的闲置，也可以回来看自己上架过的内容。</p>
          <div class="queue-hint" style="padding:0;margin-top:-14px;">
            当前序列码：<b>${esc(session.code)}</b>${session.label ? ` · ${esc(session.label)}` : ""} · 联系方式：${esc(session.publisherContact)}
          </div>
        </div>
        <button class="btn ghost small" onclick="publisherLogout()">退出</button>
      </div>
      <div class="admin-tabs">
        <button class="tab ${publisherTab === 'add' ? 'active' : ''}" data-p="add">+ 发布闲置</button>
        <button class="tab ${publisherTab === 'items' ? 'active' : ''}" data-p="items">我的物品 (${ownItems.length})</button>
      </div>
      <div id="admin-body"></div>
    </div>
  `;
  $$("[data-p]").forEach(t => {
    t.onclick = () => { publisherTab = t.dataset.p; renderPublisherDashboard(); };
  });
  if (publisherTab === "items") renderPublisherItems();
  else renderAdminAdd(null, { mode: "publisher", session });
}

function publisherLogout() {
  clearPublisherSession();
  toast("已退出发布者中心");
  navigate("/");
}
window.publisherLogout = publisherLogout;

function renderPublisherItems() {
  const body = $("#admin-body");
  const session = getActivePublisherSession();
  if (!session) { renderPublisherLogin(); return; }
  const items = state.items.filter(item => isPublisherItemOwner(item, session));
  if (!items.length) {
    body.innerHTML = `<div class="empty"><h3>你还没有发布任何物品</h3><p>去 “+ 发布闲置” 页面发第一件吧。</p></div>`;
    return;
  }
  body.innerHTML = `<div class="admin-items">${items.map(item => {
    const cover = (item.photos && item.photos[0]) || "";
    return `
      <div class="admin-item">
        <div class="admin-item-thumb">${cover ? `<img src="${cover}" />` : ""}</div>
        <div class="admin-item-info">
          <div class="t">${esc(item.title)}</div>
          <div class="m">
            <span>${item.ownerType === "publisher" ? "发布者" : "管理员"}：${esc(getItemOwnerName(item))}</span>
            <span>·</span>
            <span>$${fmtPrice(item.price)}</span>
            <span>·</span>
            <span>${STATUS_LABEL[item.status] || "在售"}</span>
            ${item.queueCount ? `<span>·</span><span>${item.queueCount} 人排队</span>` : ""}
          </div>
        </div>
        <div class="admin-item-actions">
          <button class="btn ghost small" onclick="navigate('/item/${item.id}')">查看</button>
          <button class="btn ghost small" data-own-edit="${item.id}">编辑</button>
          <button class="btn ghost small" data-own-del="${item.id}" style="color:var(--accent-dark);">删除</button>
        </div>
      </div>
    `;
  }).join("")}</div>`;
  $$("[data-own-edit]").forEach(b => {
    b.onclick = () => {
      const item = state.items.find(i => i.id === b.dataset.ownEdit);
      if (!item || !isPublisherItemOwner(item, session)) return;
      publisherTab = "add";
      renderPublisherDashboard();
      setTimeout(() => renderAdminAdd(item, { mode: "publisher", session }), 10);
    };
  });
  $$("[data-own-del]").forEach(b => {
    b.onclick = async () => {
      const item = state.items.find(i => i.id === b.dataset.ownDel);
      if (!item || !isPublisherItemOwner(item, session)) return;
      if (!confirm("确定删除这件物品？相关留言和排队记录也会一起删除。")) return;
      try {
        await deleteItem(item.id);
        toast("已删除");
      } catch (e) {
        console.error(e);
        toast("删除失败", "err");
      }
    };
  });
}

// ==========================================================
// VIEW: admin
// ==========================================================

function renderAdmin() {
  watchPublisherCodes();
  if (!isAdminMode()) { renderAdminLogin(); return; }
  renderAdminDashboard();
}

function renderAdminLogin() {
  $("#view").innerHTML = `
    <div class="container admin-wrap">
      <div style="max-width:440px;margin:40px auto;">
        <h1>管理后台</h1>
        <p class="lede">仅店主可进入，用来上架、下架、管理排队和留言。</p>
        <div class="field" style="margin-bottom:14px;">
          <label>管理员密码</label>
          <input type="password" id="a-pass" placeholder="输入密码" />
        </div>
        <button class="btn block" id="a-login">进入后台</button>
      </div>
    </div>
  `;
  const attempt = () => {
    const p = $("#a-pass").value;
    if (p === window.ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_KEY, "1");
      toast("欢迎回来 ✓");
      renderAdminDashboard();
    } else {
      toast("密码不对", "err");
    }
  };
  $("#a-login").onclick = attempt;
  $("#a-pass").onkeydown = (e) => { if (e.key === "Enter") attempt(); };
}

let adminTab = "add";
function renderAdminDashboard() {
  if (!isAdminMode()) { renderAdminLogin(); return; }
  const codeCount = getPublisherCodes().length;
  $("#view").innerHTML = `
    <div class="container admin-wrap reveal">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;">
        <div>
          <h1>管理后台</h1>
          <p class="lede">在这里上架物品、修改状态、推进排队。所有改动会实时同步。</p>
        </div>
        <button class="btn ghost small" onclick="adminLogout()">退出</button>
      </div>
      <div class="admin-tabs">
        <button class="tab ${adminTab === 'add' ? 'active' : ''}" data-t="add">+ 新上架</button>
        <button class="tab ${adminTab === 'items' ? 'active' : ''}" data-t="items">所有物品 (${state.items.length})</button>
        <button class="tab ${adminTab === 'queue' ? 'active' : ''}" data-t="queue">排队管理</button>
        <button class="tab ${adminTab === 'codes' ? 'active' : ''}" data-t="codes">序列码管理 (${codeCount})</button>
      </div>
      <div id="admin-body"></div>
    </div>
  `;
  $$(".tab").forEach(t => {
    t.onclick = () => { adminTab = t.dataset.t; renderAdminDashboard(); };
  });
  if (adminTab === "add") renderAdminAdd();
  else if (adminTab === "items") renderAdminItems();
  else if (adminTab === "queue") renderAdminQueue();
  else if (adminTab === "codes") renderAdminPublisherCodes();
}

function adminLogout() {
  localStorage.removeItem(ADMIN_KEY);
  toast("已退出");
  navigate("/");
}
window.adminLogout = adminLogout;

// ---- admin: add item (with edit support) ----
let addPhotos = [];
let editingId = null;
let editorMode = "admin";
let editorPublisherCode = "";
let editorLocation = null;

function renderAdminAdd(existing = null, options = {}) {
  const body = $("#admin-body");
  const mode = options.mode || "admin";
  const session = options.session || getActivePublisherSession();
  editorMode = mode;
  if (existing) {
    editingId = existing.id;
    addPhotos = Array.isArray(existing.photos) ? [...existing.photos] : [];
  } else {
    editingId = null;
    addPhotos = [];
  }
  const current = existing || {};
  editorLocation = {
    label: current.locationLabel || "",
    lat: typeof current.locationLat === "number" ? current.locationLat : null,
    lng: typeof current.locationLng === "number" ? current.locationLng : null,
    source: current.locationSource || "",
  };
  const isPublisherEditor = mode === "publisher" || current.ownerType === "publisher";
  editorPublisherCode = isPublisherEditor ? (mode === "publisher" ? ((session && session.code) || "") : (current.publisherCode || "")) : "";
  const ownerNameValue = current.publisherName || ((session && session.publisherName) || "");
  const ownerContactValue = current.publisherContact || ((session && session.publisherContact) || "");
  body.innerHTML = `
    <div style="max-width:720px;">
      ${editingId ? `<div style="margin-bottom:14px;font-size:.9rem;color:var(--accent-dark);">正在编辑：<b>${esc(current.title || "")}</b> <span style="margin-left:10px;color:var(--ink-3);cursor:pointer;text-decoration:underline;" onclick="cancelEdit()">取消编辑</span></div>` : ""}

      ${isPublisherEditor ? `
        <div class="queue-box" style="margin-bottom:18px;">
          <h3>发布者信息</h3>
          <div class="field" style="margin-bottom:12px;">
            <label>发布者称呼 *</label>
            <input type="text" id="f-owner-name" maxlength="30" value="${esc(ownerNameValue)}" placeholder="方便别人识别你的称呼" />
          </div>
          <div class="field" style="margin-bottom:12px;">
            <label>发布者联系方式 *</label>
            <input type="text" id="f-owner-contact" maxlength="80" value="${esc(ownerContactValue)}" placeholder="微信号 / email / 电话" />
          </div>
          <div class="queue-hint" style="padding:0;">
            序列码：<b>${esc(editorPublisherCode || "未设置")}</b>。发布者商品会在详情页展示这份联系方式，方便别人直接联系。
          </div>
        </div>
      ` : ""}

      <div class="upload-area" id="drop">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        <div class="big">点击或拖入图片</div>
        <div class="hint">最多 4 张 · 至少 1 张 · 第一张为封面 · 会自动压缩</div>
        <input type="file" id="file-in" accept="image/*" multiple style="display:none;" />
      </div>
      <div class="photo-previews" id="photo-previews"></div>

      <div style="margin-top:22px;display:grid;gap:14px;">
        <div class="field">
          <label>标题 *</label>
          <input type="text" id="f-title" maxlength="60" value="${esc(current.title || "")}" placeholder="比如：IKEA MALM 五斗柜 白色" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="field">
            <label>价格 ($)</label>
            <input type="number" id="f-price" min="0" step="1" value="${current.price != null ? current.price : ""}" placeholder="留空表示面议" />
          </div>
          <div class="field">
            <label>原价 ($) · 选填</label>
            <input type="number" id="f-original" min="0" step="1" value="${current.originalPrice || ""}" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="field">
            <label>类别</label>
            <select id="f-category">
              ${CATEGORIES.filter(c => c.id !== "all").map(c =>
                `<option value="${c.id}" ${current.category === c.id ? "selected" : ""}>${c.label}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label>成色</label>
            <select id="f-condition">
              ${CONDITIONS.map(c => `<option value="${c}" ${current.condition === c ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field">
          <label>状态</label>
          <select id="f-status">
            <option value="available" ${(!current.status || current.status === "available") ? "selected" : ""}>在售</option>
            <option value="reserved" ${current.status === "reserved" ? "selected" : ""}>洽谈中</option>
            <option value="sold" ${current.status === "sold" ? "selected" : ""}>已售出</option>
          </select>
        </div>
        <div class="field">
          <label>详细描述</label>
          <textarea id="f-desc" rows="6" placeholder="尺寸、购买时间、使用情况、是否可搬运、交易地点等…" maxlength="2000">${esc(current.description || "")}</textarea>
        </div>
        <div class="field">
          <label>大致位置 · 选填</label>
          <input type="text" id="f-location" maxlength="120" value="${esc(editorLocation.label || "")}" placeholder="例如：Downtown / University District" />
          <input type="hidden" id="f-location-lat" value="${editorLocation.lat != null ? esc(String(editorLocation.lat)) : ""}" />
          <input type="hidden" id="f-location-lng" value="${editorLocation.lng != null ? esc(String(editorLocation.lng)) : ""}" />
          <input type="hidden" id="f-location-source" value="${esc(editorLocation.source || "")}" />
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
            <button class="btn ghost small" type="button" id="f-use-location">获取我附近的大致位置</button>
            <button class="btn ghost small" type="button" id="f-clear-location">清除位置</button>
          </div>
          <div class="queue-hint" style="padding:0;margin-top:8px;">
            会尽量只保存大致区域，不建议填写精确门牌。要自动反查 Google 地图区域名，需在 index.html 配置 window.GOOGLE_MAPS_API_KEY。
          </div>
        </div>
        <div>
          <button class="btn accent" id="f-save">${editingId ? "保存修改" : (mode === "publisher" ? "发布这件闲置" : "上架这件物品")}</button>
          ${editingId ? `<button class="btn ghost" style="margin-left:8px;" onclick="cancelEdit()">取消</button>` : ""}
        </div>
      </div>
    </div>
  `;

  const drop = $("#drop");
  const fileIn = $("#file-in");
  drop.onclick = () => fileIn.click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("drag"); };
  drop.ondragleave = () => drop.classList.remove("drag");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    handleFiles(Array.from(e.dataTransfer.files));
  };
  fileIn.onchange = () => handleFiles(Array.from(fileIn.files));

  $("#f-save").onclick = doSaveItem;
  $("#f-use-location").onclick = requestApproxLocation;
  $("#f-clear-location").onclick = () => {
    editorLocation = { label: "", lat: null, lng: null, source: "" };
    fillLocationFields(editorLocation);
  };

  paintPreviews();
}

async function requestApproxLocation() {
  if (!navigator.geolocation) {
    toast("当前浏览器不支持定位", "err");
    return;
  }
  const btn = $("#f-use-location");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "定位中...";
  }
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      });
    });
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const rough = await reverseGeocodeApproxLocation(lat, lng).catch(() => ({
      label: fmtApproxCoords(lat, lng),
      source: "coords",
    }));
    editorLocation = {
      label: rough.label,
      lat,
      lng,
      source: rough.source,
    };
    fillLocationFields(editorLocation);
    toast(rough.source === "google" ? "已获取附近位置 ✓" : "已获取位置坐标，可手动改成更模糊的区域名");
  } catch (e) {
    console.error(e);
    toast("定位失败，请检查浏览器定位权限", "err");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "获取我附近的大致位置";
    }
  }
}

async function handleFiles(files) {
  files = files.filter(f => f.type.startsWith("image/"));
  const remaining = 4 - addPhotos.length;
  if (remaining <= 0) { toast("最多 4 张图", "err"); return; }
  files = files.slice(0, remaining);
  for (const f of files) {
    try {
      toast(`压缩中…（${files.indexOf(f) + 1}/${files.length}）`);
      const data = await compressImage(f);
      addPhotos.push(data);
      paintPreviews();
    } catch (e) { console.error(e); toast("图片处理失败", "err"); }
  }
  toast("图片就绪 ✓");
}

function paintPreviews() {
  const wrap = $("#photo-previews");
  if (!wrap) return;
  wrap.innerHTML = addPhotos.map((p, i) => `
    <div class="photo-preview">
      <img src="${p}" />
      ${i === 0 ? `<div class="cover-tag">封面</div>` : ""}
      <button class="remove" data-i="${i}">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6"/></svg>
      </button>
    </div>
  `).join("");
  $$(".photo-preview .remove", wrap).forEach(b => {
    b.onclick = () => { addPhotos.splice(Number(b.dataset.i), 1); paintPreviews(); };
  });
}

async function doSaveItem() {
  const title = $("#f-title").value.trim();
  if (!title) { toast("至少要填标题", "err"); return; }
  if (!addPhotos.length) { toast("至少上传 1 张图片", "err"); return; }
  const priceRaw = $("#f-price").value;
  const originalRaw = $("#f-original").value;
  const payload = {
    title,
    price: priceRaw === "" ? null : Number(priceRaw),
    originalPrice: originalRaw === "" ? null : Number(originalRaw),
    category: $("#f-category").value,
    condition: $("#f-condition").value,
    status: $("#f-status").value,
    description: $("#f-desc").value.trim(),
    photos: addPhotos,
  };
  const location = readLocationFields();
  payload.locationLabel = location.label || null;
  payload.locationLat = location.lat;
  payload.locationLng = location.lng;
  payload.locationSource = location.source || null;
  if (editorMode === "publisher" || editorPublisherCode || ($("#f-owner-name") && $("#f-owner-contact"))) {
    const publisherName = ($("#f-owner-name") && $("#f-owner-name").value.trim()) || "";
    const publisherContact = ($("#f-owner-contact") && $("#f-owner-contact").value.trim()) || "";
    if (!publisherName || !publisherContact) {
      toast("发布者必须填写称呼和联系方式", "err");
      return;
    }
    payload.ownerType = "publisher";
    payload.publisherCode = editorPublisherCode;
    payload.publisherName = publisherName;
    payload.publisherContact = publisherContact;
  } else {
    payload.ownerType = "admin";
    payload.publisherCode = null;
    payload.publisherName = null;
    payload.publisherContact = null;
  }
  const btn = $("#f-save");
  btn.disabled = true;
  btn.textContent = "保存中…";
  try {
    if (editingId) {
      await updateItem(editingId, payload);
      toast("已更新 ✓");
    } else {
      await addItem(payload);
      toast(editorMode === "publisher" ? "发布成功 ✓" : "上架成功 ✓");
      addPhotos = [];
    }
    editingId = null;
    if (editorMode === "publisher") {
      publisherTab = "items";
      renderPublisherDashboard();
    } else {
      adminTab = "items";
      renderAdminDashboard();
    }
  } catch (e) {
    console.error(e);
    toast("保存失败：" + (e.message || "未知错误"), "err");
    btn.disabled = false;
    btn.textContent = editingId ? "保存修改" : (editorMode === "publisher" ? "发布这件闲置" : "上架这件物品");
  }
}

function cancelEdit() {
  editingId = null;
  addPhotos = [];
  if (editorMode === "publisher") renderPublisherDashboard();
  else renderAdminAdd();
}
window.cancelEdit = cancelEdit;

// ---- admin: publisher codes ----
function renderAdminPublisherCodes() {
  const body = $("#admin-body");
  const codes = getPublisherCodes();
  const usingFallback = !state.publisherCodesLoaded;
  body.innerHTML = `
    <div style="max-width:860px;">
      <div class="queue-box" style="margin-bottom:18px;">
        <h3>新增序列码</h3>
        <div class="field" style="margin-bottom:12px;">
          <label>序列码 *</label>
          <input type="text" id="pc-code" placeholder="例如 EASY-SELL-003" maxlength="60" />
        </div>
        <div class="field" style="margin-bottom:12px;">
          <label>备注 / 指定对象</label>
          <input type="text" id="pc-label" placeholder="例如 张三 / 宿舍楼管理员 / 校友群第 2 批" maxlength="60" />
        </div>
        <button class="btn accent" id="pc-create">创建序列码</button>
        <div class="queue-hint" style="padding:0;margin-top:12px;">
          ${usingFallback
            ? "当前显示的是 index.html 里的默认序列码。你在这里新增后，后续会优先使用 Firestore 里的动态序列码列表。"
            : "这里的改动会实时写入 Firestore，发布者登录页会立即生效。"}
        </div>
      </div>

      <div class="admin-items">
        ${codes.length ? codes.map(code => {
          const usageCount = state.items.filter(item =>
            item.ownerType === "publisher" && normalizeCode(item.publisherCode) === normalizeCode(code.code)
          ).length;
          const statusText = code.enabled ? "启用中" : "已停用";
          const statusColor = code.enabled ? "var(--sage)" : "var(--accent-dark)";
          const canMutate = !String(code.id || "").startsWith("default-");
          return `
            <div class="admin-item" style="grid-template-columns:1fr auto;">
              <div class="admin-item-info">
                <div class="t">${esc(code.code)}</div>
                <div class="m">
                  <span style="color:${statusColor};">${statusText}</span>
                  <span>·</span>
                  <span>${usageCount} 件物品在用</span>
                  ${code.label ? `<span>·</span><span>${esc(code.label)}</span>` : ""}
                </div>
              </div>
              <div class="admin-item-actions">
                ${canMutate ? `
                  <button class="btn ghost small" data-code-toggle="${code.id}">
                    ${code.enabled ? "停用" : "启用"}
                  </button>
                  <button class="btn ghost small" data-code-edit="${code.id}">改备注</button>
                  <button class="btn ghost small" data-code-del="${code.id}" style="color:var(--accent-dark);">删除</button>
                ` : `
                  <span class="tiny" style="color:var(--ink-3);">默认码请改 index.html</span>
                `}
              </div>
            </div>
          `;
        }).join("") : `<div class="empty"><h3>还没有可用序列码</h3><p>先创建一个，再发给你验证过身份的发布者。</p></div>`}
      </div>
    </div>
  `;

  const createBtn = $("#pc-create");
  if (createBtn) {
    createBtn.onclick = async () => {
      const code = normalizeCode($("#pc-code").value);
      const label = $("#pc-label").value.trim();
      if (!code) { toast("请先填写序列码", "err"); return; }
      if (getPublisherCodes().some(entry => normalizeCode(entry.code) === code)) {
        toast("这个序列码已经存在了", "err");
        return;
      }
      createBtn.disabled = true;
      createBtn.textContent = "创建中...";
      try {
        await addPublisherCode({ code, label, enabled: true });
        $("#pc-code").value = "";
        $("#pc-label").value = "";
        toast("序列码已创建 ✓");
      } catch (e) {
        console.error(e);
        toast("创建失败", "err");
        createBtn.disabled = false;
        createBtn.textContent = "创建序列码";
      }
    };
  }

  $$("[data-code-toggle]").forEach(btn => {
    btn.onclick = async () => {
      const current = codes.find(code => code.id === btn.dataset.codeToggle);
      if (!current) return;
      try {
        await updatePublisherCode(current.id, { enabled: !current.enabled });
        toast(current.enabled ? "序列码已停用" : "序列码已启用");
      } catch (e) {
        console.error(e);
        toast("操作失败", "err");
      }
    };
  });

  $$("[data-code-edit]").forEach(btn => {
    btn.onclick = async () => {
      const current = codes.find(code => code.id === btn.dataset.codeEdit);
      if (!current) return;
      const nextLabel = prompt("修改这个序列码的备注", current.label || "");
      if (nextLabel === null) return;
      try {
        await updatePublisherCode(current.id, { label: nextLabel });
        toast("备注已更新");
      } catch (e) {
        console.error(e);
        toast("更新失败", "err");
      }
    };
  });

  $$("[data-code-del]").forEach(btn => {
    btn.onclick = async () => {
      const current = codes.find(code => code.id === btn.dataset.codeDel);
      if (!current) return;
      const usageCount = state.items.filter(item =>
        item.ownerType === "publisher" && normalizeCode(item.publisherCode) === normalizeCode(current.code)
      ).length;
      const message = usageCount > 0
        ? `这个序列码下还有 ${usageCount} 件已发布物品。删除后这些旧物品仍会保留，但不能再用这个码登录。确定删除吗？`
        : "确定删除这个序列码吗？";
      if (!confirm(message)) return;
      try {
        await deletePublisherCode(current.id);
        toast("序列码已删除");
      } catch (e) {
        console.error(e);
        toast("删除失败", "err");
      }
    };
  });
}

// ---- admin: items list ----
function renderAdminItems() {
  const body = $("#admin-body");
  if (!state.items.length) {
    body.innerHTML = `<div class="empty"><h3>还没上架任何物品</h3><p>去 "+ 新上架" 页添加你的第一件物品。</p></div>`;
    return;
  }
  body.innerHTML = `<div class="admin-items">${state.items.map(item => {
    const cover = (item.photos && item.photos[0]) || "";
    return `
      <div class="admin-item">
        <div class="admin-item-thumb">${cover ? `<img src="${cover}" />` : ""}</div>
        <div class="admin-item-info">
          <div class="t">${esc(item.title)}</div>
          <div class="m">
            <span>$${fmtPrice(item.price)}</span>
            <span>·</span>
            <span>${STATUS_LABEL[item.status] || "在售"}</span>
            ${item.queueCount ? `<span>·</span><span>${item.queueCount} 人排队</span>` : ""}
          </div>
        </div>
        <div class="admin-item-actions">
          <button class="btn ghost small" onclick="navigate('/item/${item.id}')">查看</button>
          <button class="btn ghost small" data-edit="${item.id}">编辑</button>
          <button class="btn ghost small" data-del="${item.id}" style="color:var(--accent-dark);">删除</button>
        </div>
      </div>
    `;
  }).join("")}</div>`;
  $$("[data-edit]").forEach(b => {
    b.onclick = () => {
      const item = state.items.find(i => i.id === b.dataset.edit);
      adminTab = "add";
      renderAdminDashboard();
      setTimeout(() => renderAdminAdd(item), 10);
    };
  });
  $$("[data-del]").forEach(b => {
    b.onclick = async () => {
      if (!confirm("确定删除这件物品？所有留言和排队记录也会一起删除。")) return;
      try {
        await deleteItem(b.dataset.del);
        toast("已删除");
      } catch (e) { toast("删除失败", "err"); }
    };
  });
}

// ---- admin: queue management ----
async function renderAdminQueue() {
  const body = $("#admin-body");
  const itemsWithQueue = state.items.filter(i => i.status !== "sold");
  if (!itemsWithQueue.length) {
    body.innerHTML = `<div class="empty"><h3>暂无在售物品</h3></div>`;
    return;
  }
  body.innerHTML = `<div id="queue-admin-list"></div>`;
  const listEl = $("#queue-admin-list");

  // for each in-sale item, load queue
  for (const item of itemsWithQueue) {
    const card = el(`<div class="admin-queue-box" data-item="${item.id}">
      <h3>
        <span>${esc(item.title)}</span>
        <span style="font-size:.75rem;color:var(--ink-3);font-weight:400;">$${fmtPrice(item.price)} · ${STATUS_LABEL[item.status]}</span>
        <button class="btn ghost small" style="margin-left:auto;" onclick="navigate('/item/${item.id}')">查看页面</button>
      </h3>
      <div class="admin-queue-list" id="aq-${item.id}">加载中…</div>
    </div>`);
    listEl.appendChild(card);

    const unsub = db.collection("items").doc(item.id).collection("queue")
      .orderBy("joinedAt", "asc")
      .onSnapshot(snap => {
        const queue = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        paintAdminQueue(item.id, queue);
      });
    currentItemUnsubs.push(unsub);
  }
}

function paintAdminQueue(itemId, queue) {
  const box = $("#aq-" + itemId);
  if (!box) return;
  const active = queue.filter(q => q.status !== "removed" && q.status !== "passed");
  if (!active.length) {
    box.innerHTML = `<div style="color:var(--ink-3);font-style:italic;font-size:.9rem;padding:6px 0;">还没人排队。</div>`;
    return;
  }
  box.innerHTML = active.map((q, i) => {
    const isActive = q.status === "active";
    return `
      <div class="admin-queue-row ${isActive ? 'active' : ''}">
        <span class="q-num">${isActive ? "洽" : i + 1}</span>
        <div>
          <b>${esc(q.name)}</b>
          <span class="meta">${esc(q.contact || "")}</span>
          ${q.note ? `<div style="font-size:.78rem;opacity:.7;margin-top:2px;">"${esc(q.note)}"</div>` : ""}
          <div style="font-size:.72rem;opacity:.6;margin-top:2px;font-family:var(--font-mono);">${fmtTime(q.joinedAt)}</div>
        </div>
        <div class="actions">
          ${isActive
            ? `<button class="mini-btn" data-act="sold" data-qid="${q.id}" data-item="${itemId}">✓ 成交</button>
               <button class="mini-btn" data-act="pass" data-qid="${q.id}" data-item="${itemId}">跳过</button>`
            : `<button class="mini-btn" data-act="activate" data-qid="${q.id}" data-item="${itemId}">联系 →</button>
               <button class="mini-btn" data-act="remove" data-qid="${q.id}" data-item="${itemId}">移除</button>`
          }
        </div>
      </div>
    `;
  }).join("");
  $$("[data-act]", box).forEach(b => {
    b.onclick = () => handleQueueAction(b.dataset.item, b.dataset.qid, b.dataset.act);
  });
}

async function handleQueueAction(itemId, qid, action) {
  const ref = db.collection("items").doc(itemId).collection("queue").doc(qid);
  try {
    if (action === "activate") {
      // set this one active, set others from active back to waiting
      const snap = await db.collection("items").doc(itemId).collection("queue").where("status", "==", "active").get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { status: "waiting" }));
      batch.update(ref, { status: "active" });
      await batch.commit();
      await updateItem(itemId, { status: "reserved" });
      toast("已标记洽谈中");
    } else if (action === "pass") {
      await ref.update({ status: "passed" });
      await updateItem(itemId, { status: "available" });
      toast("已跳过，恢复在售");
    } else if (action === "remove") {
      await ref.update({ status: "removed" });
      toast("已移出队列");
    } else if (action === "sold") {
      await ref.update({ status: "sold" });
      await updateItem(itemId, { status: "sold" });
      toast("成交！🎉");
    }
  } catch (e) {
    console.error(e);
    toast("操作失败", "err");
  }
}

// ==========================================================
// VIEW: not found
// ==========================================================
function renderNotFound() {
  $("#view").innerHTML = `
    <div class="container" style="padding:80px 0;text-align:center;">
      <h1 style="font-size:5rem;font-style:italic;color:var(--accent);">404</h1>
      <p style="margin:16px 0;color:var(--ink-2);">这里什么都没有。</p>
      <button class="btn" onclick="navigate('/')">回到首页</button>
    </div>
  `;
}

// ==========================================================
// routes registration
// ==========================================================
route(/^\/$/, async () => {
  if (!CONFIGURED) { renderSetup(); return; }
  watchItems();
  renderHome();
});
route(/^\/item\/(.+)$/, async (m) => {
  if (!CONFIGURED) { renderSetup(); return; }
  watchItems();
  await renderItemDetail(m[1]);
});
route(/^\/admin$/, async () => {
  if (!CONFIGURED) { renderSetup(); return; }
  watchItems();
  renderAdmin();
});
route(/^\/publish$/, async () => {
  if (!CONFIGURED) { renderSetup(); return; }
  watchItems();
  renderPublisher();
});

// ==========================================================
// boot
// ==========================================================
setupRefreshDock();
runRouter();
