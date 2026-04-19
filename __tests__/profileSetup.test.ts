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

type CompletedOnboardingInput = Parameters<typeof buildCompletedOnboarding>[0];

const validateCompletedOnboardingInput = (input: CompletedOnboardingInput): CompletedOnboardingInput => input;

// @ts-expect-error buildCompletedOnboarding should reject nullable fields
buildCompletedOnboarding({
    primaryGoal: null,
    trainingEnvironment: 'full_gym',
    supportMode: 'solo',
    experienceLevel: 'intermediate',
    trainingDaysPerWeek: 4,
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

    const completedOnboarding = buildCompletedOnboarding(validateCompletedOnboardingInput({
        primaryGoal: 'strength',
        trainingEnvironment: 'full_gym',
        supportMode: 'solo',
        experienceLevel: 'intermediate',
        trainingDaysPerWeek: 4,
    }));
    const completed = buildProfile({
        onboarding: completedOnboarding,
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

    if (getTrainingEnvironmentLabel('minimal_equipment') === 'Minimal equipment') {
        passed++;
    } else {
        failed++;
        errors.push('✗ Training environment label should be human-readable');
    }

    if (getSupportModeLabel('with_coach') === 'With coach') {
        passed++;
    } else {
        failed++;
        errors.push('✗ Support mode label should be human-readable');
    }

    if (getExperienceLevelLabel('advanced') === 'Advanced') {
        passed++;
    } else {
        failed++;
        errors.push('✗ Experience level label should be human-readable');
    }

    return { passed, failed, errors };
}

const result = validateProfileSetup();
console.log(`Profile Setup Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
}
