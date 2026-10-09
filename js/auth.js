import { db, auth, googleProvider } from "./firebase-config.js";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "./ui.js";

async function syncUserProfile(user) {
  try {
    const userDocRef = doc(db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data();
    } else {
      const newProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        photoURL: user.photoURL || null,
        role: "user",
        createdAt: serverTimestamp(),
      };
      await setDoc(userDocRef, newProfile);
      return newProfile;
    }
  } catch (e) {
    console.error("Error syncing user profile:", e);
    return { role: "user" };
  }
}

export function initAuth(cb) {
  onAuthStateChanged(auth, async (user) => {
    let profile = null;
    if (user) {
      profile = await syncUserProfile(user);
    }
    cb(user, profile);
    syncNavUI(user, profile);
  });
}

function syncNavUI(user, profile) {
  const signinBtn = document.getElementById("btn-signin");
  const userMenu = document.getElementById("user-menu");
  const avatarEl = document.getElementById("u-avatar");
  const nameEl = document.getElementById("u-name");
  if (!signinBtn || !userMenu) return;
  if (user) {
    signinBtn.style.display = "none";
    userMenu.style.display = "flex";
    if (avatarEl) {
      avatarEl.innerHTML = user.photoURL
        ? `<img src="${user.photoURL}" alt=""/>`
        : `<span>${(user.displayName || user.email || "U")
            .slice(0, 2)
            .toUpperCase()}</span>`;
    }
    if (nameEl) {
      const name = (user.displayName || user.email.split("@")[0]).split(" ")[0];
      nameEl.textContent = profile && profile.role === "admin" ? `${name} (Admin)` : name;
    }
  } else {
    signinBtn.style.display = "flex";
    userMenu.style.display = "none";
  }
}

export async function googleLogin() {
  try {
    const r = await signInWithPopup(auth, googleProvider);
    showToast(
      `Hey ${r.user.displayName?.split(" ")[0] || "there"}! Welcome 🔥`
    );
    return r.user;
  } catch (e) {
    if (e.code !== "auth/popup-closed-by-user") showToast("❌ " + e.message);
    return null;
  }
}

export async function emailSignup(name, email, pass) {
  try {
    const c = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(c.user, { displayName: name });
    showToast(`Welcome, ${name}! 🔥`);
    return c.user;
  } catch (e) {
    const m =
      e.code === "auth/email-already-in-use"
        ? "Email already registered. Sign in instead."
        : e.code === "auth/weak-password"
        ? "Password must be at least 6 characters."
        : e.message;
    showToast("❌ " + m);
    return null;
  }
}

export async function emailLogin(email, pass) {
  try {
    const c = await signInWithEmailAndPassword(auth, email, pass);
    showToast(
      `Welcome back, ${c.user.displayName?.split(" ")[0] || "there"}! 🔥`
    );
    return c.user;
  } catch (e) {
    const m = [
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/invalid-credential",
    ].includes(e.code)
      ? "Invalid email or password."
      : e.message;
    showToast("❌ " + m);
    return null;
  }
}

export async function logout() {
  await signOut(auth);
  showToast("Signed out. See you soon! 👋");
}
export const currentUser = () => auth.currentUser;
