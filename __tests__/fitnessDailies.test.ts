import {
    applyGuidedRecommendation,
    createUserDailyTrack,
    defaultFitnessDailyConfig,
    getGuidedRecommendation,
    getTrackEntry,
    isDailyComplete,
    normalizeFitnessDailyLog,
    updateTrackEntry,
} from '../src/lib/fitnessDailies.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

export function validateFitnessDailies(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const config = defaultFitnessDailyConfig('athlete-1', 1);
    if (config.activeTracks.length === 3) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Default fitness daily config should start with 3 active tracks');
    }

    const pullupTrack = createUserDailyTrack('Pullup', 0, 10);
    if (pullupTrack.stage === 'assisted' && pullupTrack.target.sets === 4 && pullupTrack.target.reps === 5) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Pullup tracks should start in guided assisted mode with the default target');
    }

    const today = normalizeFitnessDailyLog('athlete-1', '2026-04-18', config, null);
    const completed = config.activeTracks.reduce((log, track) => (
        updateTrackEntry(log, track.id, { completed: true, completedAt: 100 })
    ), today);
    if (
        isDailyComplete(completed, config)
        && config.activeTracks.every((track) => getTrackEntry(completed, track.id).completed)
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ A day should count as complete only when every active track is complete');
    }

    const guidedLogs = {
        '2026-04-18': normalizeFitnessDailyLog('athlete-1', '2026-04-18', { ...config, activeTracks: [pullupTrack] }, {
            entries: [{ trackId: pullupTrack.id, completed: true }],
            completedAt: 1,
        }),
        '2026-04-17': normalizeFitnessDailyLog('athlete-1', '2026-04-17', { ...config, activeTracks: [pullupTrack] }, {
            entries: [{ trackId: pullupTrack.id, completed: true }],
            completedAt: 1,
        }),
        '2026-04-16': normalizeFitnessDailyLog('athlete-1', '2026-04-16', { ...config, activeTracks: [pullupTrack] }, {
            entries: [{ trackId: pullupTrack.id, completed: true }],
            completedAt: 1,
        }),
        '2026-04-15': normalizeFitnessDailyLog('athlete-1', '2026-04-15', { ...config, activeTracks: [pullupTrack] }, {
            entries: [{ trackId: pullupTrack.id, completed: true }],
            completedAt: 1,
        }),
    };

    const guidance = getGuidedRecommendation(pullupTrack, guidedLogs);
    if (guidance?.actionLabel === 'Advance to bodyweight') {
        passed++;
    } else {
        failed++;
        errors.push('✗ Assisted guided tracks should recommend bodyweight progression after consistent completions');
    }

    const nextTrack = applyGuidedRecommendation(pullupTrack);
    if (nextTrack.stage === 'bodyweight') {
        passed++;
    } else {
        failed++;
        errors.push('✗ Guided recommendation should advance assisted tracks to bodyweight');
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateFitnessDailies();
    console.log(`Fitness Dailies Validation: ${result.passed} passed, ${result.failed} failed`);
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
