# Kabunga Premium Mobile Redesign Design

## Status

Review stage. This document locks the Phase 2/3 product strategy and design-system direction before implementation. It is intentionally scoped as a staged redesign of the existing app, not a rebuild.

## Inputs

- Repository audit of `src/App.tsx`, `src/index.css`, `src/pages/*`, `src/components/*`, `src/stores/*`, `src/lib/*`, `README.md`, `IMPLEMENTATION_STATUS.md`, `AGENTS.md`, `vite.config.ts`, and `package.json`.
- Local mockups in `mockups/`, used as visual inspiration for mobile structure, rings, cards, spacing, and flow.
- Existing Kabunga specs from April 19, 2026 for the light shell reset and market positioning.
- AIDesigner reference board: https://aidesigner.ai/editor/1d328a67-2234-4843-bb9f-5ab4d6625220
- Generated AIDesigner image reference: https://cdn.aidesigner.ai/image-generations/cc69cf58ba2fb027/b229b6de-7040-47ae-8ae9-b52263e9f80e.webp
- Official references checked for constraints:
  - Material 3 color roles: https://m3.material.io/styles/color/roles
  - Material 3 motion: https://m3.material.io/styles/motion/overview
  - Material 3 navigation bar: https://m3.material.io/components/navigation-bar/overview
  - Core Web Vitals: https://web.dev/articles/vitals
  - WCAG 2.2 target size minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  - Apple activity rings HIG reference, used only as a reminder not to clone proprietary patterns: https://developer.apple.com/design/human-interface-guidelines/activity-rings

## Product Positioning

Kabunga should be positioned as:

> An offline-first, coach-friendly, readiness-aware workout companion for people who want simple, consistent, evidence-based training without needing expensive wearables or gym subscriptions.

The product should make the user feel:

- I know what to do today.
- I can start quickly.
- My coach can guide me without seeing private notes.
- My progress is visible.
- The app works even with bad internet.
- I am encouraged, not judged.

This direction fits the existing feature set better than a generic fitness tracker. Kabunga already has workout planning, active sessions, readiness checks, coach plans, community, science content, offline queueing, nutrition, and progression. The redesign should connect those strengths around a daily training decision instead of treating each page as a separate tool.

## Recommended Approach

Use a phased native redesign, not a visual skin or a full rewrite.

1. **Recommended: design-system first, page-by-page adoption.** Build tokens and primitives, then migrate onboarding, dashboard, workout, active workout, history, coach/community, and recovery surfaces in stages. This protects existing Firebase, Zustand, PWA, exercise API, and offline logic while giving the app a coherent premium identity.
2. **Rejected: one massive visual rewrite.** It would produce faster screenshots but raises the risk of breaking coach plans, workout persistence, offline behavior, and data contracts.
3. **Rejected: isolated page polish only.** It would improve a few screens but leave repeated cards, inconsistent loading states, and jarring navigation transitions.

## Design Principles

- **Today first.** The dashboard becomes the emotional center of the app and answers what to do next before showing secondary metrics.
- **One primary action.** On every screen, the main action should be obvious: start today, repeat last, finish a set, save a plan, join a group, or review progress.
- **Recovery counts.** Low readiness should suggest lighter alternatives instead of implying failure.
- **Coach-safe by default.** Coach-facing surfaces should clearly show summaries and trends, not raw private body metrics or pain notes.
- **Offline is a product feature.** Bad internet gym mode, sync pending, and local fallbacks should be visible and reassuring.
- **Premium through restraint.** Use clean surfaces, purposeful color, stable spacing, strong numbers, and high contrast. Avoid loud gradients, decorative blobs, fake marketing panels, and generic stock-fitness styling.
- **Mobile first, desktop respectful.** The app should feel native on a 390px phone and still organized on wider screens.

## Visual System

### Color Roles

Keep the current green health identity, but formalize it into semantic roles:

