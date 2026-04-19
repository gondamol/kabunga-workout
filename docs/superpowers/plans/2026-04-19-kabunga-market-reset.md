# Kabunga Market Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition Kabunga around a goal-led, performance-first experience with first-run personalization, a clearer home command center, stronger circle discovery, and a more premium visual identity.

**Architecture:** Add a small onboarding domain layer to the existing `UserProfile`, then gate incomplete users into a new onboarding route before they enter the main app shell. Drive the new home experience through presentation helpers so the dashboard behavior is testable, then finish with a controlled visual pass inspired by the supplied references: airy soft gradients, athlete-led hero framing, oversized radii, floating stat chips, and clearer visual hierarchy.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind v4, Zustand, Firebase Auth, Firestore, Node-based validation scripts

---

## File Map

- `src/lib/types.ts`
  - Extend `UserProfile` with onboarding and personalization fields.
- `src/lib/profileSetup.ts`
  - Own onboarding option lists, defaults, labels, and profile-completeness helpers.
- `__tests__/profileSetup.test.ts`
  - Validate onboarding state logic without rendering UI.
- `src/lib/onboardingGate.ts`
  - Encapsulate redirect logic so routing stays predictable and testable.
- `__tests__/onboardingGate.test.ts`
  - Validate onboarding redirect rules.
- `src/stores/authStore.ts`
  - Track whether the profile has finished loading and preserve onboarding defaults on signup/sign-in.
- `src/pages/OnboardingPage.tsx`
  - Render the first-run goal setup flow and persist the result.
- `src/App.tsx`
  - Add the onboarding route and redirect incomplete users before home.
- `src/lib/dashboardPresentation.ts`
  - Build the new goal hero, proof row, empty states, and circle shortcut content.
- `__tests__/dashboardPresentation.test.ts`
  - Validate the dashboard hierarchy and copy decisions.
- `src/pages/DashboardPage.tsx`
  - Render the new goal-led home hierarchy.
- `src/lib/communityPresentation.ts`
  - Centralize circle-first labels and entry-point copy.
- `__tests__/communityPresentation.test.ts`
  - Validate circle naming and invite/empty-state messaging.
- `src/components/BottomNav.tsx`
  - Adjust nav labels toward the new product language.
- `src/pages/CommunityPage.tsx`
  - Reframe the page as circles and accountability.
- `src/index.css`
  - Add the premium soft-performance shell classes.
- `__tests__/shellVisualDirection.test.ts`
  - Validate that the new visual primitives are present in the CSS and used by the key screens.
- `src/pages/LoginPage.tsx`
  - Align auth with the upgraded product story.

## Visual Inspiration Notes

Use the attached inspiration images for these cues only:

- soft ice-blue / mist gradients behind white surfaces
- large rounded cards with more breathing room
- athlete-led hero imagery and floating stat chips
- premium pill CTAs and segmented selectors
- quiet shadows and selective glass blur for emphasis, not every card

Do **not** copy these patterns literally:

- washed-out low-contrast text
- decorative 3D objects with no functional purpose
- concept-shot layouts that sacrifice usability for spectacle

Kabunga should still read as a serious training product first.

---

### Task 1: Add onboarding profile schema and profile-setup helpers

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/profileSetup.ts`
- Create: `__tests__/profileSetup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  DEFAULT_USER_ONBOARDING,
  buildCompletedOnboarding,
  getPrimaryGoalLabel,
  isProfileSetupComplete,
} from '../src/lib/profileSetup.ts';
import type { UserProfile } from '../src/lib/types.ts';

type ValidationResult = {
  passed: number;
  failed: number;
  errors: string[];
};

const buildProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid: 'user-1',
  email: 'athlete@example.com',
  displayName: 'Aurel',
  photoURL: null,
  role: 'athlete',
  coachCode: null,
  onboarding: DEFAULT_USER_ONBOARDING,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

