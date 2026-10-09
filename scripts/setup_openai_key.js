require("dotenv").config();
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBCvBYoCPD6XBE0qJJVPm3c_vSDG_nWVY4",
  authDomain: "dealhunt-c940b.firebaseapp.com",
  projectId: "dealhunt-c940b",
  storageBucket: "dealhunt-c940b.firebasestorage.app",
  messagingSenderId: "951115619679",
  appId: "1:951115619679:web:041647c2ccdf9d0778eaea"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

async function run() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is not defined in environment variables.");
    process.exit(1);
  }


  console.log(`🔐 Authenticating as ${email}...`);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Authenticated successfully! User UID:", userCredential.user.uid);
    
    console.log("💾 Storing OpenAI key in Firestore...");
    await setDoc(doc(db, "config", "openai"), {
      apiKey: apiKey,
      updatedAt: new Date().toISOString()
    });
    console.log("🎉 Stored successfully in '/config/openai'!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

run();
