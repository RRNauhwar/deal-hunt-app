import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COL = "deals";

export function listenDeals(cb) {
  const q = query(
    collection(db, COL),
    orderBy("createdAt", "desc"),
    limit(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      const deals = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          _ts: d.data().createdAt?.toMillis?.() || Date.now(),
        }))
        .filter((d) => d.status === "approved" || !d.status);
      cb(deals);
    },
    (err) => {
      console.error(err);
      cb([]);
    }
  );
}

export async function postDeal(data, user) {
  return await addDoc(collection(db, COL), {
    ...data,
    votes: 0,
    flagCount: 0,
    ratingSum: 0,
    ratingCount: 0,
    poster: user.displayName || user.email.split("@")[0],
    posterPhoto: user.photoURL || null,
    userId: user.uid,
    sourceType: "user",
    status: "approved",
    createdAt: serverTimestamp(),
    _ts: Date.now(),
  });
}

export async function upvote(id) {
  if (localStorage.getItem("v_" + id)) return false;
  await updateDoc(doc(db, COL, id), { votes: increment(1) });
  localStorage.setItem("v_" + id, "1");
  return true;
}

export async function submitRating(id, stars) {
  const key = "r_" + id;
  if (localStorage.getItem(key)) return false;
  await updateDoc(doc(db, COL, id), {
    ratingSum: increment(stars),
    ratingCount: increment(1),
  });
  localStorage.setItem(key, String(stars));
  return true;
}

export async function flagExpired(id) {
  if (localStorage.getItem("f_" + id)) return false;
  await updateDoc(doc(db, COL, id), { flagCount: increment(1) });
  localStorage.setItem("f_" + id, "1");
  return true;
}

export async function removeDeal(id) {
  await deleteDoc(doc(db, COL, id));
}

export const didVote = (id) => !!localStorage.getItem("v_" + id);
export const didFlag = (id) => !!localStorage.getItem("f_" + id);
export const myRating = (id) =>
  parseInt(localStorage.getItem("r_" + id) || "0");
