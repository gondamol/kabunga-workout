# Kabunga Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved light-shell Kabunga redesign into the real React app, with today's plan prioritized on home, readiness compacted, and the shared shell updated across major surfaces.

**Architecture:** Start with a pure dashboard presentation helper and validation script so the home-page behavior changes are test-driven. Then update shared shell tokens and primitives in `src/index.css`, followed by targeted page rewrites for dashboard, auth, navigation, and the most visible supporting surfaces. Preserve existing business logic and offline behavior, changing presentation and hierarchy rather than data flow.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind v4, Zustand, Firebase, custom Node-based validation scripts, AIDesigner reference artifact

---

### Task 1: Add dashboard presentation helper with a failing validation

**Files:**
- Create: `src/lib/dashboardPresentation.ts`
- Create: `__tests__/dashboardPresentation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildDashboardPrimaryCard, buildReadinessStrip } from '../src/lib/dashboardPresentation.ts';
import type { HealthCheck, ReadinessScore, WorkoutSession } from '../src/lib/types.ts';

const buildWorkout = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'workout-1',
  userId: 'user-1',
  startedAt: Date.now(),
  endedAt: Date.now(),
  duration: 2400,
  caloriesEstimate: 320,
  exercises: [{
    id: 'exercise-1',
    name: 'Bench Press',
    sets: [],
  }],
  notes: '',
  ...overrides,
});

const buildReadiness = (overrides: Partial<ReadinessScore> = {}): ReadinessScore => ({
  athleteId: 'user-1',
  date: '2026-04-19',
  score: 7,
  status: 'good',
  warnings: [],
  recommendations: ['Train as planned'],
  updatedAt: 1,
  ...overrides,
});

const buildHealthCheck = (overrides: Partial<HealthCheck> = {}): HealthCheck => ({
  athleteId: 'user-1',
  date: '2026-04-19',
  sleepQuality: 4,
  soreness: 3,
  mood: 'normal',
  painNotes: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

// Expect active session to win the primary card.
const activeCard = buildDashboardPrimaryCard({
  activeSession: buildWorkout({ exercises: [{ id: 'exercise-1', name: 'Front Squat', sets: [] }] }),
  latestWorkout: null,
});

if (activeCard.title !== 'Resume today\'s workout' || activeCard.ctaLabel !== 'Resume workout') {
  throw new Error(`Unexpected active-session primary card: ${JSON.stringify(activeCard)}`);
}

// Expect latest workout fallback when no active session exists.
const repeatCard = buildDashboardPrimaryCard({
  activeSession: null,
  latestWorkout: buildWorkout(),
});

if (repeatCard.title !== 'Today\'s plan' || repeatCard.ctaLabel !== 'Start workout') {
  throw new Error(`Unexpected repeat-workout primary card: ${JSON.stringify(repeatCard)}`);
}

// Expect compact readiness copy when readiness exists.
const readinessStrip = buildReadinessStrip({
  readiness: buildReadiness(),
  healthCheck: buildHealthCheck(),
});

if (readinessStrip.label !== 'Readiness' || !readinessStrip.value.includes('7/10')) {
  throw new Error(`Unexpected readiness strip: ${JSON.stringify(readinessStrip)}`);
}

// Expect prompt copy when readiness is missing.
const missingStrip = buildReadinessStrip({
  readiness: null,
  healthCheck: null,
});

if (missingStrip.ctaLabel !== 'Add check-in' || missingStrip.tone !== 'empty') {
  throw new Error(`Unexpected missing readiness strip: ${JSON.stringify(missingStrip)}`);
}

console.log('Dashboard Presentation Validation: 4 passed, 0 failed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types __tests__/dashboardPresentation.test.ts`
Expected: FAIL with module or export errors because `dashboardPresentation.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { HealthCheck, ReadinessScore, WorkoutSession } from './types';

export const buildDashboardPrimaryCard = ({
  activeSession,
  latestWorkout,
}: {
  activeSession: WorkoutSession | null;
  latestWorkout: WorkoutSession | null;
}) => {
  if (activeSession) {
    return {
      eyebrow: 'Today\'s plan',
      title: 'Resume today\'s workout',
      detail: `${activeSession.exercises.length} exercises ready to continue`,
      ctaLabel: 'Resume workout',
    };
  }

  return {
    eyebrow: 'Today\'s plan',
    title: 'Today\'s plan',
    detail: latestWorkout
      ? `Pick up where you left off with ${latestWorkout.exercises[0]?.name || 'your last session'}`
      : 'Build your next training session and start moving',
    ctaLabel: 'Start workout',
  };
};

export const buildReadinessStrip = ({
  readiness,
  healthCheck,
}: {
  readiness: ReadinessScore | null;
  healthCheck: HealthCheck | null;
}) => {
  if (!readiness || !healthCheck) {
    return {
      label: 'Readiness',
      value: 'No check-in yet',
      detail: 'Add a quick recovery check before you train',
      ctaLabel: 'Add check-in',
      tone: 'empty' as const,
    };
  }

  return {
    label: 'Readiness',
    value: `${readiness.score}/10`,
    detail: readiness.warnings[0] || 'Ready for today\'s plan',
    ctaLabel: 'Edit',
    tone: readiness.status,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types __tests__/dashboardPresentation.test.ts`
