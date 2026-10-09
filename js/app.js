import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  initAuth,
  googleLogin,
  emailSignup,
  emailLogin,
  logout,
  currentUser,
} from "./auth.js";
import {
  listenDeals,
  postDeal,
  upvote,
  flagExpired,
  removeDeal,
  submitRating,
  didVote,
  didFlag,
  myRating,
} from "./deals.js";
import {
  detectGPS,
  searchArea,
  getLocation,
  setLocation,
  loadSavedLocation,
} from "./location.js";
import {
  showToast,
  openModal,
  closeModal,
  closeAllModals,
  timeAgo,
  fmt,
  savePct,
  starsHtml,
  copyText,
  setEl,
  escH,
  escJ,
  CATS,
  PLATFORMS,
  PLAT_COLORS,
} from "./ui.js";

// ── State ─────────────────────────────────────────
const S = {
  deals: [],
  filtered: [],
  user: null,
  cat: "all",
  sort: "score",
  filterType: "all", // 'all', 'community', 'telegram_scraped', 'saved'
  search: "",
  postRating: 0, // star selection in post form
  savedDeals: new Set(),
  openaiKey: null,
};

// ── Config Driven Renderers ────────────────────────
function renderConfigDrivenUI() {
  // Category filter chips
  const catRow = document.getElementById("cat-chips-row");
  if (catRow) {
    catRow.innerHTML = `
      <div class="cat-chip active" data-cat="all">🌟 All</div>
      ${Object.entries(CATS).map(([key, cat]) => `
        <div class="cat-chip" data-cat="${key}">${cat.emoji} ${cat.label}</div>
      `).join("")}
    `;
  }

  // Post modal category picker
  const postCatPick = document.getElementById("catPicker");
  if (postCatPick) {
    postCatPick.innerHTML = Object.entries(CATS).map(([key, cat], i) => `
      <button type="button" class="cat-chip ${i === 0 ? "active" : ""}" data-cat="${key}">
        ${cat.emoji} ${cat.label}
      </button>
    `).join("");
    const hiddenCat = document.getElementById("f-category");
    if (hiddenCat && Object.keys(CATS).length > 0) {
      hiddenCat.value = Object.keys(CATS)[0];
    }
  }

  // Advanced filter platform checkboxes
  const platGrid = document.getElementById("filter-platform-grid");
  if (platGrid) {
    platGrid.innerHTML = PLATFORMS.map((plat) => {
      const color = PLAT_COLORS[plat] || "#64748b";
      const label = plat === "Store (Offline)" ? "Offline" : plat;
      return `
        <div class="plat-check" data-plat="${plat}">
          <div class="plat-dot" style="background:${color}"></div>
          ${label}
        </div>
      `;
    }).join("");
  }

  // Post modal platform dropdown options
  const pdPlatform = document.getElementById("pd-platform");
  if (pdPlatform) {
    pdPlatform.innerHTML = PLATFORMS.map((plat) => `
      <option value="${plat}">${plat}</option>
    `).join("");
  }
}

// ── Boot ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  console.log("DealHunt app bootstrap starting...");
  try { renderConfigDrivenUI(); } catch (e) { console.error("Error in renderConfigDrivenUI:", e); }
  try { hydrateUiPrefs(); } catch (e) { console.error("Error in hydrateUiPrefs:", e); }
  try {
    initAuth((u, profile) => {
      S.user = u;
      S.userProfile = profile;
      
      const openAdmin = document.getElementById("openAdmin");
      if (openAdmin) {
        openAdmin.style.display = (profile && profile.role === "admin") ? "inline-block" : "none";
      }
      const mobAdmin = document.getElementById("mob-admin");
      if (mobAdmin) {
        mobAdmin.style.display = (profile && profile.role === "admin") ? "flex" : "none";
      }

      const btnSignin = document.getElementById("btn-signin");
      const userMenu = document.getElementById("user-menu");
      const uName = document.getElementById("u-name");
      const uAvatar = document.getElementById("u-avatar");
      
      if (u) {
        if (btnSignin) btnSignin.style.display = "none";
        if (userMenu) userMenu.style.display = "flex";
        const displayName = u.displayName || u.email.split("@")[0];
        if (uName) uName.textContent = displayName;
        if (uAvatar) {
          const initial = displayName.slice(0, 1).toUpperCase();
          uAvatar.innerHTML = u.photoURL 
            ? `<img src="${u.photoURL}" alt="" style="width:100%;height:100%;object-fit:cover;"/>` 
            : `<span>${initial}</span>`;
        }
      } else {
        if (btnSignin) btnSignin.style.display = "flex";
        if (userMenu) userMenu.style.display = "none";
      }
    });
  } catch (e) {
    console.error("Error in initAuth:", e);
  }
  try {
    listenDeals((deals) => {
      S.deals = deals;
      applyAll();
    });
  } catch (e) {
    console.error("Error in listenDeals:", e);
  }
  try { restoreLocation(); } catch (e) { console.error("Error in restoreLocation:", e); }
  try { wireNav(); } catch (e) { console.error("Error in wireNav:", e); }
  try { wireCategoryChips(); } catch (e) { console.error("Error in wireCategoryChips:", e); }
  try { wireFilters(); } catch (e) { console.error("Error in wireFilters:", e); }
  try { wireAuthModal(); } catch (e) { console.error("Error in wireAuthModal:", e); }
  try { wirePostModal(); } catch (e) { console.error("Error in wirePostModal:", e); }
  try { wireLocationModal(); } catch (e) { console.error("Error in wireLocationModal:", e); }
  try { wireSearch(); } catch (e) { console.error("Error in wireSearch:", e); }
  try { wireMobileNav(); } catch (e) { console.error("Error in wireMobileNav:", e); }
  try { wireChatBot(); } catch (e) { console.error("Error in wireChatBot:", e); }
});

// ── Location restore ──────────────────────────────
function restoreLocation() {
  const loc = loadSavedLocation();
  if (loc) handleLocationChange(loc, false);
}

function hydrateUiPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem("dh_saved_deals") || "[]");
    if (Array.isArray(saved)) S.savedDeals = new Set(saved);
    const theme = localStorage.getItem("dealhunt-theme") || "day";
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "night" ? "☀️" : "🌙";
  } catch (e) {}
}

// ── Filter engine ─────────────────────────────────
function applyAll() {
  let d = [...S.deals];

  if (S.cat !== "all") d = d.filter((x) => x.category === S.cat);

  if (S.search) {
    const q = S.search.toLowerCase();
    d = d.filter(
      (x) =>
        (x.title || "").toLowerCase().includes(q) ||
        (x.store || "").toLowerCase().includes(q) ||
        (x.platform || "").toLowerCase().includes(q) ||
        (x.area || "").toLowerCase().includes(q) ||
        (x.coupon || "").toLowerCase().includes(q)
    );
  }

  // Filter type: community, scraped, saved
  if (S.filterType === "community") {
    d = d.filter((x) => x.sourceType !== "telegram_scraped");
  } else if (S.filterType === "telegram_scraped") {
    d = d.filter((x) => x.sourceType === "telegram_scraped");
  } else if (S.filterType === "saved") {
    d = d.filter((x) => S.savedDeals.has(x.id));
  }

  // Sort
  switch (S.sort) {
    case "savings":
      d.sort(
        (a, b) =>
          (savePct(b.originalPrice, b.finalPrice) || b.discountPercent || 0) -
          (savePct(a.originalPrice, a.finalPrice) || a.discountPercent || 0)
      );
      break;
    case "priceLow":
      d.sort(
        (a, b) =>
          (a.finalPrice || 0) +
          (a.gst || 0) -
          ((b.finalPrice || 0) + (b.gst || 0))
      );
      break;
    case "priceHigh":
      d.sort(
        (a, b) =>
          (b.finalPrice || 0) +
          (b.gst || 0) -
          ((a.finalPrice || 0) + (a.gst || 0))
      );
      break;
    case "ratings":
      d.sort((a, b) => avgRating(b) - avgRating(a));
      break;
    case "nearest": {
      const loc = getLocation();
      if (loc?.lat) d.sort((a, b) => dist(a, loc) - dist(b, loc));
      break;
    }
    default:
      // score
      d.sort((a, b) => calculateDynamicScore(b) - calculateDynamicScore(a));
  }

  S.filtered = d;
  renderDeals(d);
  renderSpotlight();
}

