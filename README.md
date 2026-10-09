# 🔥 DealHunt — Production App

## Project Structure
```
dealhunt/
├── index.html              ← Main page
├── firebase.json           ← Firebase hosting config
├── css/
│   └── style.css           ← All styles
└── js/
    ├── firebase-config.js  ← Firebase credentials
    ├── auth.js             ← Login / signup / Google auth
    ├── deals.js            ← Post, vote, flag, delete deals
    ├── location.js         ← GPS + manual location search
    ├── ui.js               ← Toast, modals, formatting helpers
    └── app.js              ← Main app logic, renders everything
```

---

## 🚀 Deploy in 3 Steps

### Step 1 — Firebase Console Setup (already done ✅)
Your Firebase project: **dealhunt-c940b**

Make sure these are enabled:
- Firestore Database (test mode) ✅
- Authentication → Email/Password ✅ + Google ✅

**Firestore Security Rules** — Go to Firestore → Rules → paste this:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /deals/{dealId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.userId;
    }
  }
}
```
Click **Publish**.

---

### Step 2 — Terminal Commands
Open terminal in your `dealhunt` folder:

```bash
# If not already logged in
firebase login

# Link to your project
firebase use dealhunt-c940b

# Deploy!
firebase deploy
```

Done. Your app is live at:
👉 **https://dealhunt-c940b.web.app**

---

### Step 3 — Fix Google Sign-In (Important!)
After deploying, Google sign-in needs your domain whitelisted:

1. Go to Firebase Console → Authentication → Settings → **Authorized domains**
2. Click **Add domain**
3. Add: `dealhunt-c940b.web.app`

---

## 📲 How to Share & Grow

### Immediate Steps (Do Today)
1. **Share in WhatsApp groups** — "I built a site where you can find deals on Swiggy/Zomato/Amazon. Completely free: https://dealhunt-c940b.web.app"
2. **Post 10-15 deals yourself** to seed the platform — nobody will post on an empty app
3. **College/society groups** — target Chandigarh groups first

### Growth Tactics
- **Instagram Reels** — "I found this thali for ₹149 instead of ₹349" → show the app
- **Reddit** r/India, r/Chandigarh — "Built a free community deal-sharing app"
- **Referral** — tell users "invite 3 friends = get Deal Hunter badge"
- **Daily WhatsApp broadcast** — send top 3 deals every morning at 8am

### Custom Domain (Optional, ₹500/year)
```bash
firebase hosting:channel:deploy preview
# or buy dealhunt.in on GoDaddy and connect in Firebase Hosting settings
```

---

## 💰 Free Tier Limits (Firebase Spark Plan)
| Resource | Free Daily Limit |
|----------|-----------------|
| Firestore reads | 50,000 |
| Firestore writes | 20,000 |
| Hosting bandwidth | 360 MB |
| Auth users | Unlimited |

You can handle ~5,000 active users/day for free. After that, upgrade to Blaze (pay-as-you-go) — still very cheap.

---

## 🐛 Fixed Bugs from v1
- Auth state now properly tracked — "Sign In" button hides when logged in
- Google sign-in works as primary auth method
- No more double-voting (uses localStorage)
- Location search works like Zomato (type → see suggestions → tap)
- Deal cards properly show/hide Delete button only for owner
- Form validation with proper error messages
- Modal properly locks body scroll
