# 🏋️ Kabunga Workout — PWA

**Track workouts, crush challenges, fuel your body, share victories.**

A production-ready Progressive Web App for workout tracking, nutrition logging, and social sharing. Built mobile-first for everyday gym users.

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 (mobile-first) |
| **State** | Zustand (persisted) |
| **Backend** | Firebase (Auth + Firestore + Storage) |
| **PWA** | vite-plugin-pwa + Workbox |
| **Charts** | Recharts |
| **Camera** | react-webcam + MediaRecorder API |
| **Sharing** | Web Share API + clipboard fallback |
| **Dates** | Day.js |

---

## 📁 Project Structure

```
kabunga-workout/
├── public/
│   ├── icons/            # PWA icons
│   └── favicon.svg
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── BottomNav.tsx
│   │   ├── InstallPrompt.tsx
│   │   └── OfflineBanner.tsx
│   ├── lib/              # Core utilities
│   │   ├── firebase.ts         # Firebase init + offline persistence
│   │   ├── firestoreService.ts # CRUD operations
│   │   ├── offlineQueue.ts     # IndexedDB queue for offline
│   │   ├── types.ts            # TypeScript models
│   │   ├── constants.ts        # Exercise library, presets
│   │   └── utils.ts            # Formatting, compression, sharing
│   ├── pages/            # Route pages
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── WorkoutPage.tsx
│   │   ├── ActiveWorkoutPage.tsx
│   │   ├── ChallengesPage.tsx
│   │   ├── NutritionPage.tsx
│   │   └── ProfilePage.tsx
│   ├── stores/           # Zustand state
│   │   ├── authStore.ts
│   │   └── workoutStore.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── firestore.rules       # Firestore security rules
├── storage.rules         # Storage security rules
├── .env.example          # Environment template
└── vite.config.ts        # Vite + PWA + Tailwind config
```

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd kabunga-workout
npm install
```

### 2. Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password + Google)
3. Create **Firestore Database** (production mode)
4. Enable **Storage**
5. Copy your config values

### 3. Environment Variables

```bash
cp .env.example .env
# Edit .env with your Firebase credentials
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
npm run preview
```

### 6. Deploy

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

---

## 🔥 Features

### Authentication
- Email/password sign up & sign in
- Google OAuth login
- Persistent sessions
- Protected routes

### Workout Tracking
- One-tap "Start Workout" — timestamp recorded
- Real-time timer display
- Add exercises (sets × reps × weight)
- Auto-save via Zustand persistence (survives crashes)
- End workout → duration calculated, calories estimated
- Full session stored in Firestore

### Camera Integration
- In-workout camera (rear-facing)
- Photo capture with WebP compression
- Video recording (30s max)
- Media attached to workout document
- Compressed before upload

### Challenge System
- Weekly / Monthly / Yearly challenges
- Quick templates (e.g., "12 Workouts This Month")
- Auto progress tracking from actual workout data
- Visual progress bars
- Completed/Active/Expired categorization

### Nutrition Tracking
- Log meals manually or from presets
- Track calories + protein + carbs + fat
- Daily summary with macro pie chart
- Date navigation
- Meal type categorization

### Dashboard
- Workout frequency chart (7-day bar)
- Current streak counter
- Total training time this month
- Estimated calories burned
- Challenge progress bars
- Nutrition daily summary
- Recent sessions list

### Social Sharing
- Auto-generated workout summary text
- Native share sheet (Web Share API)
- Fallback to clipboard copy
- Shareable stats & achievements

### Offline Support
- Firestore offline persistence (IndexedDB)
- Zustand persisted state (localStorage)
- Custom offline queue for writes
- Auto-sync on reconnection
- Visual offline banner

---

## 🗃️ Firestore Data Models

### `users/{userId}`
```json
{
  "uid": "abc123",
  "email": "user@example.com",
  "displayName": "Jane Doe",
  "photoURL": null,
  "createdAt": 1708300000000,
  "updatedAt": 1708300000000
}
```

### `workouts/{workoutId}`
```json
{
  "id": "w_abc123",
  "userId": "abc123",
  "startedAt": 1708300000000,
  "endedAt": 1708303600000,
  "duration": 3600,
  "exercises": [
    {
      "id": "e1",
      "name": "Bench Press",
      "sets": [
        { "id": "s1", "reps": 10, "weight": 60, "completed": true },
        { "id": "s2", "reps": 8, "weight": 70, "completed": true }
      ],
      "notes": ""
    }
  ],
  "mediaUrls": ["https://storage.../photo1.webp"],
  "caloriesEstimate": 420,
  "notes": "",
  "status": "completed",
  "createdAt": 1708300000000,
  "updatedAt": 1708303600000
}
```

### `challenges/{challengeId}`
```json
{
  "id": "ch_abc",
  "userId": "abc123",
  "title": "12 Workouts This Month",
  "period": "monthly",
  "targetCount": 12,
  "currentCount": 7,
  "startDate": 1706745600000,
  "endDate": 1709424000000,
  "completed": false,
  "createdAt": 1706745600000
}
```

### `meals/{mealId}`
```json
{
  "id": "m_abc",
  "userId": "abc123",
  "name": "Chicken Breast",
  "calories": 165,
  "protein": 31,
  "carbs": 0,
  "fat": 3.6,
  "date": "2025-02-18",
  "mealType": "lunch",
  "createdAt": 1708300000000
}
```

---

## 🔐 Security

- **Firestore rules:** Users can only read/write their own documents
- **Storage rules:** 10MB per-file upload limit, user-scoped paths
- **Auth:** Firebase Auth handles session tokens
- **No secrets in client code** — Firebase config is safe to expose (rules do enforcement)

---

## 📈 Scalability (50k+ Users)

| Area | Strategy |
|------|----------|
| **Firestore** | Composite indexes, query by userId, limit results |
| **Storage** | Lazy loading, WebP compression, CDN serving |
| **Auth** | Firebase handles scale natively |
| **Frontend** | Code splitting, lazy routes, optimistic UI |
| **Caching** | Workbox runtime caching, stale-while-revalidate |
| **Cost** | Firestore free tier: 50k reads/day, 20k writes/day |

---

## 🗺️ Future Roadmap

1. **AI Coach** — GPT-powered workout suggestions based on history
2. **Wearable Integration** — Google Fit / Apple Health sync
3. **Social Feed** — Follow friends, public challenge leaderboards
4. **Exercise Library** — Video demos, muscle group targeting
5. **Progressive Overload Tracking** — Volume charts, PR alerts
6. **Barcode Nutrition Scanner** — Scan food packaging
7. **Workout Templates** — Save & reuse routines
8. **REST Timer** — Configurable rest countdown between sets

---

## 📄 License

MIT