function calculateDynamicScore(d) {
  const pct = savePct(d.originalPrice, d.finalPrice) || 0;
  const votes = d.votes || 0;
  const avgStars = d.ratingCount ? (d.ratingSum / d.ratingCount) : 0;
  const trust = d.sourceType === "telegram_scraped" ? 20 : 10;
  const flags = d.flagCount || 0;
  
  let score = pct + (votes * 5) + (avgStars * 10) + trust - (flags * 15);
  
  // Freshness Decay (2.5 points per hour)
  const hours = (Date.now() - (d._ts || Date.now())) / 3600000;
  score -= hours * 2.5;
  
  return score;
}

function avgRating(d) {
  return d.ratingCount ? d.ratingSum / d.ratingCount : 0;
}
function dist(d, loc) {
  if (!d.lat || !d.lon) return 9999;
  return Math.hypot(d.lat - loc.lat, d.lon - loc.lon);
}

function renderDeals(deals) {
  const list = document.getElementById("feed");
  const cnt = document.getElementById("feed-count");
  if (!list) return;
  cnt && (cnt.textContent = `(${deals.length})`);

  if (!deals.length) {
    list.innerHTML = `
      <div class="empty-wrap" style="grid-column: 1 / -1; width: 100%;">
        <div class="empty-ico">🔍</div>
        <h3>No deals found</h3>
        <p>Try adjusting your filters,<br>or be the first to share a deal!</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="window._openPost()">+ Post a Deal</button>
      </div>`;
    return;
  }
  list.innerHTML = deals.map(card).join("");
}

function card(d) {
  const cat = CATS[d.category] || CATS.other;
  const save = (d.originalPrice || 0) - (d.finalPrice || 0);
  const pct = savePct(d.originalPrice, d.finalPrice) || d.discountPercent || 0;
  const total = (d.finalPrice || 0) + (d.gst || 0);
  const voted = didVote(d.id);
  const flagged = didFlag(d.id);
  const rated = myRating(d.id);
  const isOwn = S.user && S.user.uid === d.userId;
  const isHot = (d.votes || 0) >= 8;
  const isNew = Date.now() - (d._ts || 0) < 3 * 3600000;
  const avg = avgRating(d);
  const verified = (d.votes || 0) >= 5;
  const saved = S.savedDeals.has(d.id);

  const isScraped = d.sourceType === "telegram_scraped";
  const sourceTag = isScraped
    ? '<span class="badge badge-auto">⚡ Auto Found</span>'
    : '<span class="badge badge-community">👥 Community</span>';

  const hasPrice = total > 0;
  const displayPrice = hasPrice ? fmt(total) : (d.discountPercent ? `${d.discountPercent}% OFF` : "Discount Link");
  
  let badges = sourceTag;
  if (isHot) badges += ' <span class="badge badge-hot">🔥 HOT</span>';
  if (isNew && !isHot) badges += ' <span class="badge badge-new">✨ New</span>';
  if (verified) badges += ' <span class="badge badge-verified">✓ Verified</span>';

  const score = calculateDynamicScore(d);
  const barcodeHTML = (score) => {
    const totalBars = 14;
    const filled = Math.max(1, Math.min(totalBars, Math.round((score / 220) * totalBars)));
    let html = "";
    for (let i = 0; i < totalBars; i++) {
      const h = 6 + (i % 4) * 3;
      html += `<i class="${i < filled ? "filled" : ""}" style="height:${h}px"></i>`;
    }
    return html;
  };

  const hoursAgo = (Date.now() - (d._ts || Date.now())) / 3600000;
  const timeLabel = hoursAgo < 1 ? Math.round(hoursAgo * 60) + 'm ago' : (hoursAgo < 24 ? Math.round(hoursAgo) + 'h ago' : Math.round(hoursAgo / 24) + 'd ago');

  const loc = getLocation();
  const dVal = (loc?.lat && d.lat && d.lon) ? dist(d, loc) : null;
  const dKm = dVal !== null ? dVal * 111 : null;
  const distLabel = dKm !== null ? ` · ${dKm.toFixed(1)} km away` : "";

  return `
  <article class="deal-card" data-cat="${d.category}" data-id="${d.id}" style="cursor: pointer;" onclick="window._openComments(event,'${d.id}')">
    <div class="perforation"></div>
    <div class="tag-punch">-${pct}%</div>
    <div class="card-top" onclick="event.stopPropagation()">
      <div class="badge-row">${badges}</div>
      <span class="time-chip">${timeLabel}</span>
    </div>
    <div class="card-body">
      <span class="tag-cat">${cat.emoji} ${cat.label}</span>
      <h3 class="deal-title">${escH(d.title)}</h3>
      <p class="deal-store">${escH(d.store)} · ${escH(d.platform)}</p>
      <p class="deal-loc">📍 ${escH(d.area || "Online")}${distLabel}</p>
      
      ${d.imageUrl ? `
      <div class="card-img-wrap" style="margin: 6px 0 10px 0; border-radius: var(--radius); overflow: hidden; max-height: 180px; display: flex; align-items: center; justify-content: center; background: var(--paper);">
        <img src="${escH(d.imageUrl)}" alt="${escH(d.title)}" style="width: 100%; height: 180px; object-fit: cover;" />
      </div>` : ""}

      ${hasPrice ? `
      <div class="price-row">
        <span class="price-final">${displayPrice}</span>
        ${d.originalPrice ? `<span class="price-orig">${fmt(d.originalPrice)}</span>` : ""}
      </div>
      ${d.gst ? `<div class="price-fee">Incl. ₹${d.gst} GST/fees</div>` : ""}
      ` : `
      <span class="price-pctonly">-${pct}% <small>exact price not listed yet</small></span>
      `}

      ${d.coupon ? `
      <div class="coupon-chip" onclick="window._copyCoupon(event,'${escJ(d.coupon)}')" style="margin-top: 6px; cursor: pointer;">
        <span class="copy-icon">📋 ${escH(d.coupon)}</span>
        <span class="copy-flag">✓ Copied!</span>
      </div>` : ""}
    </div>
    
    <div class="score-meter" onclick="event.stopPropagation()">
      <div class="barcode">${barcodeHTML(score)}</div>
      <span class="score-num">score <b>${Math.round(score)}</b></span>
    </div>

    ${d.productLink ? `
    <button class="affiliate-btn" onclick="window.open('${escJ(d.productLink)}', '_blank'); event.stopPropagation();" style="margin: 10px 14px 0;">
      🌐 Open Deal Link ↗
    </button>` : ""}

    <div class="card-footer" onclick="event.stopPropagation()">
      <span class="stars-static">★ ${avg > 0 ? avg.toFixed(1) : "0.0"}</span>
      <button class="vote-btn ${voted ? "voted" : ""}" onclick="window._vote(event,'${d.id}')">▲ ${d.votes || 0}</button>
      <button class="comment-btn" onclick="window._openComments(event,'${d.id}')">💬 ${d.comments || 0}</button>
      <button class="flag-btn ${flagged ? "flagged" : ""}" onclick="window._flag(event,'${d.id}')">🚩</button>
      <button class="bookmark-btn ${saved ? "saved" : ""}" onclick="window._saveDeal(event,'${d.id}')">${saved ? "🔖" : "📑"}</button>
      ${isOwn ? `<button class="flag-btn" onclick="window._del(event,'${d.id}')" title="Delete" style="border-color:transparent;">🗑</button>` : ""}
    </div>
  </article>`;
}

