// ── Toast ───────────────────────────────────────
let _toastTimer;
export function showToast(msg, duration = 3500) {
  const t = document.getElementById("toast");
  if (!t) return;
  clearTimeout(_toastTimer);
  t.textContent = msg;
  t.classList.add("show");
  _toastTimer = setTimeout(() => t.classList.remove("show"), duration);
}

// ── Modals ───────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("open");
    document.body.style.overflow = "";
  }
}
export function closeAllModals() {
  document
    .querySelectorAll(".modal-overlay,.filter-panel")
    .forEach((m) => m.classList.remove("open"));
  document.body.style.overflow = "";
}

// ── Formatting ───────────────────────────────────
export function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function fmt(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

export function savePct(orig, final) {
  if (!orig || !final || orig <= final) return 0;
  return Math.round(((orig - final) / orig) * 100);
}

export function starsHtml(rating) {
  if (!rating) return "";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= full) html += '<span class="star">⭐</span>';
    else if (i === full + 1 && half) html += '<span class="star">⭐</span>';
    else
      html +=
        '<span class="star" style="filter:grayscale(1) opacity(.3)">⭐</span>';
  }
  return html;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

export function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

export function escH(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function escJ(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

// ── Constants ────────────────────────────────────
export const CATS = {
  food: { label: "Food", emoji: "🍜", color: "#FF4B26", bg: "#fff1ee" },
  electronics: {
    label: "Electronics",
    emoji: "💻",
    color: "#3B82F6",
    bg: "#eff6ff",
  },
  clothes: { label: "Clothes", emoji: "👕", color: "#10B981", bg: "#ecfdf5" },
  groceries: {
    label: "Groceries",
    emoji: "🛒",
    color: "#F59E0B",
    bg: "#fffbeb",
  },
  other: { label: "Other", emoji: "📦", color: "#8B5CF6", bg: "#f5f3ff" },
};

export const PLATFORMS = [
  "Swiggy",
  "Zomato",
  "Amazon",
  "Flipkart",
  "Blinkit",
  "Zepto",
  "Meesho",
  "Myntra",
  "BigBasket",
  "Nykaa",
  "DMart",
  "Store (Offline)",
  "Other",
];

export const PLAT_COLORS = {
  Swiggy: "#FC8019",
  Zomato: "#E23744",
  Amazon: "#FF9900",
  Flipkart: "#2874F0",
  Blinkit: "#F7CE46",
  Zepto: "#8B5CF6",
  Meesho: "#9B59B6",
  Myntra: "#FF3F6C",
  BigBasket: "#84C225",
  Nykaa: "#FC2779",
  DMart: "#DD2222",
};
