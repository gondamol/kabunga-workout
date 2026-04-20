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

const buildBareProfile = (): UserProfile =>
    ({
        uid: 'user-1',
        email: 'athlete@example.com',
        displayName: 'Aurel',
        photoURL: null,
        role: 'athlete',
        coachCode: null,
        createdAt: 1,
        updatedAt: 1,
    }) as UserProfile;

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

    if (isProfileSetupComplete(buildBareProfile()) === false) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Omitted onboarding should be incomplete');
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

    const undefinedCompletedAt = buildProfile({
        onboarding: {
            primaryGoal: 'strength',
            trainingEnvironment: 'full_gym',
            supportMode: 'solo',
            experienceLevel: 'intermediate',
            trainingDaysPerWeek: 4,
            completedAt: undefined,
        },
    });
    if (isProfileSetupComplete(undefinedCompletedAt) === false) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Undefined completedAt should be incomplete');
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
        try {
            buildCompletedOnboarding({
                primaryGoal: 'muscle',
                trainingEnvironment: 'minimal_equipment',
                supportMode: 'with_friends',
                experienceLevel: 'beginner',
                trainingDaysPerWeek: value,
            });
            failed++;
            errors.push(`✗ ${label} training days should throw`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === 'trainingDaysPerWeek must be a positive integer') {
                passed++;
            } else {
                failed++;
                errors.push(`✗ ${label} training days threw the wrong error`);
            }
        }
    });

    const invalidOnboardingInputs = [
        {
            label: 'goal',
            input: {
                primaryGoal: 'invalid-goal' as never,
                trainingEnvironment: 'full_gym',
                supportMode: 'solo',
                experienceLevel: 'intermediate',
                trainingDaysPerWeek: 4,
            },
            message: 'primaryGoal must be a valid onboarding goal',
        },
        {
            label: 'environment',
            input: {
                primaryGoal: 'strength',
                trainingEnvironment: 'warehouse' as never,
                supportMode: 'solo',
                experienceLevel: 'intermediate',
                trainingDaysPerWeek: 4,
            },
            message: 'trainingEnvironment must be a valid onboarding environment',
        },
        {
            label: 'support',
            input: {
                primaryGoal: 'strength',
                trainingEnvironment: 'full_gym',
                supportMode: 'crew' as never,
                experienceLevel: 'intermediate',
                trainingDaysPerWeek: 4,
            },
            message: 'supportMode must be a valid onboarding support mode',
        },
        {
            label: 'experience',
            input: {
                primaryGoal: 'strength',
                trainingEnvironment: 'full_gym',
                supportMode: 'solo',
                experienceLevel: 'expert' as never,
                trainingDaysPerWeek: 4,
            },
            message: 'experienceLevel must be a valid onboarding experience level',
        },
    ] as const;

    invalidOnboardingInputs.forEach(({ label, input, message }) => {
        try {
            buildCompletedOnboarding(input);
            failed++;
            errors.push(`✗ Invalid ${label} should throw`);
        } catch (error) {
            const actualMessage = error instanceof Error ? error.message : String(error);
            if (actualMessage === message) {
                passed++;
            } else {
                failed++;
                errors.push(`✗ Invalid ${label} threw the wrong error`);
            }
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
