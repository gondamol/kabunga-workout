# Kabunga Workout — Agent Notes

## Dev Commands

```bash
# Local exercise proxy (required for exercise search)
npm run dev:exercise-proxy   # starts on port 8787

# Then in another terminal
npm run dev                  # Vite dev server on port 5173

# Production build
npm run build                # tsc && vite build
```

## TypeScript

- Config: `tsconfig.json` with `noUnusedLocals: false` and `noUnusedParameters: false` — do not add `--noUnusedLocals` or `--noUnusedParameters` to tsc commands
- Type check: `npx tsc --noEmit`

## Deployment

- Vercel auto-deploys on push to `main` via GitHub integration
- `.env` is gitignored — Vercel env vars must be set manually in Vercel dashboard
- After pulling code with Firestore rule changes: `npx firebase-tools deploy --only firestore:rules --project kabunga-workout-7e5aa`

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind v4 |
| State | Zustand (localStorage persistence) |
| Backend | Firebase Auth + Firestore |
| Media | Supabase Storage |
| PWA | vite-plugin-pwa + Workbox (`registerType: 'autoUpdate'`) |
| Exercise API | Vercel serverless route `/api/exercises/*` + local proxy script |

- `api/exercises/[...route].js` — Vercel serverless handler (production)
- `scripts/dev-exercise-proxy.mjs` — local dev proxy (reads `server.env`)
- Vite proxies `/api/exercises/*` → `http://127.0.0.1:8787` in dev

## Firestore Collections

`users`, `workouts`, `challenges`, `meals`, `coachCodes`, `coachAthletes`, `coachPlans`, `communityGroups`, `communityInvites`, `communityMessages`, `oneRepMaxes`, `fitnessDailies`

## Key Files

- `src/App.tsx` — routing entry point
- `src/stores/workoutStore.ts` — workout/timer state
- `src/stores/authStore.ts` — auth state
- `src/lib/firebase.ts` — Firebase init
- `src/lib/firestoreService.ts` — Firestore operations
- `vite.config.ts` — PWA + chunk splitting (vendor-react, vendor-firebase, vendor-charts)

## Credentials

Credentials are in `.env` and `readme_local.md` (both gitignored). Never commit these.

## Private Files

`.env`, `readme_local.md`, `IMPLEMENTATION_PLAN.md`, `.agent/`
