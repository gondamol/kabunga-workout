import type {
    ExperienceLevel,
    PrimaryGoal,
    SupportMode,
    TrainingEnvironment,
    UserOnboarding,
    UserProfile,
} from './types';

type StrictOnboardingFields = {
    [K in keyof Omit<UserOnboarding, 'completedAt'>]-?: NonNullable<UserOnboarding[K]>;
};

export type BuildCompletedOnboardingInput = StrictOnboardingFields;
export type CompletedUserOnboarding = StrictOnboardingFields & {
    completedAt: number;
};

export const DEFAULT_USER_ONBOARDING: Readonly<UserOnboarding> = Object.freeze({
    primaryGoal: null,
    trainingEnvironment: null,
    supportMode: null,
    experienceLevel: null,
    trainingDaysPerWeek: null,
    completedAt: null,
});

const isPositiveInteger = (value: number | null | undefined): value is number =>
    value !== null &&
    value !== undefined &&
    Number.isInteger(value) &&
    value > 0;

const hasOwn = <T extends object, K extends PropertyKey>(
    object: T,
    key: K
): key is K & keyof T => Object.prototype.hasOwnProperty.call(object, key);

const isPrimaryGoal = (value: unknown): value is PrimaryGoal => hasOwn(PRIMARY_GOAL_LABELS, value as PropertyKey);
const isTrainingEnvironment = (value: unknown): value is TrainingEnvironment =>
    hasOwn(TRAINING_ENVIRONMENT_LABELS, value as PropertyKey);
const isSupportMode = (value: unknown): value is SupportMode => hasOwn(SUPPORT_MODE_LABELS, value as PropertyKey);
const isExperienceLevel = (value: unknown): value is ExperienceLevel =>
    hasOwn(EXPERIENCE_LEVEL_LABELS, value as PropertyKey);

export const buildCompletedOnboarding = (
    input: BuildCompletedOnboardingInput
): CompletedUserOnboarding => {
    if (!isPrimaryGoal(input.primaryGoal)) {
        throw new Error('primaryGoal must be a valid onboarding goal');
    }
    if (!isTrainingEnvironment(input.trainingEnvironment)) {
        throw new Error('trainingEnvironment must be a valid onboarding environment');
    }
    if (!isSupportMode(input.supportMode)) {
        throw new Error('supportMode must be a valid onboarding support mode');
    }
    if (!isExperienceLevel(input.experienceLevel)) {
        throw new Error('experienceLevel must be a valid onboarding experience level');
    }
    if (!isPositiveInteger(input.trainingDaysPerWeek)) {
        throw new Error('trainingDaysPerWeek must be a positive integer');
    }

    return {
        ...input,
        completedAt: Date.now(),
    };
};

export const isProfileSetupComplete = (profile: UserProfile | null | undefined): boolean => {
    const onboarding = profile?.onboarding;
    return (
        onboarding !== null &&
        onboarding !== undefined &&
        onboarding.primaryGoal !== null &&
        onboarding.primaryGoal !== undefined &&
        onboarding.trainingEnvironment !== null &&
        onboarding.trainingEnvironment !== undefined &&
        onboarding.supportMode !== null &&
        onboarding.supportMode !== undefined &&
        onboarding.experienceLevel !== null &&
        onboarding.experienceLevel !== undefined &&
        onboarding.trainingDaysPerWeek !== null &&
        onboarding.trainingDaysPerWeek !== undefined &&
        isPositiveInteger(onboarding.trainingDaysPerWeek) &&
        onboarding.completedAt !== null &&
        onboarding.completedAt !== undefined
    );
};

const PRIMARY_GOAL_LABELS = {
    strength: 'Build strength',
    muscle: 'Build muscle',
    fat_loss: 'Lose fat',
    general_fitness: 'General fitness',
} satisfies Record<PrimaryGoal, string>;

const TRAINING_ENVIRONMENT_LABELS = {
    full_gym: 'Full gym',
    minimal_equipment: 'Minimal equipment',
    home_bodyweight: 'Home / bodyweight',
} satisfies Record<TrainingEnvironment, string>;

const SUPPORT_MODE_LABELS = {
    solo: 'Solo',
    with_coach: 'With coach',
    with_friends: 'With friends',
} satisfies Record<SupportMode, string>;

const EXPERIENCE_LEVEL_LABELS = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
} satisfies Record<ExperienceLevel, string>;

export const getPrimaryGoalLabel = (goal: PrimaryGoal): string => PRIMARY_GOAL_LABELS[goal];

export const getTrainingEnvironmentLabel = (environment: TrainingEnvironment): string =>
    TRAINING_ENVIRONMENT_LABELS[environment];

export const getSupportModeLabel = (mode: SupportMode): string => SUPPORT_MODE_LABELS[mode];

export const getExperienceLevelLabel = (level: ExperienceLevel): string => EXPERIENCE_LEVEL_LABELS[level];
