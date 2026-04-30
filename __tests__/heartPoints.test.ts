import {
    buildCardioWorkoutSession,
    classifyCardioIntensity,
    computeCardioSummary,
    computeHeartPointsForCardio,
    computeStrengthHeartPoints,
    estimateCardioCalories,
    formatPace,
    summarizeHeartPoints,
} from '../src/lib/heartPoints.ts';
import type { WorkoutSession } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const expectEq = (actual: unknown, expected: unknown, label: string, errors: string[]): boolean => {
    if (actual === expected) return true;
    errors.push(`✗ ${label}: expected ${String(expected)}, got ${String(actual)}`);
    return false;
};

const expectNear = (actual: number, expected: number, tolerance: number, label: string, errors: string[]): boolean => {
    if (Math.abs(actual - expected) <= tolerance) return true;
    errors.push(`✗ ${label}: expected ≈${expected} (±${tolerance}), got ${actual}`);
    return false;
};

export function validateHeartPoints(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;
    const tally = (ok: boolean) => (ok ? passed++ : failed++);

    // ── classifyCardioIntensity ──
    tally(expectEq(classifyCardioIntensity('walk', null), 'moderate', 'walk classifies as moderate', errors));
    tally(expectEq(classifyCardioIntensity('cycle', null), 'vigorous', 'cycle classifies as vigorous', errors));
    tally(expectEq(classifyCardioIntensity('run', 5), 'vigorous', 'fast run pace classifies as vigorous', errors));
    tally(expectEq(classifyCardioIntensity('run', 10), 'moderate', 'slow run pace classifies as moderate', errors));

    // ── computeHeartPointsForCardio ── (1 pt/min mod, 2 pt/min vig)
    tally(expectEq(computeHeartPointsForCardio(60 * 30, 'moderate'), 30, '30 min moderate = 30 pts', errors));
    tally(expectEq(computeHeartPointsForCardio(60 * 30, 'vigorous'), 60, '30 min vigorous = 60 pts', errors));
    tally(expectEq(computeHeartPointsForCardio(60 * 20, 'easy'), 10, '20 min easy = 10 pts', errors));

    // ── computeStrengthHeartPoints ── density-based
    tally(expectEq(computeStrengthHeartPoints(60 * 30, 30), 30, 'dense strength session earns full points', errors));
    tally(expectEq(computeStrengthHeartPoints(60 * 30, 5), 15, 'low-density strength earns half points', errors));

    // ── computeCardioSummary ──
    const summary = computeCardioSummary('run', 60 * 30, 5);
    tally(expectEq(summary.activity, 'run', 'summary.activity', errors));
    tally(expectEq(summary.distanceKm, 5, 'summary.distanceKm', errors));
    tally(expectNear(summary.avgPaceMinPerKm ?? 0, 6, 0.01, 'summary.avgPaceMinPerKm', errors));
    tally(expectNear(summary.avgSpeedKmh ?? 0, 10, 0.01, 'summary.avgSpeedKmh', errors));
    tally(expectEq(summary.intensity, 'vigorous', 'summary.intensity', errors));

    // No-distance summary stays valid
    const noDistance = computeCardioSummary('walk', 60 * 30, undefined);
    tally(expectEq(noDistance.distanceKm, undefined, 'walk without distance has undefined km', errors));
    tally(expectEq(noDistance.avgPaceMinPerKm, undefined, 'walk without distance has undefined pace', errors));
    tally(expectEq(noDistance.intensity, 'moderate', 'walk without distance still moderate', errors));

    // ── estimateCardioCalories ── (running 30 min, 70 kg ≈ 343 kcal at MET 9.8)
    tally(expectNear(estimateCardioCalories('run', 60 * 30, 70), 343, 5, 'run 30min @70kg ≈ 343 kcal', errors));
    tally(expectNear(estimateCardioCalories('walk', 60 * 60, 70), 266, 5, 'walk 60min @70kg ≈ 266 kcal', errors));

    // ── formatPace ──
    tally(expectEq(formatPace(6.5), '6:30/km', 'formatPace 6.5 -> 6:30/km', errors));
    tally(expectEq(formatPace(undefined), '—', 'formatPace undefined -> em-dash', errors));
    tally(expectEq(formatPace(0), '—', 'formatPace 0 -> em-dash', errors));
    tally(expectEq(formatPace(Infinity), '—', 'formatPace Infinity -> em-dash', errors));

    // ── summarizeHeartPoints ── prefers stored value
    const explicit: WorkoutSession = {
        id: 's',
        userId: 'u',
        startedAt: 0,
        endedAt: 1,
        duration: 60,
        exercises: [],
        mediaUrls: [],
        caloriesEstimate: 0,
        heartPoints: 42,
        notes: '',
        status: 'completed',
        createdAt: 0,
        updatedAt: 0,
    };
    tally(expectEq(summarizeHeartPoints(explicit), 42, 'summarize prefers stored heartPoints', errors));

    // Cardio summary computes when explicit pts missing
    const cardio: WorkoutSession = {
        ...explicit,
        heartPoints: 0,
        duration: 60 * 20,
        cardio: { activity: 'run', intensity: 'vigorous', distanceKm: 4 },
    };
    tally(expectEq(summarizeHeartPoints(cardio), 40, 'summarize derives cardio heart points', errors));

    return { passed, failed, errors };
}

