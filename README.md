# 🏋️ Kabunga Workout — PWA

**Your real-time gym companion. Build your plan, start your session, get guided rep by rep.**

A production-ready Progressive Web App for guided workout sessions, progressive overload tracking, challenges, and workout history. Built mobile-first for everyday gym users — beginner to advanced.

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 (mobile-first) |
| **State** | Zustand (persisted to localStorage) |
| **Backend** | Firebase (Auth + Firestore) |
| **Media** | Supabase Storage (photos + videos) |
| **PWA** | vite-plugin-pwa + Workbox (autoUpdate) |
| **Charts** | Recharts |
| **Camera** | react-webcam + MediaRecorder API |
| **Sharing** | Web Share API + clipboard fallback |
| **Dates** | Day.js |

---

## 📁 Project Structure

```
kabunga-workout/
├── public/
│   ├── icons/                  # PWA icons (192, 512)
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── BottomNav.tsx        # Tab navigation
│   │   ├── RestTimer.tsx        # Animated rest countdown overlay
│   │   ├── InstallPrompt.tsx    # PWA install banner
│   │   └── OfflineBanner.tsx    # Offline/online indicator
│   ├── lib/
│   │   ├── firebase.ts          # Firebase init + offline persistence
│   │   ├── firestoreService.ts  # CRUD operations
│   │   ├── offlineQueue.ts      # IndexedDB queue for offline writes
│   │   ├── timerService.ts      # Web Audio beeps, vibration, overload engine
│   │   ├── templates.ts         # Built-in workout templates (PPL, Full Body…)
│   │   ├── types.ts             # TypeScript models
│   │   ├── constants.ts         # Exercise library, macros, presets
│   │   └── utils.ts             # Formatting, compression, sharing
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── WorkoutPage.tsx      # Exercise queue builder + history
│   │   ├── ActiveWorkoutPage.tsx # One-exercise-at-a-time guided session
│   │   ├── TemplatesPage.tsx    # Browse & start from templates
│   │   ├── ChallengesPage.tsx
│   │   ├── NutritionPage.tsx
│   │   └── ProfilePage.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── workoutStore.ts      # Session, timer, rest timer, guided nav
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── firestore.rules
├── storage.rules
├── .env.example
└── vite.config.ts
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
4. Deploy security rules: `firestore.rules`
5. Copy your config values

### 3. Environment Variables

```bash
cp .env.example .env
# Edit .env with your Firebase (and optional Supabase) credentials
```

Required:
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Optional (for in-workout photo/video capture + upload):
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 4. Run Development Server

```bash
npm run dev
# App available at http://localhost:5173
# Also accessible on your phone via the Network URL shown in the terminal
```

### 5. Build for Production

```bash
npm run build
npm run preview
```

---

## 🌐 Deployment (Vercel — Recommended)

1. Push code to GitHub
2. Connect the repo to [Vercel](https://vercel.com)
3. Add all `VITE_*` environment variables in the Vercel dashboard
4. Done — every `git push` to `main` auto-deploys

> **PWA note:** Because `registerType: 'autoUpdate'` is set in `vite.config.ts`, users with the app installed will receive the new version automatically the next time they open it — no manual refresh needed.

---

## 🔥 Features

### 🏋️ Guided Workout Sessions
- **Plan first, then start:** Build your exercise queue on the Workout tab, then hit Start
- **One exercise at a time:** Large, focused view — exercise name, target sets × reps, coaching cue
- **Progress strip:** One dot per exercise — green when complete, purple = current
- **Next / Prev navigation:** Swipe between exercises; app remembers your position
- **Rest timer:** Auto-starts after completing a set — countdown ring, ±15s adjust, skip
- **Add mid-workout:** Tap + at any time to insert a new exercise
- **Resume:** If you leave the app, your session and timer are preserved

### 📋 Workout Templates
- 7 built-in templates: PPL (Push/Pull/Legs), Full Body, Upper/Lower, HIIT
- Browse by category (Strength, Hypertrophy, Conditioning)
- One-tap start — exercises load directly into the guided session

### 📊 Exercise Tracking
- Sets × Reps × Weight per set
- RPE (1–10) rating per set
- Tap set number to mark complete → rest timer auto-starts
- Per-exercise coaching cues and notes

### 🎯 Challenge System
- Weekly / Monthly / Yearly challenges
- Quick templates ("12 Workouts This Month", etc.)
- Auto progress tracking from actual workout data
- Visual progress bars + completion detection

### 🍎 Nutrition Tracking
- Log meals by type (breakfast, lunch, dinner, snack)
- Track calories + protein + carbs + fat
- Daily macro summary + pie chart
- Date navigation

### 📈 Dashboard
- 7-day workout frequency bar chart
- Current streak, total training time, calories burned
- Active challenge progress
- Recent sessions list

### 📷 Camera (Supabase required)
- In-workout rear-facing camera
- Photo capture (WebP compressed)
- Video recording (30s max, WebM)
- Media attached to workout session

### 🔔 Real-Time Feedback
- Web Audio API beeps for rest countdown (3–1s)
- Vibration API haptics on set completion and rest end
- Toast notifications for key actions

### 📴 Offline Support
- Firestore offline persistence (IndexedDB)
- Zustand persisted state (localStorage — survives crashes)
- Custom offline action queue → auto-sync on reconnect
- Visual offline/online banner

---

## 🗃️ Firestore Data Models

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
      "plannedSets": 4,
      "plannedReps": 8,
      "plannedWeight": 80,
      "cue": "Retract scapula, full ROM",
      "sets": [
        { "id": "s1", "reps": 8, "weight": 80, "rpe": 8, "completed": true },
        { "id": "s2", "reps": 7, "weight": 80, "rpe": 9, "completed": true }
      ],
      "notes": ""
    }
  ],
  "mediaUrls": [],
  "caloriesEstimate": 420,
  "status": "completed",
  "templateId": null
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
  "completed": false
}
```

---

## 🔐 Security

- **Firestore rules:** Users can only read/write their own documents
- **Env vars:** All secrets in `.env` (gitignored) — set separately in Vercel dashboard
- **No secrets in source code** — Firebase client config is safe to expose (rules enforce access)

---

## �️ Roadmap

- [ ] Progressive overload suggestions (show "try +2.5kg" based on last session)
- [ ] Workout history calendar view + volume charts
- [ ] AI Coach — GPT-powered suggestions based on history
- [ ] Exercise video demos (muscle group targeting)
- [ ] Social feed — follow friends, challenge leaderboards
- [ ] Wearable integration — Google Fit / Apple Health
- [ ] Barcode nutrition scanner

---

## 📄 License

MIT
