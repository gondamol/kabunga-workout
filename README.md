# Kabunga Workout

A personal gym companion app I built for myself — designed to make my actual workouts faster and smarter.

---

## What it does

Kabunga is a **Progressive Web App (PWA)** that acts as your real-time workout guide in the gym.

- **Plan before you go**: Add your exercises (warmup, main lifts, cooldown), set the number of sets, reps, and weight for each one
- **Guided session**: When you tap Start, it walks you through one exercise at a time — you just do the work and tap Next
- **Bodyweight-friendly**: Exercises like push-ups, breathing drills, or stretches don't need a weight — just leave it blank
- **Rest timer**: Counts down between sets so you don't have to guess when to go again
- **Full history**: Every session is saved so you can look back at what you've done
- **Works offline**: You can use it at the gym even without a signal
- **Coach Hub**: Coaches can assign plans remotely and athletes can load them directly into Workout Planner
- **Community**: Group spaces for accountability chats and coach-led circles
- **Exercise search + demos**: Workout builder now supports enriched exercise search with GIF previews and fallback to Kabunga's local library
- **Evidence-based method**: In-app Training Science page links core peer-reviewed studies behind programming choices

---

## Coach Hub (Remote Coaching Guide)

### How to use it
1. Open **Coach Hub** from **Profile**.
2. If you are coaching, switch role to **Coach**. This generates your coach code.
3. Share your code with your athlete.
4. Athlete switches/stays on **Athlete**, enters code, taps **Connect**.
5. Coach selects athlete, creates a plan (date, title, notes, exercises with sets/reps/weight/rest), then taps **Assign Plan**.
6. Athlete opens **Assigned Plans** and taps **Load In Workout Planner**.
7. In **Workout**, the plan loads with coach targets and notes.
8. After completion, the plan status updates to **Completed** for both athlete and coach.
9. Coach can open **Planned Sessions** and tap the edit icon to update date/title/notes/exercises, then save.
10. Coaches can create groups in **Community**, copy/share invite code, add connected athletes, and regenerate code when needed.

### Notes
- `Weight = 0` means bodyweight.
- Athletes can adjust targets before pressing **Start Workout**.
- As the athlete trains, coach view refreshes and shows live plan progress (sets completed).
- Coaches can plan faster with:
  - **Planning Calendar** (tap a date quickly)
  - **Week Planner** (assign selected weekdays in one action)
- Missed scheduled plans show as **Incomplete (Missed)**.
- Athletes can open calendar days in Coach Hub to view and prepare for a specific session.
- Templates are now loaded directly inside **Workout** via **Add From Template**.
- Coaches can edit assigned plans from the coach-side **Planned Sessions** list.
- Private groups support invite-code joining.

### Community troubleshooting
If Community shows **"Could not load community groups"**:
1. Deploy latest Firestore rules:

```bash
npx firebase-tools deploy --only firestore:rules --project kabunga-workout-7e5aa
```

2. Sign out and sign back in.
3. In Community page, tap **Refresh**.

### Community roadmap (next phase)
- Group channels are live with private/public coach groups and member chat.
- Next upgrades:
  - pinned resources
  - threaded replies
  - group challenges / leaderboards
  - moderation roles and reporting

### Firebase setup required (important)
Coach Hub uses Firestore collections:
- `coachCodes`
- `coachAthletes`
- `coachPlans`
- `communityGroups`
- `communityMessages`

After pulling new code, deploy Firestore rules so role switching and coach linking can work:

```bash
npx firebase-tools deploy --only firestore:rules --project kabunga-workout-7e5aa
```

If this is skipped, coach role switch/connect can fail with permission errors.

---

## Exercise API Setup (API Ninjas + Free Backend)

Kabunga does **not** call paid or rate-limited exercise APIs directly from the browser. The server-side exercise provider key stays in backend env vars, and the frontend only talks to `/api/exercises`.

### 1. Fix the RapidAPI account state
1. Regenerate your RapidAPI key if you have pasted or screenshotted it anywhere public.
2. If you have a direct API Ninjas key, use that first.
3. If you prefer RapidAPI for exercises later, Kabunga still supports it as a fallback provider.
4. `Muscle Group Image Generator` is optional. Kabunga now ships with a free local muscle-focus visual, so you do not need this second API unless you specifically want its generated images later.

### 2. Configure env vars
For local development:
1. Copy [server.env.example](./server.env.example) to `server.env`.
2. Set your real key in `server.env`.

For production on Vercel:
1. Add the same env vars in the Vercel project settings.
2. Do not expose them as `VITE_*` vars.

```bash
API_NINJAS_API_KEY=your-api-ninjas-key
RAPIDAPI_KEY=your-real-rapidapi-key-if-you-use-rapidapi
RAPIDAPI_EXERCISES_HOST=exercises-by-api-ninjas.p.rapidapi.com
RAPIDAPI_EXERCISES_BASE_URL=https://exercises-by-api-ninjas.p.rapidapi.com
RAPIDAPI_EXERCISES_SEARCH_PATH=/v1/exercises
RAPIDAPI_MUSCLE_IMAGE_HOST=muscle-group-image-generator.p.rapidapi.com
RAPIDAPI_MUSCLE_IMAGE_BASE_URL=https://muscle-group-image-generator.p.rapidapi.com
RAPIDAPI_MUSCLE_IMAGE_PATH=/getDualColorImage
```

In the frontend env, keep:

```bash
VITE_ENABLE_REMOTE_MUSCLE_IMAGE_PROVIDER=false
```

### 3. Local development
```bash
npm run dev:exercise-proxy
npm run dev
```

### 4. Deploy to Vercel
```bash
npx vercel --prod
```

Note:
- The repo now includes a Vercel serverless proxy at `api/exercises/[...route].js`, so you do not need Firebase Functions for exercise search.
- Firebase Functions deployment on this project is still blocked by the Blaze requirement, but it is no longer the recommended production path for the exercise proxy.

### 5. Verify the live proxy
Replace `<your-hosting-url>` with the deployed site URL.

```bash
curl "https://<your-hosting-url>/api/exercises/search?q=bench&limit=5"
curl -I "https://<your-hosting-url>/api/exercises/muscle-image?primary=chest"
```

Expected result:
- `/api/exercises/search` returns JSON results from API Ninjas or RapidAPI `Exercises by API-Ninjas`, merged with local fallback names.
- `/api/exercises/muscle-image` is optional and only needed if you later enable the premium image provider.

### 6. Optional frontend override
`VITE_EXERCISE_API_BASE_URL` already defaults to `/api/exercises`, so you usually do not need to change the frontend env.

### Current implementation status
See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for what is done, what still needs setup, and what remains pending.

---

## Install on your phone

> No app store needed. It installs directly from the browser.

### Android (Chrome)
1. Open the app link in **Chrome**
2. Tap the **three-dot menu** (top right)
3. Tap **"Add to Home screen"**
4. Tap **Add** — it will appear on your home screen like a normal app

### iPhone (Safari)
1. Open the app link in **Safari** *(must be Safari, not Chrome)*
2. Tap the **Share button** (the box with an arrow at the bottom)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add** — it will appear on your home screen

> Once installed, the app updates itself automatically in the background whenever there's a new version.

---

*Built for personal use. Not for distribution.*