- `primary`: deep forest green for brand, trust, primary CTA, and selected nav.
- `secondary`: fresh lime for activity, streaks, weekly progress, and positive momentum.
- `tertiary`: calm blue for recovery, readiness science, privacy, and coach-safe education.
- `accent`: warm amber for strength, progression, PRs, and effort.
- `danger`: red only for destructive actions, true warnings, and end-workout confirmation.
- `success`, `warning`, `info`: semantic feedback roles, not decoration.
- `surface`, `surface-container`, `surface-container-high`: layered neutral surfaces for cards, sheets, and navigation.
- `outline`, `outline-strong`, `muted`: borders, dividers, disabled states, and helper text.

Dark mode should not be a separate visual product. It should reuse the same semantic roles with darker surfaces and stronger contrast, especially for active workout.

### Typography

Continue with Manrope/Outfit unless testing shows a measurable font-loading issue. The hierarchy should become more deliberate:

- Dashboard greeting: large, confident, one or two lines.
- Section headings: compact and scannable.
- Metric numbers: visually satisfying, tabular where useful, large enough to read while moving.
- Body copy: short, warm, and practical.
- Buttons and chips: concise labels with icons where helpful.

No text should rely on viewport-width font scaling. Compact panels should use compact type, not hero-sized text.

### Shape, Shadow, And Spacing

- Cards: rounded but disciplined, usually 16-24px on mobile content cards and 8px or less for dense controls when appropriate.
- Icon buttons and touch targets: minimum 44px target size.
- Bottom navigation: fixed, safe-area aware, soft container, clear selected state.
- Page sections: full-width bands or unframed layouts; avoid cards inside cards.
- Shadows: subtle elevation for actionable surfaces, not heavy floating effects.
- Spacing: 16px page gutters on small phones, 20-24px on larger mobile, constrained center column on desktop.

### Motion

- Add subtle route/page entrance transitions, card entrances, button press feedback, and animated rings.
- Active workout transitions should help users understand set/rest/exercise changes.
- Completion celebration should be quick, warm, and dismissible.
- Respect `prefers-reduced-motion`; reduced motion should remove entrance and ring animations without removing information.

## Core Primitives

Create or refactor reusable primitives rather than styling each page independently.

- `AppShell`: page frame, safe-area spacing, offline/update/install banners, bottom nav, and route loading boundary.
- `PageHeader`: title, date/subtitle, optional actions, back affordance.
- `SectionHeader`: compact section title, optional action.
- `MetricCard`: one metric with label, value, delta, icon, and tone.
- `ProgressRing`: generic SVG ring with accessible label and reduced-motion support.
- `ActivityRing`: composed rings for weekly progress/readiness/activity without cloning proprietary ring styling.
- `InsightCard`: short recommendation with tone, source, and action.
- `WorkoutCard`: reusable planned/recent/repeat/coach workout card.
- `ExerciseCard`: planner and search result exercise card with metadata and modification slots.
- `ActionButton`: primary/secondary/destructive/loading button with icon and touch target guarantees.
- `EmptyState`: illustration/icon, title, useful next action, optional secondary action.
- `SkeletonCard`: stable loading placeholder matching final layout dimensions.
- `LoadingScreen`: route-level fallback with brand mark and short status.
- `ErrorState`: useful error, retry action, and offline explanation when relevant.
- `BottomSheet`: mobile sheet with focus management, escape/backdrop close, and safe area.
- `SegmentedControl`: tabs/modes for workout sections, filters, and role switching.
- `StatChip`: compact icon+metric chip.
- `CoachCard`: coach code, athlete, assigned plan, or privacy summary card.
- `ReadinessCard`: no-wearable readiness score, contributors, guidance, and check-in CTA.
- `RecoveryGuidanceCard`: recovery action alternatives connected to readiness and nutrition.

These primitives should be introduced gradually. Existing page logic should be kept in place and moved behind primitives only when the behavior is understood.

## Page Designs

### Onboarding

Replace the current long setup form with a guided mobile-first flow. It should save partial progress locally and persist the final profile through the existing auth/profile path.