function renderSpotlight() {
  const heroCard = document.getElementById("heroCard");
  const statsStrip = document.getElementById("statsStrip");
  if (!heroCard || !S.filtered.length) {
    if (heroCard) {
      heroCard.innerHTML = `
        <div class="empty-state">
          <span class="display">No matching deals today</span>
          Try shifting your filters to see the Deal of the Day.
        </div>`;
    }
    return;
  }

  const top = [...S.filtered].sort((a, b) => calculateDynamicScore(b) - calculateDynamicScore(a))[0];
  const score = calculateDynamicScore(top);
  const cat = CATS[top.category] || CATS.other;
  const save = (top.originalPrice || 0) - (top.finalPrice || 0);
  const pct = savePct(top.originalPrice, top.finalPrice) || top.discountPercent || 0;
  const total = (top.finalPrice || 0) + (top.gst || 0);
  const isScraped = top.sourceType === "telegram_scraped";
  const sourceTag = isScraped
    ? '<span class="badge badge-auto">⚡ Auto Found</span>'
    : '<span class="badge badge-community">👥 Community</span>';
  const isHot = (top.votes || 0) >= 8;
  const isNew = Date.now() - (top._ts || 0) < 3 * 3600000;
  const verified = (top.votes || 0) >= 5;

  const displayPrice = total > 0 ? fmt(total) : (top.discountPercent ? `${top.discountPercent}% OFF` : "Discount Link");
  
  let badges = sourceTag;
  if (isHot) badges += ' <span class="badge badge-hot">🔥 HOT</span>';
  if (isNew && !isHot) badges += ' <span class="badge badge-new">✨ New</span>';
  if (verified) badges += ' <span class="badge badge-verified">✓ Verified</span>';

  heroCard.innerHTML = `
    <div class="ribbon">VERIFIED</div>
    <div class="hero-icon">${cat.emoji}</div>
    <div class="hero-body">
      <div class="badge-row">${badges}</div>
      <h2 class="hero-title">${escH(top.title)}</h2>
      <p class="hero-store">${escH(top.store)} · ${escH(top.platform)} · 📍 ${escH(top.area || "Online")} · ${timeAgo(top._ts)}</p>
      <div class="hero-price-row">
        <span class="hero-final">${displayPrice}</span>
        ${top.originalPrice && total > 0 ? `<span class="hero-orig">${fmt(top.originalPrice)}</span>` : ""}
      </div>
    </div>
    <div class="hero-meta">
      <div class="hero-discount">-${pct}%</div>
      <div class="hero-score">AI score <b>${Math.round(score)}</b></div>
    </div>`;
  heroCard.onclick = () => window._openComments(null, top.id);

  if (statsStrip) {
    const totalDeals = S.deals.length;
    const avgDiscount = totalDeals > 0 
      ? Math.round(S.deals.reduce((s, d) => s + (savePct(d.originalPrice, d.finalPrice) || d.discountPercent || 0), 0) / totalDeals)
      : 0;
    const cities = new Set(S.deals.map(d => (d.area || "").split(",").pop().trim()).filter(Boolean)).size;
    statsStrip.innerHTML = `
      <div class="stat-cell"><span class="stat-num">${totalDeals}</span><span class="stat-label">Live deals today</span></div>
      <div class="stat-cell"><span class="stat-num">${avgDiscount}%</span><span class="stat-label">Avg. savings</span></div>
      <div class="stat-cell"><span class="stat-num">${cities}</span><span class="stat-label">Locations covered</span></div>
      <div class="stat-cell"><span class="stat-num">3</span><span class="stat-label">Channels monitored</span></div>`;
  }
}

function renderSidebar() {
  // Sidebar not present in Neobrutalist design
}

// ── Nav ───────────────────────────────────────────
function wireNav() {
  document
    .getElementById("btn-signin")
    ?.addEventListener("click", () => openModal("auth-modal"));
  
  // Theme toggle
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const html = document.documentElement;
    const theme = html.getAttribute("data-theme") === "night" ? "day" : "night";
    html.setAttribute("data-theme", theme);
    localStorage.setItem("dealhunt-theme", theme);
    document.getElementById("themeToggle").textContent = theme === "night" ? "☀️" : "🌙";
  });

  // Admin button clicks
  document.getElementById("openAdmin")?.addEventListener("click", () => {
    openModal("adminModalOverlay");
    loadAdminDashboard();
  });

  // User profile click -> logout confirmation
  document.getElementById("userPill")?.addEventListener("click", () => {
    if (confirm("Do you want to Sign Out?")) {
      logout();
      showToast("Signed out successfully 👋");
    }
  });

  // Share deal Fab
  document.getElementById("shareFab")?.addEventListener("click", openPost);

  // Close overlays on bg click
  document.querySelectorAll(".modal-overlay").forEach((o) =>
    o.addEventListener("click", (e) => {
      if (e.target === o) closeModal(o.id);
    })
  );
  
  // Close buttons
  document.querySelectorAll(".modal-close, [data-close]").forEach((b) => {
    b.addEventListener("click", () => {
      const targetId = b.getAttribute("data-close") || b.closest(".modal-overlay")?.id;
      if (targetId) closeModal(targetId);
    });
  });
}

// ── Category chips ────────────────────────────────
function wireCategoryChips() {
  // Category chips not present on home feed in Neobrutalist design
}

function wireFilters() {
  document.getElementById("sortSelect")?.addEventListener("change", (e) => {
    S.sort = e.target.value;
    applyAll();
  });
  
  document.getElementById("sourceFilter")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    S.filterType = btn.dataset.filter;
    document.querySelectorAll("#sourceFilter button").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    applyAll();
  });

  window._syncSavedBtn = () => {
    // No-op for legacy support
  };
}

// ── Auth Modal ────────────────────────────────────
function wireAuthModal() {
  document.querySelectorAll(".mtab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".mtab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document
        .querySelectorAll(".auth-panel")
        .forEach((p) => p.classList.remove("active"));
      document
        .getElementById("panel-" + tab.dataset.tab)
        ?.classList.add("active");

      // Dynamic text update for email separator
      const sep = document.getElementById("auth-sep-text");
      if (sep) {
        sep.textContent = tab.dataset.tab === "signin"
          ? "or sign in with email"
          : "or create with email";
      }
    });
  });

  // Google Sign-In (Unified button)
  document
    .getElementById("btn-google-auth")
    ?.addEventListener("click", async () => {
      const u = await googleLogin();
      if (u) closeModal("auth-modal");
    });

  // Email signup
  document
    .getElementById("form-signup")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("signup-btn");
      btn.disabled = true;
      btn.textContent = "Creating...";
      const u = await emailSignup(
        document.getElementById("su-name").value.trim(),
        document.getElementById("su-email").value.trim(),
        document.getElementById("su-pass").value
      );
      btn.disabled = false;
      btn.textContent = "Create Account";
      if (u) closeModal("auth-modal");
    });

  // Email signin
  document
    .getElementById("form-signin")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("signin-btn");
      btn.disabled = true;
      btn.textContent = "Signing in...";
      const u = await emailLogin(
        document.getElementById("si-email").value.trim(),
        document.getElementById("si-pass").value
      );
      btn.disabled = false;
      btn.textContent = "Sign In";
      if (u) closeModal("auth-modal");
    });
}

