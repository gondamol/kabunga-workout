import type {
    ExperienceLevel,
    PrimaryGoal,
    SupportMode,
    TrainingEnvironment,
    UserOnboarding,
    UserProfile,
} from './types';

export interface CompletedUserOnboarding {
    primaryGoal: PrimaryGoal;
    trainingEnvironment: TrainingEnvironment;
    supportMode: SupportMode;
    experienceLevel: ExperienceLevel;
    trainingDaysPerWeek: number;
    completedAt: number;
}

export type BuildCompletedOnboardingInput = {
    primaryGoal: PrimaryGoal;
    trainingEnvironment: TrainingEnvironment;
    supportMode: SupportMode;
    experienceLevel: ExperienceLevel;
    trainingDaysPerWeek: number;
};

export const DEFAULT_USER_ONBOARDING: UserOnboarding = {
    primaryGoal: null,
    trainingEnvironment: null,
    supportMode: null,
    experienceLevel: null,
    trainingDaysPerWeek: null,
    completedAt: null,
};

export const buildCompletedOnboarding = (
    input: BuildCompletedOnboardingInput
): CompletedUserOnboarding => ({
    ...input,
    completedAt: Date.now(),
});

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
        onboarding.completedAt !== null &&
        onboarding.completedAt !== undefined
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
