import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "./ui.js";

const DEALS_COL = "deals";
const SOURCES_COL = "telegramSources";
const LOGS_COL = "scrapeLogs";

// ── 1. Pending Deals (Review Queue) ──────────────────
export function listenPendingDeals(cb) {
  const q = query(
    collection(db, DEALS_COL),
    where("status", "==", "pending_review"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const deals = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        _ts: d.data().createdAt?.toMillis?.() || Date.now(),
      }));
      cb(deals);
    },
    (err) => {
      console.error("Error loading review queue:", err);
      cb([]);
    }
  );
}

export async function approveDeal(dealId) {
  try {
    await updateDoc(doc(db, DEALS_COL, dealId), {
      status: "approved",
    });
    showToast("🎉 Deal approved! Now live on the main feed.");
    return true;
  } catch (err) {
    console.error("Failed to approve deal:", err);
    showToast("❌ Failed to approve deal.");
    return false;
  }
}

export async function rejectDeal(dealId) {
  try {
    await updateDoc(doc(db, DEALS_COL, dealId), {
      status: "rejected",
    });
    showToast("🗑 Deal rejected.");
    return true;
  } catch (err) {
    console.error("Failed to reject deal:", err);
    showToast("❌ Failed to reject deal.");
    return false;
  }
}

// ── 2. Telegram Sources Registry ─────────────────────
export async function getTelegramSources() {
  try {
    const q = query(collection(db, SOURCES_COL), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    console.error("Failed to fetch Telegram sources:", err);
    return [];
  }
}

export async function addTelegramSource(channelId, channelName, userId) {
  try {
    // Validate channel handle
    const handle = channelId.startsWith("@") ? channelId : "@" + channelId;
    await addDoc(collection(db, SOURCES_COL), {
      channelId: handle,
      channelName: channelName || handle,
      isActive: true,
      addedBy: userId,
      createdAt: serverTimestamp(),
    });
    showToast("✅ Telegram channel registered successfully.");
    return true;
  } catch (err) {
    console.error("Failed to register Telegram source:", err);
    showToast("❌ Failed to register source.");
    return false;
  }
}

export async function removeTelegramSource(docId) {
  try {
    await deleteDoc(doc(db, SOURCES_COL, docId));
    showToast("🗑 Channel source removed.");
    return true;
  } catch (err) {
    console.error("Failed to remove channel source:", err);
    showToast("❌ Failed to delete source.");
    return false;
  }
}

// ── 3. Automation Logs ───────────────────────────────
export async function getScrapeLogs(limitCount = 50) {
  try {
    const q = query(
      collection(db, LOGS_COL),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      _ts: d.data().timestamp?.toMillis?.() || Date.now(),
    }));
  } catch (err) {
    console.error("Failed to fetch scrape logs:", err);
    return [];
  }
}
