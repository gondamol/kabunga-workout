import {
    buildCircleShortcutCard,
    buildDashboardGoalHero,
    buildDashboardPrimaryCard,
    buildDashboardProgressEmptyState,
    buildRecoveryAlternatives,
    buildReadinessStrip,
    buildTodayRecommendation,
} from '../src/lib/dashboardPresentation.ts';
import type { Exercise, HealthCheck, ReadinessScore, UserProfile, WorkoutSession } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const buildExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
    id: 'exercise-1',
    name: 'Bench Press',
    sets: [],
    notes: '',
    ...overrides,
});

const buildWorkout = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
    id: 'workout-1',
    userId: 'user-1',
    startedAt: 1,
    endedAt: 1,
    duration: 2400,
    exercises: [buildExercise()],
    mediaUrls: [],
    caloriesEstimate: 320,
    notes: '',
    status: 'completed',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
});

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

export function validateDashboardPresentation(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const activeCard = buildDashboardPrimaryCard({
        activeSession: buildWorkout({
            status: 'active',
            exercises: [buildExercise({ name: 'Front Squat' })],
        }),
        latestWorkout: null,
    });

    if (activeCard.title === "Resume today's workout" && activeCard.ctaLabel === 'Resume workout') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Active session card was wrong: ${JSON.stringify(activeCard)}`);
    }

    const repeatCard = buildDashboardPrimaryCard({
        activeSession: null,
        latestWorkout: buildWorkout(),
    });

    if (repeatCard.title === "Today's plan" && repeatCard.ctaLabel === 'Start workout') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Latest workout fallback card was wrong: ${JSON.stringify(repeatCard)}`);
    }

    const readinessStrip = buildReadinessStrip({
        readiness: buildReadiness(),
        healthCheck: buildHealthCheck(),
    });

    if (readinessStrip.label === 'Readiness' && readinessStrip.value.includes('7/10') && readinessStrip.ctaLabel === 'Edit') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Existing readiness strip was wrong: ${JSON.stringify(readinessStrip)}`);
    }

    const missingStrip = buildReadinessStrip({
        readiness: null,
        healthCheck: null,
    });

    if (missingStrip.ctaLabel === 'Add check-in' && missingStrip.tone === 'empty') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Missing readiness strip was wrong: ${JSON.stringify(missingStrip)}`);
    }

    const hero = buildDashboardGoalHero({
        profile: buildProfile(),
        activeSession: null,
        latestWorkout: null,
    });

    if (hero.eyebrow === 'Strength block' && hero.ctaLabel === 'Build first session') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Goal hero was wrong: ${JSON.stringify(hero)}`);
    }

    const emptyState = buildDashboardProgressEmptyState({
        profile: buildProfile(),
        workoutCount: 0,
    });

    if (emptyState.title.includes('first strength session') && emptyState.ctaLabel === 'Start workout') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Progress empty state was wrong: ${JSON.stringify(emptyState)}`);
    }

    const circleShortcut = buildCircleShortcutCard({
        profile: buildProfile(),
        hasCircle: false,
    });

    if (circleShortcut.ctaLabel === 'Create or join a circle') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Circle shortcut card was wrong: ${JSON.stringify(circleShortcut)}`);
    }

    const recoveryRecommendation = buildTodayRecommendation({
        activeSession: null,
        latestWorkout: buildWorkout({ exercises: [buildExercise({ name: 'Goblet Squat' })] }),
        readiness: buildReadiness({ score: 3, status: 'poor', warnings: ['Sleep was low'] }),
        hasCoachPlan: false,
        isOnline: true,
    });

    if (
        recoveryRecommendation.title === 'Keep it simple today' &&
        recoveryRecommendation.ctaLabel === 'Choose recovery plan' &&
        recoveryRecommendation.tone === 'recovery'
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Low readiness recommendation was wrong: ${JSON.stringify(recoveryRecommendation)}`);
    }

    const repeatRecommendation = buildTodayRecommendation({
        activeSession: null,
        latestWorkout: buildWorkout({ exercises: [buildExercise({ name: 'Upper Body Push' })] }),
        readiness: buildReadiness({ score: 8, status: 'good' }),
        hasCoachPlan: false,
        isOnline: false,
    });

    if (
        repeatRecommendation.title === 'Your last session is ready to repeat' &&
        repeatRecommendation.ctaLabel === 'Repeat last workout' &&
        repeatRecommendation.detail.includes('Offline gym mode')
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Repeat recommendation was wrong: ${JSON.stringify(repeatRecommendation)}`);
    }

    const coachRecommendation = buildTodayRecommendation({
        activeSession: null,
        latestWorkout: null,
        readiness: buildReadiness({ score: 7, status: 'good' }),
        hasCoachPlan: true,
        isOnline: true,
    });

    if (coachRecommendation.title === 'Your coach plan is ready' && coachRecommendation.tone === 'coach') {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Coach recommendation was wrong: ${JSON.stringify(coachRecommendation)}`);
    }

    const recoveryAlternatives = buildRecoveryAlternatives({
        readiness: buildReadiness({ score: 4, status: 'moderate' }),
    });

    if (
        recoveryAlternatives.title === 'Recovery still counts' &&
        recoveryAlternatives.options.includes('10-minute mobility') &&
        recoveryAlternatives.options.includes('Breathing reset')
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Recovery alternatives were wrong: ${JSON.stringify(recoveryAlternatives)}`);
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateDashboardPresentation();
    console.log(`Dashboard Presentation Validation: ${result.passed} passed, ${result.failed} failed`);
    if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach((error) => console.error(error));
    } else {
        console.log('✓ All validations passed!');
    }
    return result;
};

if (typeof process !== 'undefined' && typeof window === 'undefined') {
    const result = reportValidationResult();
    if (result.failed > 0) process.exitCode = 1;
}