Screens:

- Welcome and privacy promise.
- Goal: build strength, lose fat, general fitness, mobility, consistency, mental wellness.
- Level: beginner, intermediate, advanced.
- Training context: home, gym, outdoor, mixed.
- Equipment: none, dumbbells, bands, barbell/gym, mixed.
- Time available: 5, 10, 20, 30, 45+ minutes.
- Days per week.
- Coach mode: alone, with coach, I am a coach.
- Optional limitation: injury, pain, or mobility limitation.
- Preferred style: simple, structured, intense, gentle, progressive.
- Final plan-ready summary.

The implementation must preserve compatibility with existing profile setup fields. New preferences can be added as optional profile fields with defaults, not as required breaking migrations.

### Dashboard Today

The dashboard becomes a Today surface:

- Greeting and current date.
- Offline/sync status when relevant.
- Readiness summary with score, contributors, and no-wearable framing.
- Today’s recommended action based on active workout, coach plan, recent history, readiness, and profile goal.
- Start/resume workout CTA.
- Repeat last workout fast lane.
- Weekly progress ring and consistency streak.
- Recent workout summary.
- Smart insight from readiness/history/progression.
- Recovery or nutrition nudge.
- Coach/community shortcut.

States to design explicitly:

- New user with no workouts.
- User with active workout.
- User with recent workout history.
- User with coach plan.
- User offline.
- User with low readiness.
- User with strong readiness.

### Workout Planner

The planner should feel like assembling a session, not filling out a database form.

- Top quick lanes: repeat last, start quick session, start from coach plan.
- Clear warmup/main/cooldown structure via segmented control or grouped sections.
- Exercise search as a prominent sheet or panel with filter chips and no-results state.
- Exercise cards showing sets, reps, weight, rest, bodyweight label when weight is `0`, and beginner modification when available.
- Template shortcuts without hiding manual planning.
- Review/start CTA fixed near the bottom on mobile when a workout has content.

Preserve exercise API proxy behavior, local fallback search, bodyweight logic, coach plan linking, and repeat-last semantics.

### Active Workout

The active session should be dark, focused, and hard to misuse when tired.

- One primary exercise display.
- Current set progress and total workout progress.
- Big timer or rest ring depending on state.
- Next exercise preview.
- Large complete-set and rest controls.
- Pause/resume and finish as clear secondary/destructive actions.
- Minimal but available notes, media upload, coach plan progress, and history/progression context.
- Completion celebration that saves progress and makes sharing optional.

The existing timer, persistence, rest, offline save fallback, Supabase media upload, haptics/audio cues, Iron progression, and coach plan progress logic must remain intact.

### Progress And History

Progress should make consistency visible without creating shame.

- Weekly sessions.
- Monthly minutes.
- Streak.
- Volume trend.
- Top exercises.
- Recent workouts.
- PRs.
- Readiness trend.
- Coach-plan completion.
- Challenge progress.

Charts should be lazy-loaded where practical, use stable container heights, readable mobile labels, and skeletons to prevent layout shift.

### Coach Hub And Community

Coach Hub and Community are differentiators, so the redesign should clarify hierarchy without reducing capability.

- Role switch clarity for coach/athlete/member modes.
- Coach code card with share/copy state.
- Assigned plan and planned session cards.
- Athlete readiness summaries with privacy framing.
- Coach-safe privacy explanation in plain language.
- Community group cards with group health, challenge, and invite status.
- Challenge/leaderboard cards with clear current-user state.
- Moderation/reporting states that feel serious but not alarming.

Privacy rule: coaches see summaries and trends; they do not see private body metrics or raw pain notes.

### Nutrition And Recovery

Nutrition should support readiness and recovery instead of feeling isolated.

- Today’s nutrition summary.
- Recovery recommendation.
- Protein, hydration, and simple meal nudges where currently supported.
- Low-readiness alternatives: mobility, light walk, stretching, breathing, rest day.
- Copy should avoid shame, diet-culture framing, and guilt.

