const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, serverTimestamp } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { OpenAI } = require("openai");
const dotenv = require("dotenv");

// Load Environment Variables
dotenv.config();

// Web Firebase Configuration (matching js/firebase-config.js)
const firebaseConfig = {
  apiKey: "AIzaSyBCvBYoCPD6XBE0qJJVPm3c_vSDG_nWVY4",
  authDomain: "dealhunt-c940b.firebaseapp.com",
  projectId: "dealhunt-c940b",
  storageBucket: "dealhunt-c940b.firebasestorage.app",
  messagingSenderId: "951115619679",
  appId: "1:951115619679:web:041647c2ccdf9d0778eaea",
  measurementId: "G-39252GCHTB",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Authenticate Admin User to bypass Firestore Security Rules
async function authenticateAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  
  if (!email || !password || email === "admin@dealhunt.com") {
    throw new Error(
      "Please set valid ADMIN_EMAIL and ADMIN_PASSWORD inside the .env file. The user must exist in Firebase Auth and have role='admin' in Firestore."
    );
  }
  
  console.log(`🔑 Authenticating session as admin user: ${email}...`);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  console.log(`✅ Authenticated successfully! User UID: ${userCredential.user.uid}`);
  return userCredential.user;
}

// Format message via OpenAI GPT-4o-mini
async function parseDealWithMessage(openai, messageText) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a Deal Parsing AI. Analyze this messy retail/food coupon message and return a structured JSON object matching this schema:
{
  "title": "Clean, attractive product/food name (e.g., iPhone 15 Pro Max 128GB)",
  "store": "Restaurant/Store Name (e.g. Haldiram's, Domino's, Nike)",
  "platform": "Swiggy" | "Zomato" | "Amazon" | "Flipkart" | "Blinkit" | "Zepto" | "Meesho" | "Myntra" | "BigBasket" | "Nykaa" | "DMart" | "Store (Offline)" | "Other",
  "category": "food" | "electronics" | "clothes" | "groceries" | "other",
  "originalPrice": float (or null if not specified),
  "finalPrice": float (or null if not specified),
  "discountPercent": float (percentage discount 0-100, or null),
  "coupon": "UPPERCASE_CODE" or null,
  "productLink": "clean retail URL or null",
  "tips": "helpful optimization cards or limit conditions, otherwise null"
}`
      },
      {
        role: "user",
        content: messageText
      }
    ]
  });

  return JSON.parse(response.choices[0].message.content);
}

// Main Polling Loop
async function pollTelegramBot(openai, adminUser) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "YOUR_TELEGRAM_BOT_TOKEN") {
    throw new Error("Please specify a valid TELEGRAM_BOT_TOKEN in the .env file.");
  }

  let offset = 0;
  console.log("🚀 Scraper daemon long-polling has started! Send text deals to your Telegram Bot...");

  while (true) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          const msg = update.message || update.channel_post;
          if (msg && (msg.text || msg.caption)) {
            const rawText = (msg.text || msg.caption).trim();
            console.log(`\n📥 Message Received [Msg ID: ${msg.message_id}]`);
            console.log(`Raw Text: "${rawText.substring(0, 120)}..."`);

            // Extract Photo attachments if present
            let imageUrl = "";
            const photo = msg.photo;
            if (photo && photo.length > 0) {
              const largestPhoto = photo[photo.length - 1];
              const fileId = largestPhoto.file_id;
              try {
                console.log(`📸 Image attachment found (File ID: ${fileId}). Resolving file URL...`);
                const fileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
                const fileRes = await fetch(fileUrl);
                const fileData = await fileRes.json();
                
                if (fileData.ok && fileData.result.file_path) {
                  imageUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
                  console.log(`✅ Resolved Image URL: ${imageUrl}`);
                }
              } catch (err) {
                console.error("❌ Failed to resolve Telegram image path:", err.message);
              }
            }

            try {
              console.log("🤖 Formatting message with OpenAI API...");
              const deal = await parseDealWithMessage(openai, rawText);
              
              if (!deal.title) {
                console.log("⚠️ Invalid extraction: title was missing. Skipping.");
                continue;
              }

              console.log("✨ Deal Extracted:");
              console.log(JSON.stringify(deal, null, 2));

              console.log("💾 Saving deal to Firebase Firestore...");
              const docRef = await addDoc(collection(db, "deals"), {
                title: deal.title,
                store: deal.store || deal.platform || "Unknown Store",
                platform: deal.platform || "Other",
                category: deal.category || "other",
                originalPrice: deal.originalPrice ? Number(deal.originalPrice) : null,
                finalPrice: deal.finalPrice ? Number(deal.finalPrice) : null,
                discountPercent: deal.discountPercent ? Number(deal.discountPercent) : null,
                coupon: deal.coupon ? String(deal.coupon).toUpperCase() : "",
                productLink: deal.productLink || "",
                tips: deal.tips || "",
                imageUrl: imageUrl, // Save resolved telegram image link!
                area: "Online / Auto Found",
                sourceType: "telegram_scraped",
                status: "approved", // auto-approve admin bot posts
                userId: adminUser.uid,
                poster: adminUser.displayName || adminUser.email.split("@")[0],
                createdAt: serverTimestamp(),
                _ts: Date.now(),
                votes: 0,
                flagCount: 0,
                ratingSum: 0,
                ratingCount: 0
              });

              console.log(`🚀 Deal posted successfully! Live ID: ${docRef.id}`);

            } catch (err) {
              console.error("❌ Failed to process this message:", err);
            }
          }
        }
      }
    } catch (e) {
      console.error("⚠️ Connection error in polling cycle. Retrying in 5 seconds...", e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Bootstrapping function
async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "YOUR_OPENAI_API_KEY") {
    throw new Error("Please specify a valid OPENAI_API_KEY in the .env file.");
  }

  const openai = new OpenAI({ apiKey });
  
  try {
    const adminUser = await authenticateAdmin();
    await pollTelegramBot(openai, adminUser);
  } catch (err) {
    console.error("🚨 Fatal initialization error:", err.message);
    process.exit(1);
  }
}

main();
