import {
    DEFAULT_USER_ONBOARDING,
    buildCompletedOnboarding,
    getExperienceLevelLabel,
    getPrimaryGoalLabel,
    getSupportModeLabel,
    getTrainingEnvironmentLabel,
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

    if (isProfileSetupComplete(null) === false) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Null profile should be incomplete');
    }

    if (isProfileSetupComplete(undefined) === false) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Undefined profile should be incomplete');
    }

    if (isProfileSetupComplete(buildProfile({ onboarding: DEFAULT_USER_ONBOARDING })) === false) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Default onboarding should be incomplete');
    }

    const missingField = buildProfile({
        onboarding: {
            primaryGoal: 'strength',
            trainingEnvironment: null,
            supportMode: 'solo',
            experienceLevel: 'intermediate',
            trainingDaysPerWeek: 4,
            completedAt: Date.now(),
        },
    });
    if (isProfileSetupComplete(missingField) === false) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Missing onboarding field should be incomplete');
    }

    const completedOnboarding = buildCompletedOnboarding({
        primaryGoal: 'strength',
        trainingEnvironment: 'full_gym',
        supportMode: 'solo',
        experienceLevel: 'intermediate',
        trainingDaysPerWeek: 4,
    });
    const completed = buildProfile({
        onboarding: completedOnboarding,
    });
    if (isProfileSetupComplete(completed) === true) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Completed onboarding should be treated as complete');
    }

    const invalidTrainingDaysCases = [
        { value: 0, label: 'zero' },
        { value: -1, label: 'negative' },
        { value: Number.NaN, label: 'NaN' },
    ];
    invalidTrainingDaysCases.forEach(({ value, label }) => {
        const invalidDays = buildProfile({
            onboarding: buildCompletedOnboarding({
                primaryGoal: 'muscle',
                trainingEnvironment: 'minimal_equipment',
                supportMode: 'with_friends',
                experienceLevel: 'beginner',
                trainingDaysPerWeek: value,
            }),
        });
        if (isProfileSetupComplete(invalidDays) === false) {
            passed++;
        } else {
            failed++;
            errors.push(`✗ ${label} training days should be incomplete`);
        }
    });

    const labelExpectations: Array<[string, string, string]> = [
        ['strength', getPrimaryGoalLabel('strength'), 'Build strength'],
        ['muscle', getPrimaryGoalLabel('muscle'), 'Build muscle'],
        ['fat_loss', getPrimaryGoalLabel('fat_loss'), 'Lose fat'],
        ['general_fitness', getPrimaryGoalLabel('general_fitness'), 'General fitness'],
        ['full_gym', getTrainingEnvironmentLabel('full_gym'), 'Full gym'],
        ['minimal_equipment', getTrainingEnvironmentLabel('minimal_equipment'), 'Minimal equipment'],
        ['home_bodyweight', getTrainingEnvironmentLabel('home_bodyweight'), 'Home / bodyweight'],
        ['solo', getSupportModeLabel('solo'), 'Solo'],
        ['with_coach', getSupportModeLabel('with_coach'), 'With coach'],
        ['with_friends', getSupportModeLabel('with_friends'), 'With friends'],
        ['beginner', getExperienceLevelLabel('beginner'), 'Beginner'],
        ['intermediate', getExperienceLevelLabel('intermediate'), 'Intermediate'],
        ['advanced', getExperienceLevelLabel('advanced'), 'Advanced'],
    ];

    labelExpectations.forEach(([value, actual, expected], index) => {
        if (actual === expected) {
            passed++;
        } else {
            failed++;
            errors.push(`✗ Label helper check ${index + 1} failed for ${value}`);
        }
    });

    return { passed, failed, errors };
}

const result = validateProfileSetup();
console.log(`Profile Setup Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
}