### Science And Iron Protocol

Science should become a calm evidence library connected to decisions in the app. Iron Protocol can keep a stronger performance personality, but it should use the shared token system and avoid looking like a separate app.

## Loading, Empty, Error, And Offline States

Add consistent states for:

- Route loading.
- Button loading.
- Empty dashboard.
- Empty workout history.
- Empty community.
- Empty coach plan.
- Exercise search no results.
- Offline banner and sync pending.
- Profile load error.
- Generic retryable errors.

Every error state should say what happened, what the user can do, and whether offline mode explains the issue.

## Performance Strategy

- Keep route-level code splitting as a first implementation stage after the shell is stable.
- Lazy-load heavy chart pages/components.
- Avoid unnecessary Zustand timer subscriptions outside active workout.
- Keep skeletons dimensionally stable to protect CLS.
- Use CSS transitions instead of JS-heavy animation.
- Keep image dependencies optional and lazy-loaded.
- Preserve existing Vite/Vercel chunk compatibility.

Targets:

- LCP <= 2.5s.
- INP <= 200ms.
- CLS <= 0.1.
- Lighthouse Performance 90+.
- Accessibility 95+.
- Best Practices 95+.

## Accessibility And Mobile QA

- Minimum 44px touch targets.
- Visible focus states.
- Buttons and icon buttons have accessible names.
- Inputs have labels.
- Bottom sheets and dialogs are keyboard-friendly.
- Reduced motion support.
- Text remains readable on small phones.
- No horizontal overflow.
- Bottom nav respects safe area.
- PWA install/update flow remains available.

## Feature Protection Checklist

Implementation must not break:

- Firebase auth/profile loading and onboarding gate.
- Firestore data shape and privacy assumptions.
- Workout store persistence and active workout restore.
- Rest timer and elapsed timer behavior.
- Bodyweight behavior where `weight = 0`.
- Repeat-last-workout plan creation.
- Coach plan assignment/progress.
- Coach-safe readiness summaries.
- Community groups, invites, messages, challenges, and moderation.
- Offline queue and PWA behavior.
- Exercise API serverless route and local proxy.
- Supabase media upload in active workout.
- Iron Protocol scaling and fitness daily logging.

## Implementation Stages

Each stage should be committed separately and reviewed locally before push.

1. **Spec stage:** this document only.
2. **Design-system foundation:** tokens, shell refinements, focus/touch rules, loading/error primitives.
3. **Reusable UI primitives:** rings, cards, buttons, sheets, segmented controls, empty/skeleton states.
4. **Onboarding redesign:** guided flow with partial progress and profile compatibility.
5. **Today dashboard redesign:** readiness, recommendations, repeat lane, weekly progress, empty/offline states.
6. **Workout planner and active workout redesign:** fast planning, exercise cards, focused session UI, celebration.
7. **Progress/history polish:** charts, streaks, PRs, recent workouts, history empty states.
8. **Coach/community polish:** role clarity, privacy summaries, group/challenge cards, moderation states.
9. **Nutrition/recovery/science/Iron polish:** recovery-linked nudges and shared visual system.
10. **Design prompt docs:** create `docs/design-image-prompts.md` for future generated assets.
11. **Performance and accessibility QA:** build, type check, validators, major route smoke checks, mobile overflow checks.

## Acceptance Criteria

- The app still supports all existing major routes: `/onboarding`, `/login`, `/`, `/workout`, `/active-workout`, `/history`, `/profile`, plus coach/community/nutrition/templates/challenges/science/Iron surfaces.
- The dashboard clearly answers: what should I do today, how ready am I, what is my progress this week, and what is the fastest next action.
- Onboarding feels like a guided product experience, not a long form.
- Active workout is dark, focused, readable, and touch-friendly.
- Offline, empty, loading, and error states are polished and useful.
- Coach privacy is visibly explained and preserved.
- Type check, build, and relevant validation scripts pass before final delivery.
- No push happens until local review is complete.
