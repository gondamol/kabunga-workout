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
- **Evidence-based method**: In-app Training Science page links core peer-reviewed studies behind programming choices

---

## Coach Hub (Remote Coaching Guide)

### How to use it
1. Open **Coach Hub** from the bottom nav or Profile.
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