// ── Post Deal Modal ───────────────────────────────
function wirePostModal() {
  // Category picker clicks
  document.getElementById("catPicker")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".cat-chip");
    if (!chip) return;
    document.querySelectorAll(".cat-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const hiddenCat = document.getElementById("f-category");
    if (hiddenCat) hiddenCat.value = chip.dataset.cat;
  });

  // Location autocomplete
  setupAutocomplete({
    inputId: "f-location",
    resultsId: "pd-loc-box",
    onSelect: (loc) => {
      const i = document.getElementById("f-location");
      if (i) i.value = loc.display;
      window._pdLat = loc.lat;
      window._pdLon = loc.lon;
    }
  });

  // Price → savings preview
  ["f-original", "f-final", "f-fees"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateSavingsBox);
  });

  // GPS detect in post form
  document.getElementById("pd-detect-loc")?.addEventListener("click", () => {
    const btn = document.getElementById("pd-detect-loc");
    runGPSDetection(btn, null, "Detecting...", "📍 Detect", "📍 Detected", (loc) => {
      const locInput = document.getElementById("f-location");
      if (locInput) locInput.value = loc.area;
      window._pdLat = loc.lat;
      window._pdLon = loc.lon;
    });
  });

  // Star rating in post form
  const starRow = document.getElementById("formStars");
  if (starRow) {
    starRow.querySelectorAll("span").forEach((star, i) => {
      star.addEventListener("click", () => {
        S.postRating = i + 1;
        highlightStars(starRow, i + 1);
      });
      star.addEventListener("mouseover", () => highlightStars(starRow, i + 1));
      star.addEventListener("mouseout", () =>
        highlightStars(starRow, S.postRating)
      );
    });
  }

  // Submit
  document
    .getElementById("shareForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!S.user) {
        openModal("auth-modal");
        showToast("Sign in to post a deal 👋");
        return;
      }

      const catVal = document.getElementById("f-category")?.value;
      const orig = parseFloat(document.getElementById("f-original")?.value);
      const final = parseFloat(document.getElementById("f-final")?.value);
      const area = document.getElementById("f-location")?.value.trim();
      const title = document.getElementById("f-title")?.value.trim();
      const store = document.getElementById("f-store")?.value.trim();

      if (!title || !store || !orig || !final || !area) {
        showToast("❌ Fill in all required fields!");
        return;
      }
      if (final >= orig) {
        showToast("❌ Final price must be lower than original!");
        return;
      }

      const btn = document.getElementById("btn-post-submit");
      btn.disabled = true;
      btn.textContent = "Posting...";
      try {
        const ref = await postDeal(
          {
            title,
            store,
            platform: document.getElementById("f-platform")?.value,
            category: catVal || "other",
            originalPrice: orig,
            finalPrice: final,
            coupon: (document.getElementById("f-coupon")?.value || "")
              .trim()
              .toUpperCase(),
            gst: parseFloat(document.getElementById("f-fees")?.value) || 0,
            area,
            productLink: document.getElementById("f-url")?.value.trim() || "",
            tips: document.getElementById("f-tips")?.value.trim() || "",
            lat: window._pdLat || getLocation()?.lat || null,
            lon: window._pdLon || getLocation()?.lon || null,
            selfRating: S.postRating || 0,
          },
          S.user
        );

        // Self-rate if they picked stars
        if (S.postRating && ref) {
          const { submitRating: sr } = await import("./deals.js");
          await sr(ref.id, S.postRating);
        }

        showToast("🎉 Deal posted! You just helped the community!");
        closeModal("shareModalOverlay");
        document.getElementById("shareForm")?.reset();
        document.querySelector(".cat-chip")?.click();
        document.getElementById("savingsPreview").style.display = "none";
        S.postRating = 0;
        if (starRow) highlightStars(starRow, 0);
      } catch (err) {
        showToast("❌ Failed to post. Please try again.");
        console.error(err);
      }
      btn.disabled = false;
      btn.textContent = "Post deal";
    });
}

function updateSavingsBox() {
  const orig = parseFloat(document.getElementById("f-original")?.value) || 0;
  const final = parseFloat(document.getElementById("f-final")?.value) || 0;
  const box = document.getElementById("savingsPreview");
  if (!box) return;
  if (orig > 0 && final > 0 && final < orig) {
    const save = orig - final,
      pct = Math.round((save / orig) * 100);
    box.style.display = "block";
    setEl("savingsAmt", "Save " + fmt(save));
    setEl("savingsPct", `↓ ${pct}% off`);
  } else box.style.display = "none";
}

function highlightStars(row, n) {
  row.querySelectorAll("span").forEach((s, i) => {
    s.classList.toggle("on", i < n);
  });
}

// ── Location Dropdown in topbar ────────────────────
function wireLocationModal() {
  const localeBtn = document.getElementById("localeBtn");
  const localeDropdown = document.getElementById("localeDropdown");
  
  localeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    localeDropdown?.classList.toggle("open");
  });
  
  document.addEventListener("click", (e) => {
    if (!localeDropdown?.contains(e.target) && e.target !== localeBtn) {
      localeDropdown?.classList.remove("open");
    }
  });

  // Manual search
  setupAutocomplete({
    inputId: "areaSearch",
    resultsId: "areaSuggestions",
    onSelect: (loc) => {
      handleLocationChange(loc, true);
      document.getElementById("areaSearch").value = "";
      localeDropdown?.classList.remove("open");
    }
  });
}

function wireMobileNav() {
  const home = document.getElementById("mob-home");
  const post = document.getElementById("mob-post");
  const search = document.getElementById("mob-search");
  const admin = document.getElementById("mob-admin");
  const profile = document.getElementById("mob-profile");

  const setActive = (el) => {
    document.querySelectorAll(".mobile-nav .nav-item").forEach((b) => b.classList.remove("active"));
    el?.classList.add("active");
  };

  home?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActive(home);
    S.filterType = "all";
    document.querySelectorAll("#sourceFilter button").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === "all");
    });
    applyAll();
  });

  post?.addEventListener("click", () => {
    openPost();
  });

  search?.addEventListener("click", () => {
    setActive(search);
    const sInput = document.getElementById("searchInput");
    if (sInput) {
      sInput.focus();
      sInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  admin?.addEventListener("click", () => {
    setActive(admin);
    openModal("adminModalOverlay");
    loadAdminDashboard();
  });

  profile?.addEventListener("click", () => {
    setActive(profile);
    if (!S.user) {
      openModal("auth-modal");
    } else {
      if (confirm("Do you want to Sign Out?")) {
        logout();
        showToast("Signed out successfully 👋");
      }
    }
  });
}

// ── Markdown-like response parser ──────────────────
function parseResponse(text) {
  if (!text) return "";
  let html = text
    // escape HTML
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,.15);padding:2px 6px;border-radius:6px;font-size:12px;">$1</code>')
    // unordered list items
    .replace(/^[-•]\s+(.+)/gm, '<li style="margin:3px 0;">$1</li>')
    // ordered list items
    .replace(/^\d+\.\s+(.+)/gm, '<li style="margin:3px 0;">$1</li>')
    // line breaks
    .replace(/\n/g, "<br>");

  // wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li><br>?)+)/g, (match) => {
    const items = match.replace(/<br>/g, "");
    return `<ul style="margin:6px 0;padding-left:18px;">${items}</ul>`;
  });

  // simple markdown table parser
  const tableRegex = /(\|.+\|<br>?\|[-| :]+\|<br>?(?:\|.+\|<br>?)+)/g;
  html = html.replace(tableRegex, (block) => {
    const rows = block.split("<br>").filter(r => r.trim() && !r.match(/^\|[-| :]+\|$/));
    if (rows.length < 1) return block;
    let table = '<table>';
    rows.forEach((row, i) => {
      const cells = row.split("|").filter(c => c.trim() !== "");
      const tag = i === 0 ? "th" : "td";
      table += "<tr>" + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join("") + "</tr>";
    });
    table += "</table>";
    return table;
  });

  return html;
}