export function validateCardioSessionBuilder(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;
    const tally = (ok: boolean) => (ok ? passed++ : failed++);

    const fixedNow = 1_700_000_000_000;
    const session = buildCardioWorkoutSession({
        userId: 'athlete-42',
        activity: 'run',
        durationSeconds: 60 * 30,
        distanceKm: 5,
        bodyWeightKg: 70,
        now: fixedNow,
    });

    tally(expectEq(session.userId, 'athlete-42', 'session.userId carried through', errors));
    tally(expectEq(session.templateId, 'cardio_quick', 'session.templateId tagged for cardio quick log', errors));
    tally(expectEq(session.status, 'completed', 'session marked completed', errors));
    tally(expectEq(session.exercises.length, 0, 'cardio session has no strength exercises', errors));
    tally(expectEq(session.duration, 60 * 30, 'session duration matches input', errors));
    tally(expectEq(session.startedAt, fixedNow - 60 * 30 * 1000, 'startedAt back-calculated from now', errors));
    tally(expectEq(session.endedAt, fixedNow, 'endedAt = now', errors));
    tally(expectEq(session.cardio?.activity, 'run', 'cardio.activity stored', errors));
    tally(expectEq(session.cardio?.distanceKm, 5, 'cardio.distanceKm stored', errors));
    tally(expectEq(session.cardio?.intensity, 'vigorous', 'cardio.intensity classified', errors));
    tally(expectNear(session.heartPoints ?? 0, 60, 1, '30 min vigorous run earns ~60 heart points', errors));
    tally(expectNear(session.caloriesEstimate, 343, 5, '30 min run estimates ~343 kcal', errors));

    // Two builds at different `now` produce different ids
    const a = buildCardioWorkoutSession({ userId: 'u', activity: 'walk', durationSeconds: 600, now: 1 });
    const b = buildCardioWorkoutSession({ userId: 'u', activity: 'walk', durationSeconds: 600, now: 2 });
    tally(a.id !== b.id);
    if (a.id === b.id) errors.push('✗ session.id must be unique per now timestamp');

    // Walk without distance still earns heart points (no NaN)
    const noDistSession = buildCardioWorkoutSession({
        userId: 'u',
        activity: 'walk',
        durationSeconds: 60 * 20,
        now: fixedNow,
    });
    tally(expectEq(noDistSession.cardio?.distanceKm, undefined, 'walk without distance has no km field', errors));
    tally(noDistSession.heartPoints !== undefined && noDistSession.heartPoints > 0);
    if (noDistSession.heartPoints === undefined || noDistSession.heartPoints <= 0) {
        errors.push('✗ walk session should still earn heart points without distance');
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const heart = validateHeartPoints();
    const cardio = validateCardioSessionBuilder();
    const result = {
        passed: heart.passed + cardio.passed,
        failed: heart.failed + cardio.failed,
        errors: [...heart.errors, ...cardio.errors],
    };
    console.log(`Heart Points / Cardio Validation: ${result.passed} passed, ${result.failed} failed`);
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
