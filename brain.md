# DealHunt Architecture & Codebase Map (brain.md)

This document is the absolute source of truth for the codebase architecture, file configurations, data schemas, API routes, and core functionality of the DealHunt app. **Update this document whenever structural changes, configurations, or behavioral models are modified.**

---

## 📂 Project Directory Structure

```
dealhunt/
├── index.html              ← Main single-page application layout and modals (Admin & Discussion modals added)
├── brain.md                ← This architectural blueprint and documentation
├── firebase.json           ← Firebase Hosting config
├── firestore.rules         ← Secure database access rules (enforces user & admin actions)
├── n8n_pipeline.json       ← Workflow configuration to ingest, AI-parse, & filter scraped deals
├── .env                    ← Environment credentials config (Telegram token, OpenAI key, Admin session login)
├── css/
│   └── style.css           ← Mobile-first stylesheet (light/dark themes, tag badges, comment threads)
├── scripts/
│   └── telegram_bot_scraper.js ← Local polling daemon to structure Telegram deals with OpenAI and post to Firestore
└── js/
    ├── firebase-config.js  ← Firebase initializeApp, Firestore, Auth, Providers
    ├── auth.js             ← User session logic (Google Auth, Email/Password signin, Firestore Profile sync)
    ├── deals.js            ← Firestore database updates (post, upvote, delete, rate, flag, status constraints)
    ├── location.js         ← GPS reverse geocoding & autocomplete Nominatim API calls
    ├── ui.js               ← Formatters, toasts, relative times, constants (CATS, PLATFORMS)
    ├── admin.js            ← Admin Dashboard operations (reviews queue listener, sources registry, scrape logs)
    └── app.js              ← Dynamic renderers, event wiring, scoring engine, comments snapshot streams
```

---

## ⚙️ Data Schemas

### 1. `/users` (User Profiles)
- `uid`: `string` (Matches Auth UID)
- `email`: `string`
- `displayName`: `string`
- `photoURL`: `string`
- `role`: `string` ("user" | "admin")
- `createdAt`: `timestamp`

### 2. `/deals` (Unified Deal Collection)
- `title`: `string` (Product/Food combo name)
- `store`: `string` (Restaurant/Outlet name)
- `platform`: `string` (Swiggy, Zomato, Amazon, Blinkit, Offline, etc.)
- `category`: `string` (food, electronics, clothes, groceries, other)
- `originalPrice`: `number`
- `finalPrice`: `number`
- `discountPercent`: `number`
- `coupon`: `string`
- `gst`: `number`
- `area`: `string`
- `productLink`: `string` (Affiliate or direct deal landing URL)
- `urlHash`: `string` (MD5 checksum of URL to prevent duplicates)
- `tips`: `string`
- `lat` / `lon`: `number` (Proximity markers)
- `sourceType`: `string` ("user" | "telegram_scraped")
- `sourceTelegramChannel`: `string` (Channel username)
- `confidenceScore`: `number` (AI parsing reliability score, 0-100)
- `status`: `string` ("approved" | "pending_review" | "rejected" | "expired")
- `userId`: `string` (UID of poster or "system_n8n")
- `poster`: `string` (Display name or scraper handle)
- `posterPhoto`: `string` (Avatar link)
- `votesCount`: `number`
- `ratingsCount`: `number`
- `ratingsAverage`: `number`
- `reportsCount`: `number`
- `createdAt`: `timestamp`
- `_ts`: `number` (Unix milliseconds)

### 3. `/deals/{dealId}/comments` (Sub-collection)
- `userId`: `string`
- `userName`: `string`
- `userPhoto`: `string`
- `text`: `string`
- `createdAt`: `timestamp`

### 4. `/telegramSources` (Telegram scraping channels)
- `channelId`: `string` (e.g. "@swiggy_deals")
- `channelName`: `string`
- `isActive`: `boolean`
- `addedBy`: `string`
- `createdAt`: `timestamp`

### 5. `/scrapeLogs` (Audit Logs)
- `channelId`: `string`
- `messageId`: `string`
- `status`: `string` ("success" | "duplicate" | "validation_failed" | "ai_extraction_failed")
- `confidenceScore`: `number`
- `errorDetails`: `string` (or raw text snippet)
- `timestamp`: `timestamp`

---

## 🔒 Firestore Security Rules

Defined inside `firestore.rules` to enforce secure boundaries:
- Public deals feed only queries `status == 'approved'`.
- Authenticated users can write comments and self-posts with zero start-votes.
- User profile roles cannot be updated from the client.
- Scraped logs and sources are restricted exclusively to `role == 'admin'`.

---

## ⚡ Core JavaScript Functions & Helpers

The application architecture utilizes the following module controllers:

### 1. Dynamic Rendering (`js/app.js`)
- `renderConfigDrivenUI()`: Populates layout dropdowns and filter chips row.
- `calculateDynamicScore(d)`: Computes AI score based on discounts, votes, ratings, flags, and hourly decay.
- `openCommentsModal(dealId)`: Injects deal details and subscribes to real-time comments sub-collection snapshot feeds.

### 2. Autocomplete Engine (`js/app.js`)
- `setupAutocomplete({inputId, resultsId, onSelect})`: Reusable geocoding input debouncer.

### 3. Location Synchronization (`js/app.js`)
- `handleLocationChange()` & `runGPSDetection()`: Core GPS reverse geocoder and navbar updater.

### 4. Admin Management Operations (`js/admin.js`)
- `listenPendingDeals(cb)`: Real-time listener for deals awaiting approval.
- `approveDeal(dealId)` & `rejectDeal(dealId)`: Approves or flags deals from the moderator queue.
- `addTelegramSource()` & `removeTelegramSource()`: Modifies active scraping registers.
- `getScrapeLogs()`: Fetches automation history.

---

## 🤖 Guide for Future AI Coding Assistants
When implementing features or bug fixes:
1. **Maintain Config Driven Principle**: Never write raw categories or platform dropdown option items in `index.html`. Add or modify them in `js/ui.js` instead.
2. **Reuse Helpers**: Do not write new manual geocoding or Nominatim autocomplete event loops. Call `setupAutocomplete` and `runGPSDetection` from `js/app.js`.
3. **Respect Security Rules**: All public queries must check `status == 'approved'`. Avoid client-side mutations on administrative collections.
4. **Update this file (brain.md)**: If you update document schemas, add config constants, or change core files, keep this map updated.