async function fetchOpenAIKey() {
  if (S.openaiKey) return S.openaiKey;
  try {
    const docSnap = await getDoc(doc(db, "config", "openai"));
    if (docSnap.exists()) {
      S.openaiKey = docSnap.data().apiKey;
      return S.openaiKey;
    }
  } catch (e) {
    console.error("Failed to load bot config:", e);
  }
  return null;
}

function wireChatBot() {
  console.log("Initializing wireChatBot...");
  const launcher = document.getElementById("chatLauncher");
  const closeBtn = document.getElementById("chatClose");
  const speakToggle = document.getElementById("chatSpeakToggle");
  const form = document.getElementById("chatInputForm");
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");
  const previewBox = document.getElementById("chatPreviewBox");
  const previewImg = document.getElementById("chatPreviewImg");

  const fileBtn = document.getElementById("chatFileBtn");
  const fileInput = document.getElementById("chatFileInput");
  const removeImgBtn = document.getElementById("chatRemoveImg");
  const voiceBtn = document.getElementById("chatVoiceBtn");
  const chips = document.getElementById("chatChips");

  let selectedImageBase64 = null;
  let speechOutputEnabled = true;

  launcher?.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Assistant launcher clicked!");
    const drawer = document.getElementById("chatDrawer");
    if (drawer) {
      drawer.classList.toggle("open");
      const isOpen = drawer.classList.contains("open");
      console.log("chatDrawer open =", isOpen);
      if (isOpen) {
        fetchOpenAIKey().catch(err => console.error("Key prefetch failed:", err));
        const messages = document.getElementById("chatMessages");
        if (messages) messages.scrollTop = messages.scrollHeight;
      }
    } else {
      console.error("❌ chatDrawer element not found!");
    }
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Assistant close clicked!");
    const drawer = document.getElementById("chatDrawer");
    if (drawer) drawer.classList.remove("open");
  });

  // ── Text-to-Speech Toggle ─────────────────────────
  speakToggle?.addEventListener("click", () => {
    speechOutputEnabled = !speechOutputEnabled;
    speakToggle.textContent = speechOutputEnabled ? "🔊" : "🔇";
    speakToggle.title = speechOutputEnabled ? "Mute Voice Responses" : "Unmute Voice Responses";
    if (!speechOutputEnabled) {
      window.speechSynthesis?.cancel();
    }
  });

  const speakText = (text) => {
    if (!speechOutputEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_\-]/g, "").replace(/<[^>]*>/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 180));
    window.speechSynthesis.speak(utterance);
  };

  // ── Speech-to-Text (Voice Input) ──────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-IN";

    rec.onstart = () => {
      voiceBtn?.classList.add("recording");
      showToast("Listening... Speak now 🎙️");
    };
    rec.onend = () => {
      voiceBtn?.classList.remove("recording");
    };
    rec.onerror = (e) => {
      console.error(e);
      voiceBtn?.classList.remove("recording");
    };
    rec.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      if (input) {
        input.value = speechToText;
        input.focus();
      }
    };
    voiceBtn?.addEventListener("click", () => {
      try {
        rec.start();
      } catch (e) {
        rec.stop();
      }
    });
  } else {
    if (voiceBtn) voiceBtn.style.display = "none";
  }

  // ── File Upload / OCR preview ─────────────────────
  fileBtn?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      selectedImageBase64 = event.target.result;
      if (previewImg) previewImg.src = selectedImageBase64;
      if (previewBox) previewBox.style.display = "flex";
    };
    reader.readAsDataURL(file);
  });

  removeImgBtn?.addEventListener("click", () => {
    selectedImageBase64 = null;
    if (fileInput) fileInput.value = "";
    if (previewBox) previewBox.style.display = "none";
  });

  // ── Quick Chips ───────────────────────────────────
  chips?.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const query = btn.dataset.query;
    if (input && form) {
      input.value = query;
      form.dispatchEvent(new Event("submit"));
    }
  });

  // ── Markdown/Table Parser ─────────────────────────
  const parseResponse = (text) => {
    let html = text;
    // Replace markdown tables
    const tableRegex = /\|(.+)\|[\r\n]+\|([-:| ]+)\|[\r\n]+((?:\|.+|[\r\n]+)*)/g;
    html = html.replace(tableRegex, (match, headerLine, alignLine, bodyLines) => {
      const headers = headerLine.split("|").map(h => h.trim()).filter(Boolean);
      const rows = bodyLines.split("\n").map(r => r.split("|").map(td => td.trim()).filter(Boolean)).filter(r => r.length > 0);
      
      const headHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
      const bodyHTML = `<tbody>${rows.map(r => `<tr>${r.map(td => `<td>${td}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `<table>${headHTML}${bodyHTML}</table>`;
    });

    // Formatting bold, lists, headings
    html = html
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/### (.*?)\n/g, "<h3>$1</h3>")
      .replace(/## (.*?)\n/g, "<h2>$1</h2>")
      .replace(/# (.*?)\n/g, "<h1>$1</h1>")
      .replace(/^- (.*?)\n/gm, "<li>$1</li>")
      .replace(/\n/g, "<br>");
    return html;
  };

  // ── Form Submit (OpenAI integrations) ──────────────
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !selectedImageBase64) return;

    // Append user message
    const userDiv = document.createElement("div");
    userDiv.className = "message user";
    if (selectedImageBase64) {
      userDiv.innerHTML = `<img src="${selectedImageBase64}" style="max-width:120px; border:2px solid var(--ink); display:block; margin-bottom:6px; border-radius:var(--radius);">${escH(text)}`;
    } else {
      userDiv.textContent = text;
    }
    messages.appendChild(userDiv);
    
    // Clear preview
    const attachedImg = selectedImageBase64;
    selectedImageBase64 = null;
    if (fileInput) fileInput.value = "";
    if (previewBox) previewBox.style.display = "none";
    input.value = "";
    messages.scrollTop = messages.scrollHeight;

    // Bot Typing indicator
    const botDiv = document.createElement("div");
    botDiv.className = "message bot";
    botDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    messages.appendChild(botDiv);
    messages.scrollTop = messages.scrollHeight;

    const apiKey = await fetchOpenAIKey();
    if (!apiKey) {
      botDiv.innerHTML = `<div style="padding:12px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:14px;">
        <div style="font-weight:700;color:#fca5a5;margin-bottom:4px;">⚠️ Configuration Required</div>
        <div style="color:#fca5a5;font-size:12px;">AI assistant is not configured yet. An admin needs to set up the API key.</div>
      </div>`;
      messages.scrollTop = messages.scrollHeight;
      return;
    }

    try {
      // Build Context Summary
      const dealsContext = S.deals.length > 0
        ? S.deals.map((d) => {
            const save = (d.originalPrice || 0) - (d.finalPrice || 0);
            const pct = savePct(d.originalPrice, d.finalPrice) || d.discountPercent || 0;
            return `- ${d.title} at ${d.store} (${d.platform || 'online'}). Final Price: ${d.finalPrice ? '₹' + d.finalPrice : 'Discount link'}. Original Price: ${d.originalPrice ? '₹' + d.originalPrice : 'N/A'}. Savings: ${pct}% OFF. Coupon Code: ${d.coupon || 'None'}. Proximity: ${d.area || 'Online'}. Category: ${d.category}. Votes: ${d.votes || 0}. Flags: ${d.flagCount || 0}.`;
          }).join("\n")
        : "No deals are currently live today.";

      const loc = getLocation();
      const locContext = loc?.lat
        ? `User Geolocation Context: Latitude ${loc.lat.toFixed(4)}, Longitude ${loc.lon.toFixed(4)}. Display Location: ${loc.area || 'Online'}.`
        : "User location coordinates are not available.";

      const prefContext = S.userProfile
        ? `User preference config: name ${S.userProfile.displayName || S.userProfile.email.split("@")[0]}, preferred categories: electronics, coding accessories, online apps.`
        : "User is a guest shopper. No bookmarks are configured yet.";

      // Build multimodal payload
      let contentPayload = [];
      if (attachedImg) {
        contentPayload.push({
          type: "text",
          text: `Evaluate this bill screenshot or request. ${text}`
        });
        contentPayload.push({
          type: "image_url",
          image_url: {
            url: attachedImg
          }
        });
      } else {
        contentPayload = text;
      }

      let res;
      const systemPrompt = `You are DealHunt AI, an advanced AI shopping assistant that combines capabilities of ChatGPT, Perplexity, Honey, and Rufus. Your only mission is to maximize user savings.

Contexts:
1. Live Deals:
${dealsContext}
2. Location:
${locContext}
3. Memory:
${prefContext}

Capabilities:
1. AI Deal Search: Check live deals list. Recommends closest matches first.
2. Coupon Finder: Scan coupons, explain savings, calculate stackable discounts.
3. Smart Cart Optimizer: Calculate cost reductions and wallet/upi discounts. Output using:
   - Current Cost
   - After Coupon
   - Cashback
   - Effective Cost
   - Total Savings
4. Recommendation & Comparison: Display options. Build markdown comparison grids comparing Prices, Ratings, Delivery time, and Cashback.
5. Price Prediction: Recommend waits (e.g. WAIT FOR BIG BILLION DAYS, WAIT FOR PRIME DAY) or BUY NOW based on season/history.
6. Fraud Trust Score (0-100): Assess trust based on flags, upvotes, duplicates, and scrape flags.
7. Nearby Discovery: Calculate approximate distances and list closer deals using geolocation coordinates.
8. Negotiation Scripts: Write custom bargain messages for local offline store items.
9. Personality: Be a smart shopping advisor. Use humor, celebrate savings (e.g. "₹420 saved is basically free pizza!").

Format responses neatly in markdown. Use tables for comparison. Reply in the user's language (e.g., Hindi, English, Spanish).`;

      const requestBody = {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentPayload }
        ]
      };

      try {
        console.log("Fetching completions via corsproxy.io...");
        res = await fetch("https://corsproxy.io/?" + encodeURIComponent("https://api.openai.com/v1/chat/completions"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody)
        });
      } catch (proxyErr) {
        console.warn("CORS proxy failed, trying direct OpenAI fetch...", proxyErr);
        res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody)
        });
      }

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "I couldn't process that response.";
      botDiv.innerHTML = parseResponse(reply);
    } catch (err) {
      console.error("ChatBot error:", err);
      const errId = 'retry-' + Date.now();
      botDiv.innerHTML = `<div style="padding:12px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:14px;">
        <div style="font-weight:700;color:#fca5a5;margin-bottom:4px;">Connection Issue</div>
        <div style="color:#fca5a5;font-size:12px;margin-bottom:8px;">${err.message || 'Network error. Please check your connection.'}</div>
        <button id="${errId}" style="background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;border:none;border-radius:10px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;">🔄 Retry</button>
      </div>`;
      setTimeout(() => {
        const retryBtn = document.getElementById(errId);
        if (retryBtn) retryBtn.addEventListener('click', () => {
          botDiv.remove();
          const inputEl = document.getElementById('chatInput');
          if (inputEl) { inputEl.value = text; }
          document.getElementById('chatInputForm')?.dispatchEvent(new Event('submit'));
        });
      }, 50);
    }
    messages.scrollTop = messages.scrollHeight;
  });
}

