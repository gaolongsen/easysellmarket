# EasySellMarket

[中文说明 / Chinese Version](./README.zh-CN.md)

A lightweight single-page secondhand marketplace for small trusted communities. It is designed to be deployed as a static site on GitHub Pages, with Firebase Firestore as the backend.

## Features

- Mobile-first responsive UI
- Item gallery with client-side image compression
- Item comments and buyer queue
- Hidden admin dashboard at `#/admin`
- Publisher flow with invite/serial codes at `#/publish`
- Admin-managed publisher code activation/deactivation
- Simple cache-busting via `window.ASSET_VERSION`

## Tech Stack

- Frontend: plain HTML, CSS, and JavaScript
- Routing: hash routing
- Backend: Firebase Firestore
- Hosting: GitHub Pages

## Project Structure

```text
.
|-- index.html          # Layout, styles, Firebase config, asset version
|-- app.js              # App logic, routing, Firestore integration
|-- README.md           # English documentation
`-- README.zh-CN.md     # Chinese documentation
```

## Quick Start

### 1. Create a Firebase project

1. Go to <https://console.firebase.google.com>.
2. Create a new project.
3. Enable `Firestore Database`.
4. Create a Web app in the Firebase project settings.
5. Copy the generated `firebaseConfig`.

### 2. Configure the site

Edit `index.html` and update:

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

### 3. Run locally

You can open `index.html` directly, but a local static server is more reliable:

```powershell
cd d:\GitHub\easysellmarket
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

## Routes

- `#/` home page
- `#/item/<itemId>` item detail page
- `#/admin` admin dashboard
- `#/publish` publisher login and publishing center

## Admin and Publisher Model

### Admin

- Can create, edit, and delete any item
- Can manage buyer queues
- Can manage publisher serial codes
- Can access comment contact details

### Publisher

- Must log in with a valid serial code
- Must provide a display name and contact info
- Can publish items under their own code
- Can edit and delete only their own items

## Publisher Code Management

Publisher codes are supported in two layers:

1. `window.PUBLISHER_CODES` in `index.html`
   Use this as a fallback/default list.
2. Firestore `publisherCodes` collection
   This is the dynamic list managed from the admin dashboard.

Once you start managing codes in the admin panel, the Firestore list becomes the primary source.

## Cache Busting

To reduce stale mobile and WeChat in-app browser caches, the site loads `app.js` with a version query string.

Update this value in `index.html` whenever you deploy frontend changes:

```js
window.ASSET_VERSION = "2026-04-17-2";
```

That forces clients to request a fresh `app.js` bundle.

## Firestore Shape

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

## Notes

- This is still a static frontend app, not a hardened auth system.
- Admin password and Firebase config are exposed client-side.
- For real security, move permissions to Firebase Auth and Firestore rules.

## License

MIT
