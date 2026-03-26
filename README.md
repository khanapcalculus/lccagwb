# LCC AGW — Interactive Whiteboard Platform

A full-stack educational platform with **real-time collaborative whiteboard**, multi-role dashboards, and session scheduling.

[![Deploy to Firebase](https://img.shields.io/badge/Frontend-Firebase_Hosting-orange?logo=firebase)](https://lccagwb.web.app)
[![Deploy to Render](https://img.shields.io/badge/Backend-Render.com-46E3B7?logo=render)](https://render.com)

---

## 🏗️ Architecture

```
Firebase Hosting  → React/Vite Frontend (SPA)
Render.com        → Node.js + Socket.io Backend
Firebase Firestore → Database (sessions, users, whiteboards, activities)
Firebase Auth     → Authentication (Email/Password + Google)
```

---

## ✨ Features

### 🛡️ Admin Dashboard
- Live user management (view all users, change roles)
- Session analytics with Chart.js (line, bar, doughnut charts)
- Full activity log with real-time updates
- Platform-wide stats (users, sessions, whiteboards)

### 👨‍🏫 Tutor Dashboard
- Schedule sessions with students from a modal form
- Auto-generates a unique whiteboard room per session
- Manage sessions (complete / cancel)
- Browse all registered students
- Tabbed view: Upcoming / Completed / Cancelled

### 🎓 Student Dashboard
- View all upcoming and completed sessions
- "Next session" banner with one-click whiteboard join
- Sessions auto-update in real time via Firestore

### 🖊️ RTC Whiteboard
- **Tools**: Pen, Eraser, Line, Rectangle, Circle, Text
- **Colors**: 9 preset colours + custom colour picker
- **Stroke Widths**: 5 sizes
- Real-time multi-user sync via Socket.io
- Live cursor tracking for each participant
- Undo last stroke, Clear entire canvas
- Save canvas to Firestore cloud
- Export as PNG
- Participants panel with live join/leave

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project (already configured: `lccagwb`)

### 1. Clone the repo
```bash
git clone https://github.com/khanapcalculus/lccagwb.git
cd lccagwb
```

### 2. Install dependencies
```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 3. Configure environment variables

**Frontend** — edit `client/.env`:
```env
VITE_FIREBASE_API_KEY=AIzaSyBDNbwqs4kNScWE4hMsZkX3weUNWR3neoE
VITE_FIREBASE_AUTH_DOMAIN=lccagwb.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lccagwb
VITE_FIREBASE_STORAGE_BUCKET=lccagwb.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=478272248216
VITE_FIREBASE_APP_ID=1:478272248216:web:0f1b0d026ed87c4f63f3ed
VITE_SERVER_URL=http://localhost:5000
```

**Backend** — copy `server/.env.example` to `server/.env` and fill in your Firebase Admin SDK credentials:
```bash
cd server
cp .env.example .env
# Then edit .env with your service account values
```
> Get the service account JSON from: Firebase Console → Project Settings → Service Accounts → Generate new private key

### 4. Run locally (both terminals)
```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

Open http://localhost:5173

---

## 🌐 Deployment

### Frontend → Firebase Hosting
```bash
# Build the frontend
cd client && npm run build

# Deploy to Firebase
cd ..
firebase login
firebase deploy --only hosting
```
Live at: https://lccagwb.web.app

### Backend → Render.com
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo: `https://github.com/khanapcalculus/lccagwb.git`
3. Set **Root Directory** to `server`
4. **Build Command**: `npm install`
5. **Start Command**: `node index.js`
6. Add environment variables in the Render dashboard (from `server/.env.example`)
7. Once deployed, update `VITE_SERVER_URL` in `client/.env` with your Render URL, then redeploy Firebase.

> **Tip**: The `render.yaml` in the root directory will auto-configure the service if you use Render's Blueprint feature.

### Firestore Rules & Indexes
```bash
firebase deploy --only firestore
```

---

## 📁 Project Structure

```
lccagwb/
├── server/                    # Node.js + Express + Socket.io
│   ├── index.js               # Server entry point
│   ├── firebase-admin.js      # Firebase Admin SDK
│   ├── middleware/auth.js     # Token verification
│   ├── routes/
│   │   ├── sessions.js        # Session CRUD API
│   │   ├── analytics.js       # Admin analytics API
│   │   └── whiteboard.js      # Whiteboard room API
│   ├── socket/whiteboard.js   # Socket.io real-time events
│   └── .env.example
│
├── client/                    # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx            # Router + role guards
│   │   ├── firebase.js        # Firebase client SDK
│   │   ├── contexts/AuthContext.jsx
│   │   ├── hooks/useSocket.js
│   │   ├── components/        # Navbar, Sidebar, SessionCard, ActivityFeed
│   │   ├── pages/
│   │   │   ├── Login.jsx / Register.jsx
│   │   │   ├── admin/AdminDashboard.jsx
│   │   │   ├── tutor/TutorDashboard.jsx
│   │   │   ├── student/StudentDashboard.jsx
│   │   │   └── whiteboard/WhiteboardPage.jsx
│   │   └── styles/globals.css
│   └── .env
│
├── firebase.json              # Firebase Hosting config
├── .firebaserc                # Firebase project alias
├── firestore.rules            # Security rules
├── firestore.indexes.json     # Composite indexes
└── render.yaml                # Render.com deployment config
```

---

## 🔐 Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `users` | User profiles (uid, displayName, role, email) |
| `sessions` | Scheduled sessions (tutor, student, time, status, whiteboardRoomId) |
| `whiteboards` | Whiteboard rooms (canvasData, participants) |
| `activities` | Platform activity log (type, userId, metadata, timestamp) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (custom dark design system) |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| Realtime | Socket.io |
| Backend | Node.js + Express |
| Charts | Chart.js + react-chartjs-2 |
| Routing | React Router v6 |
| Frontend Deploy | Firebase Hosting |
| Backend Deploy | Render.com |