Expected: PASS with `Dashboard Presentation Validation: 4 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add __tests__/dashboardPresentation.test.ts src/lib/dashboardPresentation.ts
git commit -m "feat: add dashboard presentation helpers"
```

### Task 2: Port the shared shell tokens and global primitives

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update theme tokens and global shell primitives**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap');

@theme {
  --color-bg-primary: #f4f7f2;
  --color-bg-card: #ffffff;
  --color-bg-card-hover: #f7faf6;
  --color-bg-input: #eef3e8;
  --color-bg-surface: #ecf2e7;
  --color-accent: #1e5832;
  --color-accent-light: #2f7d32;
  --color-cyan: #2563eb;
  --color-cyan-light: #3b82f6;
  --color-green: #2f7d32;
  --color-amber: #d97706;
  --color-red: #dc2626;
  --color-text-primary: #172119;
  --color-text-secondary: #5f6e61;
  --color-text-muted: #7a867b;
  --color-border: #dfe8d8;
  --color-border-light: #cad8ca;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Outfit', 'Inter', system-ui, sans-serif;
}

.glass,
.glass-strong {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(223, 232, 216, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 10px 30px rgba(23, 33, 25, 0.05);
}
```

- [ ] **Step 2: Add light-shell background, button, and active-workout overrides**

```css
body {
  background:
    radial-gradient(circle at top left, rgba(47, 125, 50, 0.08), transparent 28%),
    radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.08), transparent 24%),
    var(--color-bg-primary);
}