export function validateProfileSetup(): ValidationResult {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  const incomplete = buildProfile();
  if (isProfileSetupComplete(incomplete) === false) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Empty onboarding should be incomplete');
  }

  const completed = buildProfile({
    onboarding: buildCompletedOnboarding({
      primaryGoal: 'strength',
      trainingEnvironment: 'full_gym',
      supportMode: 'solo',
      experienceLevel: 'intermediate',
      trainingDaysPerWeek: 4,
    }),
  });
  if (isProfileSetupComplete(completed) === true) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Completed onboarding should be treated as complete');
  }

  if (getPrimaryGoalLabel('strength') === 'Build strength') {
    passed++;
  } else {
    failed++;
    errors.push('✗ Strength label should be human-readable');
  }

  return { passed, failed, errors };
}

const result = validateProfileSetup();
console.log(`Profile Setup Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
  result.errors.forEach((error) => console.error(error));
  process.exitCode = 1;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/profileSetup.test.ts`
Expected: FAIL because `profileSetup.ts` and the new onboarding fields do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/types.ts
export type PrimaryGoal = 'strength' | 'muscle' | 'fat_loss' | 'general_fitness';
export type TrainingEnvironment = 'full_gym' | 'minimal_equipment' | 'home_bodyweight';
export type SupportMode = 'solo' | 'with_coach' | 'with_friends';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface UserOnboarding {
  primaryGoal: PrimaryGoal | null;
  trainingEnvironment: TrainingEnvironment | null;
  supportMode: SupportMode | null;
  experienceLevel: ExperienceLevel | null;
  trainingDaysPerWeek: number | null;
  completedAt?: number | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role?: UserRole;
  coachCode?: string | null;
  onboarding?: UserOnboarding | null;
  oneRepMaxPromptSnoozeUntil?: number | null;
  oneRepMaxPromptLastShownAt?: number | null;
  createdAt: number;
  updatedAt: number;
}
```

```ts
// src/lib/profileSetup.ts
import type {
  ExperienceLevel,
  PrimaryGoal,
  SupportMode,
  TrainingEnvironment,
  UserOnboarding,
  UserProfile,
} from './types';

export const DEFAULT_USER_ONBOARDING: UserOnboarding = {
  primaryGoal: null,
  trainingEnvironment: null,
  supportMode: null,
  experienceLevel: null,
  trainingDaysPerWeek: null,
  completedAt: null,
};

export const buildCompletedOnboarding = (
  input: Omit<UserOnboarding, 'completedAt'>
): UserOnboarding => ({
  ...input,
  completedAt: Date.now(),
});

export const isProfileSetupComplete = (profile: UserProfile | null | undefined): boolean => {
  const onboarding = profile?.onboarding;
  return Boolean(
    onboarding?.primaryGoal &&
    onboarding?.trainingEnvironment &&
    onboarding?.supportMode &&
    onboarding?.experienceLevel &&
    onboarding?.trainingDaysPerWeek &&
    onboarding?.completedAt
  );
};

export const getPrimaryGoalLabel = (goal: PrimaryGoal): string => {
  if (goal === 'strength') return 'Build strength';
  if (goal === 'muscle') return 'Build muscle';
  if (goal === 'fat_loss') return 'Lose fat';
  return 'General fitness';
};

export const getTrainingEnvironmentLabel = (environment: TrainingEnvironment): string => {
  if (environment === 'full_gym') return 'Full gym';
  if (environment === 'minimal_equipment') return 'Minimal equipment';
  return 'Home / bodyweight';
};

export const getSupportModeLabel = (mode: SupportMode): string => {
  if (mode === 'solo') return 'Solo';
  if (mode === 'with_coach') return 'With coach';
  return 'With friends';
};

export const getExperienceLevelLabel = (level: ExperienceLevel): string => {
  if (level === 'beginner') return 'Beginner';
  if (level === 'intermediate') return 'Intermediate';
  return 'Advanced';
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/profileSetup.test.ts`
Expected: PASS with `Profile Setup Validation: 3 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/profileSetup.ts __tests__/profileSetup.test.ts
git commit -m "feat: add Kabunga onboarding profile schema"
```

### Task 2: Add onboarding route gating and first-run setup page

**Files:**
- Create: `src/lib/onboardingGate.ts`
- Create: `__tests__/onboardingGate.test.ts`
- Modify: `src/stores/authStore.ts`
- Create: `src/pages/OnboardingPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import { resolveOnboardingRedirect } from '../src/lib/onboardingGate.ts';

type ValidationResult = {
  passed: number;
  failed: number;
  errors: string[];
};

export function validateOnboardingGate(): ValidationResult {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  const redirectForIncomplete = resolveOnboardingRedirect({
    pathname: '/',
    isAuthenticated: true,
    profileLoaded: true,
    isProfileComplete: false,
  });
  if (redirectForIncomplete === '/onboarding') {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Expected incomplete profile to redirect to /onboarding, got ${redirectForIncomplete}`);
  }

  const redirectForComplete = resolveOnboardingRedirect({
    pathname: '/onboarding',
    isAuthenticated: true,
    profileLoaded: true,
    isProfileComplete: true,
  });
  if (redirectForComplete === '/') {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Expected complete profile to leave /onboarding, got ${redirectForComplete}`);
  }

  const noRedirectWhileLoading = resolveOnboardingRedirect({
    pathname: '/',
    isAuthenticated: true,
    profileLoaded: false,
    isProfileComplete: false,
  });
  if (noRedirectWhileLoading === null) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Expected no redirect while profile is loading, got ${noRedirectWhileLoading}`);
  }

  return { passed, failed, errors };
}

const result = validateOnboardingGate();
console.log(`Onboarding Gate Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
  result.errors.forEach((error) => console.error(error));
  process.exitCode = 1;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/onboardingGate.test.ts`
Expected: FAIL because `onboardingGate.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/onboardingGate.ts
export const resolveOnboardingRedirect = ({
  pathname,
  isAuthenticated,
  profileLoaded,
  isProfileComplete,
}: {
  pathname: string;
  isAuthenticated: boolean;
  profileLoaded: boolean;
  isProfileComplete: boolean;
}): string | null => {
  if (!isAuthenticated || !profileLoaded) return null;
  if (!isProfileComplete && pathname !== '/onboarding') return '/onboarding';
  if (isProfileComplete && pathname === '/onboarding') return '/';
  return null;
};
```

```ts
// src/stores/authStore.ts
interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  profileLoaded: boolean;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

// initial state
profileLoaded: false,

// signUp/signInWithGoogle
const profile: UserProfile = {
  uid: cred.user.uid,
  email: cred.user.email!,
  displayName: name,
  photoURL: null,
  role: 'athlete',
  coachCode: null,
  onboarding: DEFAULT_USER_ONBOARDING,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
set({ user: cred.user, profile, profileLoaded: true, loading: false });

// onAuthStateChanged
useAuthStore.setState({ user, initialized: true, profileLoaded: false });
getDoc(doc(db, 'users', user.uid))
  .then((snap) => {
    if (snap.exists()) {
      useAuthStore.setState({
        profile: snap.data() as UserProfile,
        profileLoaded: true,
      });
      return;
    }
    useAuthStore.setState({ profileLoaded: true });
  })
  .catch(() => {
    useAuthStore.setState({ profileLoaded: true });
  });
```

```tsx
// src/pages/OnboardingPage.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { updateUserProfile } from '../lib/firestoreService';
import {
  buildCompletedOnboarding,
  DEFAULT_USER_ONBOARDING,
  getExperienceLevelLabel,
  getPrimaryGoalLabel,
  getSupportModeLabel,
  getTrainingEnvironmentLabel,
} from '../lib/profileSetup';
import { useAuthStore } from '../stores/authStore';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [draft, setDraft] = useState(profile?.onboarding || DEFAULT_USER_ONBOARDING);
  const [saving, setSaving] = useState(false);

  const readyToFinish = useMemo(() => (
    Boolean(
      draft.primaryGoal &&
      draft.trainingEnvironment &&
      draft.supportMode &&
      draft.experienceLevel &&
      draft.trainingDaysPerWeek
    )
  ), [draft]);

  const handleFinish = async () => {
    if (!user || !readyToFinish) return;
    setSaving(true);
    try {
      const onboarding = buildCompletedOnboarding({
        primaryGoal: draft.primaryGoal!,
        trainingEnvironment: draft.trainingEnvironment!,
        supportMode: draft.supportMode!,
        experienceLevel: draft.experienceLevel!,
        trainingDaysPerWeek: draft.trainingDaysPerWeek!,
      });
      await updateUserProfile(user.uid, { onboarding });
      useAuthStore.setState((state) => ({
        ...state,
        profile: state.profile ? { ...state.profile, onboarding } : state.profile,
      }));
      toast.success('Your training path is ready');
      navigate('/', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shell-page pt-8 pb-10 space-y-6">
      <section className="premium-hero-card p-6">
        <p className="eyebrow-chip">Build your training path</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-text-primary">Tell Kabunga how you train</h1>
        <p className="mt-2 text-sm text-text-secondary">
          We’ll shape your home screen around your goal, training setup, and support style.
        </p>
      </section>

      <section className="glass rounded-[28px] p-5 space-y-4">
        <label className="text-sm font-semibold">Primary goal</label>
        <div className="grid grid-cols-2 gap-3">
          {['strength', 'muscle', 'fat_loss', 'general_fitness'].map((goal) => (
            <button key={goal} className="choice-card">{getPrimaryGoalLabel(goal as never)}</button>
          ))}
        </div>
      </section>

      <button
        onClick={handleFinish}
        disabled={!readyToFinish || saving}
        className="w-full rounded-2xl gradient-primary px-4 py-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Open my dashboard'}
      </button>
    </div>
  );
}
```

```tsx
// src/App.tsx
import OnboardingPage from './pages/OnboardingPage';
import { isProfileSetupComplete } from './lib/profileSetup';
import { resolveOnboardingRedirect } from './lib/onboardingGate';

export default function App() {
  const { user, profile, initialized, profileLoaded } = useAuthStore();
  const location = useLocation();

  const onboardingRedirect = resolveOnboardingRedirect({
    pathname: location.pathname,
    isAuthenticated: Boolean(user),
    profileLoaded,
    isProfileComplete: isProfileSetupComplete(profile),
  });

  if (onboardingRedirect) {
    return <Navigate to={onboardingRedirect} replace />;
  }

  const showBottomNav = initialized && user && location.pathname !== '/login' && location.pathname !== '/active-workout' && location.pathname !== '/onboarding';

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary">
      <Routes>
        <Route path="/login" element={initialized && user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/workout" element={<ProtectedRoute><WorkoutPage /></ProtectedRoute>} />
        <Route path="/active-workout" element={<ProtectedRoute><ActiveWorkoutPage /></ProtectedRoute>} />
        <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><ChallengesPage /></ProtectedRoute>} />
        <Route path="/nutrition" element={<ProtectedRoute><NutritionPage /></ProtectedRoute>} />
        <Route path="/iron-protocol" element={<ProtectedRoute><IronProtocolPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/history/:id" element={<ProtectedRoute><SessionDetailPage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute><CoachHubPage /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
        <Route path="/science" element={<ProtectedRoute><SciencePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/onboardingGate.test.ts`
Expected: PASS with `Onboarding Gate Validation: 3 passed, 0 failed`

- [ ] **Step 5: Run typecheck**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/onboardingGate.ts __tests__/onboardingGate.test.ts src/stores/authStore.ts src/pages/OnboardingPage.tsx src/App.tsx
git commit -m "feat: add Kabunga first-run onboarding gate"
```

### Task 3: Expand dashboard presentation for goal hero, proof row, and empty states

**Files:**
- Modify: `src/lib/dashboardPresentation.ts`
- Modify: `__tests__/dashboardPresentation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  buildDashboardGoalHero,
  buildDashboardPrimaryCard,
  buildDashboardProgressEmptyState,
  buildReadinessStrip,
  buildCircleShortcutCard,
} from '../src/lib/dashboardPresentation.ts';
import type { UserProfile, WorkoutSession } from '../src/lib/types.ts';

const buildProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid: 'user-1',
  email: 'athlete@example.com',
  displayName: 'Aurel',
  photoURL: null,
  role: 'athlete',
  coachCode: null,
  onboarding: {
    primaryGoal: 'strength',
    trainingEnvironment: 'full_gym',
    supportMode: 'with_friends',
    experienceLevel: 'intermediate',
    trainingDaysPerWeek: 4,
    completedAt: 1,
  },
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const buildWorkout = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'w1',
  userId: 'user-1',
  startedAt: 1,
  endedAt: 1,
  duration: 2400,
  exercises: [{ id: 'e1', name: 'Bench Press', sets: [], notes: '' }],
  mediaUrls: [],
  caloriesEstimate: 320,
  notes: '',
  status: 'completed',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const hero = buildDashboardGoalHero({
  profile: buildProfile(),
  activeSession: null,
  latestWorkout: null,
});
if (hero.eyebrow !== 'Strength block' || hero.ctaLabel !== 'Build first session') {
  throw new Error(`Unexpected dashboard hero: ${JSON.stringify(hero)}`);
}

const emptyState = buildDashboardProgressEmptyState({
  profile: buildProfile(),
  workoutCount: 0,
});
if (!emptyState.title.includes('first strength session')) {
  throw new Error(`Unexpected empty-state title: ${JSON.stringify(emptyState)}`);
}

const circleShortcut = buildCircleShortcutCard({
  profile: buildProfile(),
  hasCircle: false,
});
if (circleShortcut.ctaLabel !== 'Create or join a circle') {
  throw new Error(`Unexpected circle shortcut: ${JSON.stringify(circleShortcut)}`);
}

console.log('Dashboard Presentation Validation: 7 passed, 0 failed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/dashboardPresentation.test.ts`
Expected: FAIL because the new dashboard builder exports do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/dashboardPresentation.ts
import { getPrimaryGoalLabel, getSupportModeLabel } from './profileSetup';
import type { HealthCheck, ReadinessScore, ReadinessStatus, UserProfile, WorkoutSession } from './types';

export interface DashboardGoalHero {
  eyebrow: string;
  title: string;
  detail: string;
  ctaLabel: string;
}

export interface DashboardCircleShortcut {
  title: string;
  detail: string;
  ctaLabel: string;
}

export interface DashboardEmptyState {
  title: string;
  detail: string;
  ctaLabel: string;
}

export const buildDashboardGoalHero = ({
  profile,
  activeSession,
  latestWorkout,
}: {
  profile: UserProfile | null;
  activeSession: WorkoutSession | null;
  latestWorkout: WorkoutSession | null;
}): DashboardGoalHero => {
  const goal = profile?.onboarding?.primaryGoal;
  const eyebrow = goal === 'strength'
    ? 'Strength block'
    : goal === 'muscle'
      ? 'Muscle block'
      : goal === 'fat_loss'
        ? 'Fat-loss block'
        : 'Training block';

  if (activeSession) {
    return {
      eyebrow,
      title: 'Resume today’s session',
      detail: `${activeSession.exercises.length} exercises ready to continue`,
      ctaLabel: 'Resume workout',
    };
  }

  if (!latestWorkout) {
    return {
      eyebrow,
      title: `Start your ${getPrimaryGoalLabel(goal || 'general_fitness').toLowerCase()}`,
      detail: 'We’ll tailor your first session around the path you selected.',
      ctaLabel: 'Build first session',
    };
  }

  return {
    eyebrow,
    title: 'Today’s plan',
    detail: `Pick up where you left off with ${latestWorkout.exercises[0]?.name || 'your last session'}`,
    ctaLabel: 'Start workout',
  };
};

export const buildDashboardProgressEmptyState = ({
  profile,
  workoutCount,
}: {
  profile: UserProfile | null;
  workoutCount: number;
}): DashboardEmptyState => {
  const goal = getPrimaryGoalLabel(profile?.onboarding?.primaryGoal || 'general_fitness').toLowerCase();
  if (workoutCount === 0) {
    return {
      title: `Complete your first ${goal} session`,
      detail: 'Your progress cards unlock once you log your first real workout.',
      ctaLabel: 'Start workout',
    };
  }

  return {
    title: 'Progress is building',
    detail: 'Keep training this week to unlock deeper trends and PR callouts.',
    ctaLabel: 'View history',
  };
};

export const buildCircleShortcutCard = ({
  profile,
  hasCircle,
}: {
  profile: UserProfile | null;
  hasCircle: boolean;
}): DashboardCircleShortcut => {
  const supportMode = profile?.onboarding?.supportMode;
  if (hasCircle) {
    return {
      title: 'Your circle',
      detail: 'Check invites, sync challenge progress, and keep your crew moving.',
      ctaLabel: 'Open circle',
    };
  }

  return {
    title: supportMode === 'with_friends' ? 'Bring your training circle in' : 'Add accountability when you want it',
    detail: `Kabunga is set to ${getSupportModeLabel(supportMode || 'solo').toLowerCase()} mode right now.`,
    ctaLabel: 'Create or join a circle',
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/dashboardPresentation.test.ts`
Expected: PASS with `Dashboard Presentation Validation: 7 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardPresentation.ts __tests__/dashboardPresentation.test.ts
git commit -m "feat: add Kabunga goal-led dashboard presentation"
```

### Task 4: Implement the new home hierarchy and circle-first entry points

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/lib/communityPresentation.ts`
- Modify: `__tests__/communityPresentation.test.ts`
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/pages/CommunityPage.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import {
  buildCommunityCreationConfig,
  buildCommunityInviteShareMessage,
  buildCommunityLandingEmptyState,
} from '../src/lib/communityPresentation.ts';

const athleteConfig = buildCommunityCreationConfig('athlete');
if (athleteConfig.title !== 'Create Training Circle') {
  throw new Error(`Unexpected athlete config title: ${athleteConfig.title}`);
}

const emptyState = buildCommunityLandingEmptyState({
  hasGroups: false,
  supportMode: 'with_friends',
});
if (emptyState.ctaLabel !== 'Create or join a circle') {
  throw new Error(`Unexpected circle CTA: ${JSON.stringify(emptyState)}`);
}

const inviteMessage = buildCommunityInviteShareMessage({
  groupName: 'Morning Crew',
  inviteCode: 'KBG9A7X2',
  ownerName: 'Aurel',
});
if (!inviteMessage.includes('circle')) {
  throw new Error(`Expected invite copy to mention circle: ${inviteMessage}`);
}

console.log('Community Presentation Validation: 4 passed, 0 failed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/communityPresentation.test.ts`
Expected: FAIL because `buildCommunityLandingEmptyState` and the new circle wording do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/communityPresentation.ts
import type { SupportMode, UserRole } from './types';

export const buildCommunityLandingEmptyState = ({
  hasGroups,
  supportMode,
}: {
  hasGroups: boolean;
  supportMode: SupportMode | null | undefined;
}) => {
  if (hasGroups) {
    return {
      title: 'Your circles',
      detail: 'Open your training group, keep the chat moving, and sync this week’s work.',
      ctaLabel: 'Open circle',
    };
  }

  return {
    title: supportMode === 'with_friends' ? 'Create your training circle' : 'Add a circle when you want accountability',
    detail: 'Circles help friends, crews, and small teams stay aligned through shared progress and invites.',
    ctaLabel: 'Create or join a circle',
  };
};

export const buildCommunityInviteShareMessage = ({
  groupName,
  inviteCode,
  ownerName,
}: {
  groupName: string;
  inviteCode: string;
  ownerName: string;
}): string => {
  return [
    `${ownerName} invited you to join the "${groupName}" circle on Kabunga Workout.`,
    `Open the Circle tab and enter invite code ${inviteCode} to join.`,
    'Train together, compare progress, and keep each other accountable.',
  ].join('\n');
};
```

```tsx
// src/components/BottomNav.tsx
const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/workout', icon: Play, label: 'Workout' },
  { to: '/community', icon: MessagesSquare, label: 'Circle' },
  { to: '/iron-protocol', icon: Dumbbell, label: 'Iron' },
  { to: '/profile', icon: User, label: 'Profile' },
];
```

```tsx
// src/pages/DashboardPage.tsx (new shortcut block)
const circleShortcut = useMemo(
  () => buildCircleShortcutCard({
    profile,
    hasCircle: myGroups.length > 0,
  }),
  [profile, myGroups.length]
);

<button
  type="button"
  onClick={() => navigate('/community')}
  className="glass w-full rounded-[24px] p-4 text-left"
>
  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">Circle</p>
  <p className="mt-2 text-base font-bold text-text-primary">{circleShortcut.title}</p>
  <p className="mt-1 text-sm text-text-secondary">{circleShortcut.detail}</p>
  <span className="mt-3 inline-flex rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-text-primary">
    {circleShortcut.ctaLabel}
  </span>
</button>
```

```tsx
// src/pages/CommunityPage.tsx
<p className="text-xs uppercase tracking-wide text-text-muted">Kabunga Circle</p>
<h1 className="text-2xl font-black mt-1">Circles & Chat</h1>
<p className="text-xs text-text-secondary mt-1">
  Bring your gym friends, coach group, or lifting crew into one accountability space.
</p>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/communityPresentation.test.ts`
Expected: PASS with `Community Presentation Validation: 4 passed, 0 failed`

- [ ] **Step 5: Run typecheck**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardPage.tsx src/lib/communityPresentation.ts __tests__/communityPresentation.test.ts src/components/BottomNav.tsx src/pages/CommunityPage.tsx
git commit -m "feat: add circle-first Kabunga home and community entry points"
```

### Task 5: Add the premium soft-performance visual layer

**Files:**
- Create: `__tests__/shellVisualDirection.test.ts`
- Modify: `src/index.css`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/OnboardingPage.tsx`
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const onboarding = readFileSync(new URL('../src/pages/OnboardingPage.tsx', import.meta.url), 'utf8');

const requiredCssClasses = [
  '.shell-aurora',
  '.premium-hero-card',
  '.athlete-spotlight',
  '.floating-stat-chip',
  '.soft-panel',
];

for (const className of requiredCssClasses) {
  if (!css.includes(className)) {
    throw new Error(`Missing visual class ${className}`);
  }
}

if (!dashboard.includes('premium-hero-card')) {
  throw new Error('Dashboard should use premium-hero-card');
}

if (!onboarding.includes('athlete-spotlight')) {
  throw new Error('Onboarding should use athlete-spotlight');
}

console.log('Shell Visual Direction Validation: 7 passed, 0 failed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/shellVisualDirection.test.ts`
Expected: FAIL because the new shell classes and screen usage do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```css
/* src/index.css */
.shell-aurora {
  background:
    radial-gradient(circle at top left, rgba(151, 196, 255, 0.30), transparent 30%),
    radial-gradient(circle at bottom right, rgba(207, 232, 255, 0.42), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(241, 247, 255, 0.94) 100%);
}

.premium-hero-card {
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  border: 1px solid rgba(223, 232, 216, 0.9);
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 24%),
    linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(247,250,255,0.92) 100%);
  box-shadow: 0 24px 70px rgba(23, 33, 25, 0.08);
  backdrop-filter: blur(18px);
}

.athlete-spotlight {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(191, 219, 254, 0.55), transparent 28%),
    linear-gradient(180deg, #f7fbff 0%, #edf5ff 100%);
}

.floating-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(223, 232, 216, 0.9);
  padding: 0.55rem 0.85rem;
  box-shadow: 0 10px 28px rgba(23, 33, 25, 0.08);
}

.soft-panel {
  border-radius: 24px;
  background: rgba(255,255,255,0.76);
  border: 1px solid rgba(223, 232, 216, 0.85);
  backdrop-filter: blur(18px);
}
```

```tsx
// src/pages/LoginPage.tsx
<div className="relative min-h-screen overflow-hidden shell-aurora px-6 py-12">
  <div className="pointer-events-none absolute right-[-18%] top-[-10%] h-[52vw] w-[52vw] rounded-full bg-cyan/10 blur-3xl" />
  <div className="pointer-events-none absolute bottom-[-14%] left-[-12%] h-[42vw] w-[42vw] rounded-full bg-accent/10 blur-3xl" />
  <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-sm items-center">
    <div className="w-full premium-hero-card p-6 shadow-[0_28px_72px_rgba(23,33,25,0.10)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Performance-first training</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">Kabunga</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Serious workout tracking, clearer progress, and accountability when you want it.
      </p>
    </div>
  </div>
</div>
```

```tsx
// src/pages/OnboardingPage.tsx
<section className="athlete-spotlight p-6">
  <div className="floating-stat-chip absolute left-4 top-4">Goal-led setup</div>
  <div className="floating-stat-chip absolute right-4 top-16">3 quick steps</div>
  <div className="absolute inset-x-0 bottom-0 p-6">
    <h2 className="font-display text-2xl font-bold text-text-primary">A training app that adapts to you</h2>
  </div>
</section>
```

```tsx
// src/pages/DashboardPage.tsx
<section className="premium-hero-card p-5 animate-fade-in">
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="eyebrow-chip">{goalHero.eyebrow}</p>
      <h2 className="mt-3 font-display text-[1.9rem] font-bold tracking-tight text-text-primary">
        {goalHero.title}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-text-secondary">{goalHero.detail}</p>
    </div>
    <div className="soft-panel px-3 py-2 text-xs font-semibold text-text-primary">Today</div>
  </div>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/shellVisualDirection.test.ts`
Expected: PASS with `Shell Visual Direction Validation: 7 passed, 0 failed`

- [ ] **Step 5: Run full verification**

Run: `PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/profileSetup.test.ts && PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/onboardingGate.test.ts && PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/dashboardPresentation.test.ts && PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/communityPresentation.test.ts && PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH node --experimental-strip-types __tests__/shellVisualDirection.test.ts && PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH npx tsc --noEmit && PATH=/home/gondamol/.nvm/versions/node/v22.22.2/bin:$PATH npm run build`
Expected: all validations pass and the production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/pages/LoginPage.tsx src/pages/OnboardingPage.tsx src/pages/DashboardPage.tsx __tests__/shellVisualDirection.test.ts
git commit -m "feat: add Kabunga premium soft-performance shell"
```

## Spec Coverage Notes

- First-run personalization: covered by Tasks 1 and 2.
- Goal-led home hero and hierarchy: covered by Tasks 3 and 4.
- Create/join circle dashboard shortcut: covered by Tasks 3 and 4.
- Better empty states: covered by Tasks 3 and 4.
- Premium, more competitive visual direction: covered by Task 5.
- Image-reference inspiration: translated into shell classes, hero framing, floating chips, and softer premium surfaces in Task 5.
