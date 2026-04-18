# EasySellMarket

[中文说明 / Chinese Version](./README.zh-CN.md)

> A lightweight secondhand marketplace for small trusted communities.
> Static frontend, Firebase Firestore backend, friendly enough to launch in one evening.

## ✨ What This Project Feels Like

EasySellMarket is a single-page marketplace built for small circles such as classmates, neighbors, studio groups, church groups, or community chats.

It is a good fit when you want:

- 📱 A mobile-first secondhand listing page
- 🖼️ Image upload with client-side compression
- 💬 Item comments and buyer queue management
- 🛠️ A hidden admin panel at `#/admin`
- 🔐 A publisher workflow at `#/publish` with invite/serial codes
- 🚀 Static deployment on GitHub Pages

## 🧰 Tech Stack

- Frontend: plain HTML, CSS, and JavaScript
- Routing: hash routing
- Backend: Firebase Firestore
- Hosting: GitHub Pages

## 🗂️ Project Structure

```text
.
|-- index.html          # Layout, styles, Firebase config, asset version
|-- app.js              # App logic, routing, Firestore integration
|-- README.md           # English documentation
`-- README.zh-CN.md     # Chinese documentation
```

## 🚀 Quick Start

If you just want to get the site running, follow these steps in order.

### 1. Create your Firebase project

1. Open <https://console.firebase.google.com>.
2. Create a new Firebase project.
3. Enable `Firestore Database`.
4. In project settings, create a Web app.
5. Copy the generated `firebaseConfig`.

### 2. Open `index.html` and replace the config

Find the config section and replace it with your own values:

```js
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

window.ADMIN_PASSWORD = "change-me";
window.SELLER_NAME = "Your Name";
window.SELLER_WECHAT = "your-contact";
window.PUBLISHER_CODES = [
  { code: "EASY-SELL-001", label: "Example Publisher", enabled: true }
];
window.ASSET_VERSION = "2026-04-17-1";
```

### 3. Understand what each field does

- `window.FIREBASE_CONFIG`: connects the site to your Firebase project
- `window.ADMIN_PASSWORD`: password used to enter `#/admin`
- `window.SELLER_NAME`: default seller or shop display name
- `window.SELLER_WECHAT`: default contact shown to users
- `window.PUBLISHER_CODES`: fallback publisher code list
- `window.ASSET_VERSION`: version string for cache busting after deploys

### 4. Run locally

Opening `index.html` directly can work, but a local static server is more reliable:

```powershell
cd d:\GitHub\easysellmarket
python -m http.server 5500
```

Then visit:

```text
http://localhost:5500
```

### 5. Sanity-check the main flows

Before deploying, quickly verify these pages:

1. `#/` home page loads item list
2. `#/publish` allows publisher code login
3. `#/admin` accepts your admin password
4. Creating a test item writes data into Firestore

## 🧭 Routes

- `#/` home page
- `#/item/<itemId>` item detail page
- `#/admin` admin dashboard
- `#/publish` publisher login and publishing center

## 👥 Roles and Permissions

### Admin

- Can create, edit, and delete any item
- Can manage buyer queues
- Can manage publisher serial codes
- Can view contact details left in comments

### Publisher

- Must sign in with a valid serial code
- Must provide a display name and contact info
- Can publish items under their own code
- Can edit and delete only their own items

## 🔑 Publisher Code Sources

Publisher codes can come from two places:

1. `window.PUBLISHER_CODES` in `index.html`
2. Firestore `publisherCodes` collection

The built-in array is your fallback/default source.
Once you start managing codes in the admin dashboard, the Firestore collection becomes the primary source.

## 🔄 Cache Busting

To reduce stale caches on phones and in-app browsers such as WeChat, the site loads `app.js` with a version query string.

Whenever you deploy frontend changes, update this value in `index.html`:

```js
window.ASSET_VERSION = "2026-04-17-2";
```

That nudges clients to fetch the newest `app.js`.

## 🧪 Firestore Data Shape

```text
items/{itemId}
  title, description, price, originalPrice
  category, condition, status
  photos[]
  ownerType
  publisherCode, publisherName, publisherContact
  queueCount
  createdAt, updatedAt

items/{itemId}/comments/{commentId}
  author, contact, text, createdAt

items/{itemId}/queue/{queueId}
  name, contact, note, status, joinedAt

publisherCodes/{codeId}
  code, label, enabled, createdAt, updatedAt
```

## 📌 Notes Before Real-World Use

- This is still a static frontend app, not a hardened auth system.
- Admin password and Firebase config are visible on the client side.
- For real production-grade security, move permissions to Firebase Auth and Firestore rules.

## ✅ Deployment Checklist

- Firebase project created
- Firestore enabled
- `window.FIREBASE_CONFIG` replaced
- `window.ADMIN_PASSWORD` changed
- Default seller contact updated
- Test item created successfully
- `window.ASSET_VERSION` bumped before deploy

## License

MIT