// ── Admin Dashboard & Comments ─────────────────────
let unsubscribeReviews = null;
let unsubscribeComments = null;
let activeDealId = null;

async function loadAdminDashboard() {
  loadAdminReviews();

  // Tab switches wiring
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".admin-panel-tab").forEach((tab) => (tab.style.display = "none"));

      btn.classList.add("active");
      const activeTabId = "tab-" + btn.dataset.tab;
      const activeTab = document.getElementById(activeTabId);
      if (activeTab) activeTab.style.display = "block";

      if (btn.dataset.tab === "queue") {
        loadAdminReviews();
      } else if (btn.dataset.tab === "channels") {
        loadAdminSources();
      } else if (btn.dataset.tab === "logs") {
        loadAdminLogs();
      }
    });
  });

  // Source registry form submit (wired once)
  const form = document.getElementById("registryForm");
  if (form && !form.dataset.wired) {
    form.dataset.wired = "true";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const channel = document.getElementById("as-channel").value.trim();
      const name = document.getElementById("as-name").value.trim();
      if (!channel || !name) return;
      const { addTelegramSource } = await import("./admin.js");
      const success = await addTelegramSource(channel, name, S.user.uid);
      if (success) {
        form.reset();
        loadAdminSources();
      }
    });
  }
}

async function loadAdminReviews() {
  const { listenPendingDeals } = await import("./admin.js");
  if (unsubscribeReviews) unsubscribeReviews();

  unsubscribeReviews = listenPendingDeals((deals) => {
    const tbody = document.getElementById("reviewTbody");
    if (!tbody) return;
    if (!deals.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--ink-soft);">No deals pending review.</td></tr>`;
      return;
    }

    tbody.innerHTML = deals
      .map(
        (d) => `
      <tr>
        <td style="font-weight:600;">${escH(d.title)}</td>
        <td>${escH(d.store || "Unknown")}</td>
        <td>${escH(d.platform)}</td>
        <td style="font-weight:600;">₹${d.finalPrice}</td>
        <td>
          <div class="btn-group" style="display:flex;gap:4px;">
            <button class="vote-btn voted btn-sm" onclick="window._approveDeal(event, '${d.id}')" style="background:var(--fresh);border-color:var(--fresh);color:white;padding:4px 8px;font-size:12px;">Approve</button>
            <button class="flag-btn flagged btn-sm" onclick="window._rejectDeal(event, '${d.id}')" style="background:var(--hot);border-color:var(--hot);color:white;padding:4px 8px;font-size:12px;">Reject</button>
          </div>
        </td>
      </tr>`
      )
      .join("");
  });
}

async function loadAdminSources() {
  const { getTelegramSources } = await import("./admin.js");
  const tbody = document.getElementById("channelsTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:12px;color:var(--ink-soft);">Loading channels...</td></tr>`;

  const sources = await getTelegramSources();
  if (!sources.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:12px;color:var(--ink-soft);">No Telegram channels registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = sources
    .map(
      (s) => `
    <tr>
      <td style="font-weight:600;">${escH(s.channelName)}</td>
      <td><code>${escH(s.channelId)}</code></td>
      <td>
        <button class="flag-btn flagged btn-sm" onclick="window._removeSource(event, '${s.id}')" style="background:var(--hot);border-color:var(--hot);color:white;padding:4px 8px;font-size:12px;">Delete</button>
      </td>
    </tr>`
    )
    .join("");
}

async function loadAdminLogs() {
  const { getScrapeLogs } = await import("./admin.js");
  const tbody = document.getElementById("logsTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--ink-soft);">Loading logs...</td></tr>`;

  const logs = await getScrapeLogs();
  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--ink-soft);">No logs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs
    .map((l) => {
      const date = new Date(l._ts).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const statusColor = l.status === "success" || l.status === "duplicate" ? "var(--fresh)" : "var(--hot)";
      return `
      <tr>
        <td>${date}</td>
        <td><code>${escH(l.channelId || "System")}</code></td>
        <td><b>${l.confidenceScore || 0}%</b></td>
        <td style="color:${statusColor};font-weight:700;">${escH(l.status)}</td>
        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escH(
          l.errorDetails || ""
        )}">${escH(l.errorDetails || l.rawText || "")}</td>
      </tr>`;
    })
    .join("");
}

