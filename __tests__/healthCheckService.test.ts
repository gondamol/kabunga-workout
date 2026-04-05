import { buildWeeklyReadinessTrend, calculateReadinessScore } from '../src/lib/healthCheckService.ts';
import { runQueuedAction } from '../src/lib/offlineQueueRunner.ts';
import type { HealthCheck, QueuedAction } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const buildCheck = (overrides: Partial<HealthCheck> = {}): HealthCheck => ({
    athleteId: 'athlete-1',
    date: '2026-04-05',
    sleepQuality: 4,
    soreness: 4,
    mood: 'normal',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
});

export async function validateHealthCheckService(): Promise<ValidationResult> {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const neutral = calculateReadinessScore(buildCheck());
    if (neutral.score === 10 && neutral.status === 'excellent') passed++;
    else {
        failed++;
        errors.push(`✗ Neutral check scored ${neutral.score}/${neutral.status} instead of 10/excellent`);
    }

    const lowSleep = calculateReadinessScore(buildCheck({ sleepQuality: 2 }));
    if (lowSleep.score === 7 && lowSleep.status === 'good') passed++;
    else {
        failed++;
        errors.push(`✗ Low sleep check scored ${lowSleep.score}/${lowSleep.status} instead of 7/good`);
    }

    const highSoreness = calculateReadinessScore(buildCheck({ soreness: 8 }));
    if (highSoreness.score === 8 && highSoreness.status === 'excellent') passed++;
    else {
        failed++;
        errors.push(`✗ High soreness check scored ${highSoreness.score}/${highSoreness.status} instead of 8/excellent`);
    }

    const poorRecovery = calculateReadinessScore(buildCheck({
        sleepQuality: 2,
        soreness: 8,
        mood: 'tired',
        painNotes: 'left knee pain',
    }));
    if (poorRecovery.score === 2 && poorRecovery.status === 'poor') passed++;
    else {
        failed++;
        errors.push(`✗ Poor recovery check scored ${poorRecovery.score}/${poorRecovery.status} instead of 2/poor`);
    }

    const trend = buildWeeklyReadinessTrend('2026-04-01', {
        '2026-04-01': neutral,
        '2026-04-03': poorRecovery,
        '2026-04-07': highSoreness,
    });
    const trendDates = trend.map((point) => point.date);
    const missingDaysAreNull = trend[1]?.score === null && trend[3]?.score === null;
    if (trend.length === 7 && trendDates[0] === '2026-04-01' && trendDates[6] === '2026-04-07' && missingDaysAreNull) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Weekly readiness trend did not return 7 ordered days with null scores for missing dates');
    }

    const privacySafe = poorRecovery.warnings.some((warning) => warning === 'Pain or injury reported')
        && !poorRecovery.warnings.some((warning) => warning.includes('left knee pain'))
        && !('bodyWeightKg' in (poorRecovery as Record<string, unknown>))
        && !('bodyFatPercent' in (poorRecovery as Record<string, unknown>))
        && !('painNotes' in (poorRecovery as Record<string, unknown>));
    if (privacySafe) passed++;
    else {
        failed++;
        errors.push('✗ Coach-facing readiness summary exposed raw body metrics or raw pain text');
    }

    let queuedCheck: HealthCheck | null = null;
    const queuedAction: QueuedAction = {
        id: 'queued-health-check',
        type: 'healthCheck',
        action: 'create',
        data: buildCheck({ sleepQuality: 5 }),
        timestamp: Date.now(),
        retries: 0,
    };

    await runQueuedAction(queuedAction, {
        saveWorkout: async () => undefined,
        saveMeal: async () => undefined,
        saveChallenge: async () => undefined,
        saveOneRepMaxes: async () => undefined,
        saveFitnessDailyLog: async () => undefined,
        saveHealthCheck: async (check) => {
            queuedCheck = check;
        },
    });

    if (queuedCheck?.athleteId === 'athlete-1' && queuedCheck.sleepQuality === 5) passed++;
    else {
        failed++;
        errors.push('✗ Offline queue handler did not route health checks through the queue processor');
    }

    return { passed, failed, errors };
}

const reportValidationResult = async () => {
    const result = await validateHealthCheckService();
    console.log(`Health Check Validation: ${result.passed} passed, ${result.failed} failed`);
    if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach((error) => console.error(error));
    } else {
        console.log('✓ All validations passed!');
    }
    return result;
};

if (typeof process !== 'undefined' && typeof window === 'undefined') {
    const result = await reportValidationResult();
    if (result.failed > 0) process.exitCode = 1;
}
