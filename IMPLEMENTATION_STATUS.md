# Kabunga Implementation Status

## Done
- [x] Move `Coach/Athletes` access under Profile and remove it from bottom navigation
- [x] Add visible `Performance / 1RM` management in Profile
- [x] Add home prompt for 1RM retest with 7-day snooze
- [x] Re-scale future Iron template loads from latest 1RM values
- [x] Add exercise catalog client with debounce, local fallback, and enriched picker UI
- [x] Support direct `API Ninjas` exercise access with RapidAPI fallback
- [x] Add free local muscle-focus visuals for exercise previews
- [x] Keep `Muscle Group Image Generator` support optional for later
- [x] Move production exercise proxy off Firebase Functions to a Vercel serverless route
- [x] Add smart progression insights in Dashboard, Workout planner, and Active Workout
- [x] Tighten mobile UX for exercise picker and exercise detail sheets
- [x] Verify live `Exercises by API-Ninjas` search responses against RapidAPI
- [x] Add a neutral local `server.env` path for the exercise proxy

## Needs Setup
- [x] Deploy the app to Vercel with `API_NINJAS_API_KEY` configured
- [x] Runtime verification of the deployed Vercel `/api/exercises/*` routes

## Still Pending
- [ ] Group challenges / leaderboards in Community
- [ ] Nutrition and recovery recommendations tied to training readiness
- [ ] Moderator / reporting tools for community spaces