async function openCommentsModal(dealId) {
  activeDealId = dealId;
  const deal = S.deals.find((x) => x.id === dealId);
  if (!deal) return;

  const modal = document.getElementById("dealModal");
  if (!modal) return;

  const avg = avgRating(deal);
  const save = (deal.originalPrice || 0) - (deal.finalPrice || 0);
  const pct = savePct(deal.originalPrice, deal.finalPrice) || deal.discountPercent || 0;
  const total = (deal.finalPrice || 0) + (deal.gst || 0);
  const verified = (deal.votes || 0) >= 5;
  const userRated = myRating(deal.id);
  const totalDisplay = total > 0 ? fmt(total) : (deal.discountPercent ? `${deal.discountPercent}% OFF` : "Discount Link");

  modal.innerHTML = `
    <div class="modal-head">
      <div>
        <h2>${escH(deal.title)}</h2>
        <p>${escH(deal.store)} · ${escH(deal.platform)} · 📍 ${escH(deal.area || "Online")} · ${timeAgo(deal._ts)}</p>
      </div>
      <button class="modal-close" data-close="dealModalOverlay">✕</button>
    </div>
    <div class="modal-body">
      ${deal.imageUrl ? `
      <div class="card-img-wrap" style="margin: 0 0 16px 0; border-radius: var(--radius); overflow: hidden; max-height: 240px; display: flex; align-items: center; justify-content: center; background: var(--paper);">
        <img src="${escH(deal.imageUrl)}" alt="${escH(deal.title)}" style="width: 100%; height: 240px; object-fit: cover;" />
      </div>` : ""}

      ${verified ? `<div class="verify-row">✅ Verified — confirmed by ${deal.votes} hunters</div>` : ""}
      
      <div class="hero-price-row" style="margin-bottom:6px;">
        <span class="hero-final">${totalDisplay}</span>
        ${deal.originalPrice && total > 0 ? `<span class="hero-orig">${fmt(deal.originalPrice)}</span>` : ""}
        <span class="hero-discount" style="font-size:14px;padding:4px 10px;">-${pct}%</span>
      </div>
      
      ${deal.gst && total > 0 ? `<p class="price-fee" style="margin-bottom:14px;">Incl. ₹${deal.gst} fees</p>` : ""}
      
      ${deal.coupon ? `
      <div class="coupon-chip" onclick="window._copyCoupon(event,'${escJ(deal.coupon)}')" style="margin-bottom:14px; cursor: pointer;">
        <span class="copy-icon">📋 ${escH(deal.coupon)}</span>
        <span class="copy-flag">✓ Copied!</span>
      </div>` : ""}
      
      ${deal.productLink ? `
      <button class="affiliate-btn" onclick="window.open('${escJ(deal.productLink)}', '_blank');" style="margin:0 0 16px; width: 100%;">
        🌐 Open Deal Link ↗
      </button>` : ""}
      
      ${deal.tips ? `<div class="tips-box"><b>Hunter tips</b>${escH(deal.tips)}</div>` : ""}
      
      <div class="rate-row">
        <span class="lbl">${userRated ? "Your rating" : "Rate this deal"}</span>
        <div class="star-input" id="modalStars" data-id="${deal.id}">
          <span data-v="1">★</span><span data-v="2">★</span><span data-v="3">★</span><span data-v="4">★</span><span data-v="5">★</span>
        </div>
      </div>
      
      <div class="comment-list" id="commentList">
        <!-- Comments list dynamic -->
      </div>
      <form class="comment-form" id="commentForm">
        <input type="text" placeholder="Add a verification update or question…" required>
        <button type="submit">Post</button>
      </form>
    </div>`;

  // Wire Star Input clicks
  const modalStars = document.getElementById("modalStars");
  if (modalStars) {
    const stars = [...modalStars.querySelectorAll("span")];
    if (userRated) {
      stars.forEach((s) => {
        if (parseInt(s.dataset.v) <= userRated) s.classList.add("on");
      });
    } else {
      stars.forEach((s) => {
        s.addEventListener("click", async () => {
          const val = parseInt(s.dataset.v);
          const { submitRating } = await import("./deals.js");
          await submitRating(deal.id, val);
          showToast("Thanks for rating this deal!");
          stars.forEach((x) => x.classList.toggle("on", parseInt(x.dataset.v) <= val));
          applyAll();
        });
      });
    }
  }

  // Wire Comment Submit form
  document.getElementById("commentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!S.user) {
      openModal("auth-modal");
      showToast("Sign in to write comments 👋");
      return;
    }
    const textInput = document.querySelector("#commentForm input");
    const text = textInput?.value.trim();
    if (!text || !activeDealId) return;

    const { collection, addDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
    );
    const { db } = await import("./firebase-config.js");

    try {
      await addDoc(collection(db, "deals", activeDealId, "comments"), {
        userId: S.user.uid,
        userName: S.user.displayName || S.user.email.split("@")[0],
        userPhoto: S.user.photoURL || null,
        text: text,
        createdAt: serverTimestamp(),
      });
      if (textInput) textInput.value = "";
    } catch (err) {
      console.error("Failed to add comment:", err);
      showToast("❌ Failed to post comment.");
    }
  });

  openModal("dealModalOverlay");

  const { collection, query, orderBy, onSnapshot } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );
  const { db } = await import("./firebase-config.js");

  const commentsList = document.getElementById("commentList");
  if (unsubscribeComments) unsubscribeComments();

  const q = query(collection(db, "deals", dealId, "comments"), orderBy("createdAt", "asc"));

  unsubscribeComments = onSnapshot(q, (snap) => {
    if (!commentsList) return;
    const comments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!comments.length) {
      commentsList.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);text-align:center;padding:12px 0;">Be the first to share your thoughts!</p>`;
      return;
    }

    commentsList.innerHTML = comments
      .map((c) => {
        const date = timeAgo(c.createdAt?.toMillis?.() || Date.now());
        const initial = (c.userName || "U").slice(0, 1).toUpperCase();
        return `
        <div class="comment">
          <div class="avatar" style="width:30px;height:30px;border-radius:50%;background:var(--line);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;font-family:'JetBrains Mono',monospace;overflow:hidden;">
            ${c.userPhoto ? `<img src="${c.userPhoto}" alt="" style="width:100%;height:100%;object-fit:cover;"/>` : `<span>${initial}</span>`}
          </div>
          <div>
            <div class="comment-meta"><b>${escH(c.userName)}</b> · ${date}</div>
            <div class="comment-text">${escH(c.text)}</div>
          </div>
        </div>`;
      })
      .join("");
  });
}

// Admin global window triggers
window._approveDeal = async (e, id) => {
  e.stopPropagation();
  const { approveDeal } = await import("./admin.js");
  await approveDeal(id);
};

window._rejectDeal = async (e, id) => {
  e.stopPropagation();
  const { rejectDeal } = await import("./admin.js");
  await rejectDeal(id);
};

window._removeSource = async (e, id) => {
  e.stopPropagation();
  if (!confirm("Are you sure you want to remove this scraping source?")) return;
  const { removeTelegramSource } = await import("./admin.js");
  const ok = await removeTelegramSource(id);
  if (ok) {
    loadAdminSources();
  }
};