.gradient-primary {
  background: linear-gradient(135deg, #1e5832 0%, #2f7d32 100%);
}

.gradient-text {
  background: linear-gradient(135deg, #1e5832 0%, #2563eb 100%);
}

.active-workout-shell {
  --color-bg-primary: #0f1720;
  --color-bg-card: #14202d;
  --color-bg-card-hover: #172637;
  --color-bg-input: #1b2a3c;
  --color-bg-surface: #12202f;
  --color-accent: #3b82f6;
  --color-accent-light: #60a5fa;
  --color-cyan: #93c5fd;
  --color-green: #22c55e;
  --color-text-primary: #edf4ff;
  --color-text-secondary: #b4c3d8;
  --color-text-muted: #8fa2bb;
  --color-border: #243447;
  --color-border-light: #334a63;
}
```

- [ ] **Step 3: Keep app shell background consistent**

```tsx
return (
  <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
    ...
  </div>
);
```

- [ ] **Step 4: Run build verification**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/App.tsx
git commit -m "feat: port Kabunga light shell tokens"
```

### Task 3: Rebuild dashboard hierarchy around today’s plan and compact readiness

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/HealthCheckForm.tsx`
- Use: `src/lib/dashboardPresentation.ts`

- [ ] **Step 1: Replace the readiness takeover with a compact strip plus expandable form**

```tsx
const readinessStrip = buildReadinessStrip({
  readiness: todayReadiness,
  healthCheck: todayHealthCheck,
});

<button
  type="button"
  onClick={() => setShowHealthForm((current) => !current)}
  className="glass w-full rounded-[24px] border border-border p-4 text-left"
>
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">{readinessStrip.label}</p>
      <p className="mt-1 text-base font-bold">{readinessStrip.value}</p>
      <p className="mt-1 text-sm text-text-secondary">{readinessStrip.detail}</p>
    </div>
    <span className="rounded-full bg-bg-input px-3 py-1 text-xs font-semibold text-text-secondary">
      {readinessStrip.ctaLabel}
    </span>
  </div>
</button>

{showHealthForm && (
  <HealthCheckForm ... />
)}
```

- [ ] **Step 2: Promote the primary workout card to the top**

```tsx
const primaryCard = buildDashboardPrimaryCard({
  activeSession,
  latestWorkout,
});

<section className="glass rounded-[28px] p-5">
  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{primaryCard.eyebrow}</p>
  <h2 className="mt-2 font-display text-[1.75rem] font-bold tracking-tight text-text-primary">{primaryCard.title}</h2>
  <p className="mt-2 text-sm text-text-secondary">{primaryCard.detail}</p>
  ...
</section>
```

- [ ] **Step 3: Simplify copy and supporting sections**

```tsx
// Rename labels such as:
// "Fast Lane" -> "Last session"
// "Today's Nutrition" -> "Food today"
// "Strength Trends" -> "Weekly progress"
// Keep recovery guidance as a support card, not the hero.
```

- [ ] **Step 4: Restyle the health-check form to fit the new shell**

```tsx
<div className="rounded-[28px] border border-border bg-bg-card p-5 shadow-sm">
  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">Daily check-in</p>
  <h3 className="mt-1 text-lg font-bold">Update readiness</h3>
  <p className="mt-1 text-sm text-text-secondary">Quick recovery context before training.</p>
</div>
```

- [ ] **Step 5: Run validation and typecheck**

Run:
- `node --experimental-strip-types __tests__/dashboardPresentation.test.ts`
- `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardPage.tsx src/components/HealthCheckForm.tsx src/lib/dashboardPresentation.ts __tests__/dashboardPresentation.test.ts
git commit -m "feat: redesign dashboard around today plan"
```

### Task 4: Update shell-critical entry and navigation surfaces

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/components/InstallPrompt.tsx`

- [ ] **Step 1: Port the lighter bottom nav**

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-white/95 backdrop-blur-xl safe-bottom">
  ...
</nav>
```

- [ ] **Step 2: Redesign login/auth shell with calmer palette and typography**

```tsx
<div className="min-h-screen bg-bg-primary px-6 py-12">
  <div className="mx-auto max-w-sm rounded-[32px] border border-border bg-white/90 p-6 shadow-[0_20px_60px_rgba(23,33,25,0.08)]">
    ...
  </div>
</div>
```

- [ ] **Step 3: Update install prompt to match the new shell**

```tsx
<div className="fixed left-4 right-4 top-4 z-[100] mx-auto max-w-lg rounded-[24px] border border-border bg-white/95 p-4 shadow-[0_16px_40px_rgba(23,33,25,0.08)]">
  ...
</div>
```

- [ ] **Step 4: Run build verification**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomNav.tsx src/pages/LoginPage.tsx src/components/InstallPrompt.tsx
git commit -m "feat: update app shell entry surfaces"
```

### Task 5: Polish the highest-visibility supporting pages

**Files:**
- Modify: `src/pages/WorkoutPage.tsx`
- Modify: `src/pages/NutritionPage.tsx`
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `src/pages/ActiveWorkoutPage.tsx`

- [ ] **Step 1: Update page headings and copy to match the new voice**

```tsx
// Examples:
// Workout: "Coach Plan For Today" -> "Today's coach plan"
// Workout: "Fast Lane" -> "Last session"
// Nutrition: keep "Food today" aligned with dashboard language
// Profile: calmer section titles and grouped settings
```

- [ ] **Step 2: Keep active workout as the focused dark exception**

```tsx
return (
  <div className="active-workout-shell max-w-lg mx-auto flex min-h-screen flex-col px-4 pt-4 pb-6">
    ...
  </div>
);
```

- [ ] **Step 3: Refresh the profile avatar and grouped settings presentation**

```tsx
<div className="glass rounded-[28px] p-6">
  ...
</div>
```

- [ ] **Step 4: Run build verification**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/WorkoutPage.tsx src/pages/NutritionPage.tsx src/pages/ProfilePage.tsx src/pages/ActiveWorkoutPage.tsx
git commit -m "feat: polish workout nutrition and profile shell"
```

### Task 6: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Run targeted validations**

Run:
- `node --experimental-strip-types __tests__/dashboardPresentation.test.ts`
- `npm run validate:readiness-guidance`

Expected: PASS

- [ ] **Step 4: Review changed files and summarize residual risks**

```bash
git status --short
```

- [ ] **Step 5: Commit final integration**

```bash
git add src/index.css src/components/BottomNav.tsx src/pages/LoginPage.tsx src/pages/DashboardPage.tsx src/components/HealthCheckForm.tsx src/pages/WorkoutPage.tsx src/pages/NutritionPage.tsx src/pages/ProfilePage.tsx src/pages/ActiveWorkoutPage.tsx src/components/InstallPrompt.tsx src/lib/dashboardPresentation.ts __tests__/dashboardPresentation.test.ts
git commit -m "feat: implement Kabunga shell redesign"
```
