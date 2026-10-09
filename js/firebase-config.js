import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCvBYoCPD6XBE0qJJVPm3c_vSDG_nWVY4",
  authDomain: "dealhunt-c940b.firebaseapp.com",
  projectId: "dealhunt-c940b",
  storageBucket: "dealhunt-c940b.firebasestorage.app",
  messagingSenderId: "951115619679",
  appId: "1:951115619679:web:041647c2ccdf9d0778eaea",
  measurementId: "G-39252GCHTB",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