window._openComments = async (e, dealId) => {
  e.stopPropagation();
  openCommentsModal(dealId);
};

// ── Global handlers ───────────────────────────────
function openPost() {
  if (!S.user) {
    openModal("auth-modal");
    showToast("Sign in to post a deal 👋");
    return;
  }
  // Pre-fill location
  const loc = getLocation();
  const areaInput = document.getElementById("pd-area");
  if (areaInput && loc?.area && !areaInput.value) areaInput.value = loc.area;
  window._pdLat = loc?.lat;
  window._pdLon = loc?.lon;
  openModal("post-modal");
}
window._openPost = openPost;

window._vote = async (e, id) => {
  e.stopPropagation();
  if (!S.user) {
    openModal("auth-modal");
    showToast("Sign in to upvote 👋");
    return;
  }
  const btn = e.currentTarget;
  if (btn.classList.contains("on")) return;
  const ok = await upvote(id);
  if (ok) {
    btn.classList.add("on");
    const vc = document.getElementById("vc-" + id);
    if (vc) vc.textContent = +vc.textContent + 1;
    showToast("👍 Thanks for the upvote!");
  }
};

window._flag = async (e, id) => {
  e.stopPropagation();
  const btn = e.currentTarget;
  if (btn.classList.contains("on")) return;
  const ok = await flagExpired(id);
  if (ok) {
    btn.classList.add("on");
    showToast("🚩 Flagged as expired. Thanks!");
  }
};

window._del = async (e, id) => {
  e.stopPropagation();
  if (!confirm("Delete this deal permanently?")) return;
  await removeDeal(id);
  showToast("🗑 Deal deleted.");
};

window._copyCoupon = async (e, code) => {
  e.stopPropagation();
  await copyText(code);
  showToast(`✅ Coupon "${code}" copied!`);
};

window._share = async (e, title, area, coupon) => {
  e.stopPropagation();
  const text = `🔥 Found a great deal on DealHunt!\n\n${title}${
    area ? " in " + area : ""
  }${
    coupon ? " — Use code: " + coupon : ""
  }\n\nCheck more deals at https://dealhunt-c940b.web.app`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "DealHunt Deal", text });
      return;
    } catch (err) {}
  }
  await copyText(text);
  showToast("📋 Deal link copied! Share it 🔥");
};

window._rateDeal = async (e, id, stars) => {
  e.stopPropagation();
  if (!S.user) {
    openModal("auth-modal");
    showToast("Sign in to rate deals 👋");
    return;
  }
  const ok = await submitRating(id, stars);
  if (ok) {
    showToast(`⭐ Rated ${stars} star${stars > 1 ? "s" : ""}! Thanks!`);
    applyAll();
  } else showToast("You've already rated this deal.");
};

window._hoverStar = (id, n) => {
  const row = document.getElementById(id);
  if (row)
    row.querySelectorAll("span").forEach((s, i) => {
      s.style.filter = i < n ? "none" : "grayscale(1) opacity(.35)";
      s.style.transform = i < n ? "scale(1.1)" : "";
    });
};
window._unhoverStar = (id) => {
  const row = document.getElementById(id);
  if (row)
    row.querySelectorAll("span").forEach((s) => {
      s.style.filter = "grayscale(1) opacity(.35)";
      s.style.transform = "";
    });
};

function setupAutocomplete({ inputId, resultsId, onSelect }) {
  const input = document.getElementById(inputId);
  const resultsBox = document.getElementById(resultsId);
  if (!input || !resultsBox) return;

  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) {
      resultsBox.innerHTML = "";
      resultsBox.style.display = "none";
      return;
    }
    timer = setTimeout(async () => {
      const res = await searchArea(q);
      if (!res.length) {
        resultsBox.innerHTML = `<div class="autocomplete-item empty">No results found</div>`;
        resultsBox.style.display = "block";
        return;
      }
      
      resultsBox.innerHTML = res.map((r, idx) => `
        <div class="autocomplete-item" data-idx="${idx}">
          📍 ${escH(r.display)}
        </div>
      `).join("");
      resultsBox.style.display = "block";

      // Attach click events
      resultsBox.querySelectorAll(".autocomplete-item").forEach(item => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(item.dataset.idx);
          if (isNaN(idx)) return;
          const selected = res[idx];
          if (selected) {
            onSelect(selected);
          }
          resultsBox.innerHTML = "";
          resultsBox.style.display = "none";
        });
      });
    }, 350);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resultsBox.innerHTML = "";
      resultsBox.style.display = "none";
    }
  });

  // Hide when clicking outside
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
      resultsBox.style.display = "none";
    }
  });
}

window._filterPlatform = (name) => {
  const si = document.getElementById("hero-search-input");
  if (si) si.value = name;
  const ni = document.getElementById("nav-search-input");
  if (ni) ni.value = name;
  S.search = name;
  applyAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window._removeChip = (idx) => {
  // Maps chip index to what it was — simplest: just reset all
  resetFilters();
};

window._saveDeal = (e, id) => {
  e.stopPropagation();
  if (S.savedDeals.has(id)) S.savedDeals.delete(id);
  else S.savedDeals.add(id);
  localStorage.setItem("dh_saved_deals", JSON.stringify([...S.savedDeals]));
  window._syncSavedBtn?.();
  applyAll();
  showToast(S.savedDeals.has(id) ? "Saved for later 💾" : "Removed from saved");
};

function handleLocationChange(loc, showToasts = true) {
  if (!loc) return;
  setLocation(loc);

  // Sync Nav display
  setEl("nav-loc-txt", loc.area || "Set location");

  // Sync Hero GPS button
  const hb = document.getElementById("hero-gps-btn");
  if (hb && !hb.classList.contains("loading")) {
    hb.textContent = "📍 " + (loc.area || "Detect my location");
  }

  // Sync Location Modal title
  const lmGpsTitle = document.querySelector("#loc-gps-btn .loc-gps-txt h4");
  if (lmGpsTitle) {
    lmGpsTitle.textContent = loc.area ? `Location: ${loc.area}` : "Use my current location";
  }

  // Sync Post modal locality input (if it is empty)
  const pdLocInput = document.getElementById("pd-area");
  if (pdLocInput && !pdLocInput.value) {
    pdLocInput.value = loc.area || "";
    window._pdLat = loc.lat;
    window._pdLon = loc.lon;
    const pdLocBtn = document.getElementById("pd-detect-loc");
    if (pdLocBtn) pdLocBtn.textContent = "📍 Detected";
  }

  if (showToasts && loc.area) {
    showToast("📍 Location set to " + loc.area);
  }

  applyAll();
}

function runGPSDetection(triggerElement, textSelector, loadingText, defaultText, successText, onDone) {
  if (triggerElement) {
    triggerElement.classList.add("loading");
  }
  
  let textEl = triggerElement;
  if (textSelector && triggerElement) {
    textEl = triggerElement.querySelector(textSelector) || triggerElement;
  }
  
  if (textEl) {
    textEl.textContent = loadingText;
  }

  detectGPS(
    (area, lat, lon) => {
      if (triggerElement) {
        triggerElement.classList.remove("loading");
      }
      if (textEl) {
        textEl.textContent = successText || ("📍 " + area);
      }
      
      const loc = { lat, lon, area };
      handleLocationChange(loc, true);
      onDone?.(loc);
    },
    (err) => {
      if (triggerElement) {
        triggerElement.classList.remove("loading");
      }
      if (textEl) {
        textEl.textContent = defaultText;
      }
      showToast("⚠️ " + err);
    }
  );
}

// Keyboard shortcut: Press "/" to focus search box
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
    e.preventDefault();
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
});
