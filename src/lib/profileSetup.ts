import type {
    CoachMode,
    EquipmentAccess,
    ExperienceLevel,
    PreferredTrainingStyle,
    PrimaryGoal,
    SupportMode,
    TimeAvailableMinutes,
    TrainingEnvironment,
    UserOnboarding,
    UserProfile,
} from './types';

type RequiredOnboardingFields = {
    [K in 'primaryGoal' | 'trainingEnvironment' | 'supportMode' | 'experienceLevel' | 'trainingDaysPerWeek']-?: NonNullable<UserOnboarding[K]>;
};

type OptionalOnboardingFields = Pick<
    UserOnboarding,
    'equipmentAccess' | 'timeAvailableMinutes' | 'coachMode' | 'limitationNote' | 'preferredTrainingStyle'
>;

export type BuildCompletedOnboardingInput = RequiredOnboardingFields & OptionalOnboardingFields;
export type CompletedUserOnboarding = RequiredOnboardingFields & OptionalOnboardingFields & {
    completedAt: number;
};

export const DEFAULT_USER_ONBOARDING: Readonly<UserOnboarding> = Object.freeze({
    primaryGoal: null,
    trainingEnvironment: null,
    supportMode: null,
    experienceLevel: null,
    trainingDaysPerWeek: null,
    equipmentAccess: null,
    timeAvailableMinutes: null,
    coachMode: null,
    limitationNote: null,
    preferredTrainingStyle: null,
    completedAt: null,
});

export const PRIMARY_GOAL_OPTIONS = [
    'strength',
    'muscle',
    'fat_loss',
    'general_fitness',
    'mobility',
    'consistency',
    'mental_wellness',
] as const satisfies readonly PrimaryGoal[];

export const TRAINING_ENVIRONMENT_OPTIONS = [
    'full_gym',
    'minimal_equipment',
    'home_bodyweight',
    'outdoor',
    'mixed',
] as const satisfies readonly TrainingEnvironment[];

export const SUPPORT_MODE_OPTIONS = [
    'solo',
    'with_coach',
    'with_friends',
] as const satisfies readonly SupportMode[];

export const EXPERIENCE_LEVEL_OPTIONS = [
    'beginner',
    'intermediate',
    'advanced',
] as const satisfies readonly ExperienceLevel[];

export const EQUIPMENT_ACCESS_OPTIONS = [
    'none',
    'dumbbells',
    'bands',
    'barbell_gym',
    'mixed',
] as const satisfies readonly EquipmentAccess[];

export const TIME_AVAILABLE_OPTIONS = [
    5,
    10,
    20,
    30,
    45,
] as const satisfies readonly TimeAvailableMinutes[];

export const COACH_MODE_OPTIONS = [
    'training_alone',
    'training_with_coach',
    'i_am_coach',
] as const satisfies readonly CoachMode[];

export const TRAINING_STYLE_OPTIONS = [
    'simple',
    'structured',
    'intense',
    'gentle',
    'progressive',
] as const satisfies readonly PreferredTrainingStyle[];

const isPositiveInteger = (value: number | null | undefined): value is number =>
    value !== null &&
    value !== undefined &&
    Number.isInteger(value) &&
    value > 0;

const isPositiveFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
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
const isEquipmentAccess = (value: unknown): value is EquipmentAccess =>
    hasOwn(EQUIPMENT_ACCESS_LABELS, value as PropertyKey);
const isTimeAvailable = (value: unknown): value is TimeAvailableMinutes =>
    typeof value === 'number' && TIME_AVAILABLE_OPTIONS.includes(value as TimeAvailableMinutes);
const isCoachMode = (value: unknown): value is CoachMode => hasOwn(COACH_MODE_LABELS, value as PropertyKey);
const isTrainingStyle = (value: unknown): value is PreferredTrainingStyle =>
    hasOwn(TRAINING_STYLE_LABELS, value as PropertyKey);

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
    if (input.equipmentAccess !== null && input.equipmentAccess !== undefined && !isEquipmentAccess(input.equipmentAccess)) {
        throw new Error('equipmentAccess must be a valid onboarding equipment option');
    }
    if (input.timeAvailableMinutes !== null && input.timeAvailableMinutes !== undefined && !isTimeAvailable(input.timeAvailableMinutes)) {
        throw new Error('timeAvailableMinutes must be a valid onboarding time option');
    }
    if (input.coachMode !== null && input.coachMode !== undefined && !isCoachMode(input.coachMode)) {
        throw new Error('coachMode must be a valid onboarding coach mode');
    }
    if (
        input.preferredTrainingStyle !== null &&
        input.preferredTrainingStyle !== undefined &&
        !isTrainingStyle(input.preferredTrainingStyle)
    ) {
        throw new Error('preferredTrainingStyle must be a valid onboarding training style');
    }

    return {
        ...input,
        limitationNote: input.limitationNote?.trim() || null,
        completedAt: Date.now(),
    };
};

export const isProfileSetupComplete = (profile: UserProfile | null | undefined): boolean => {
    const onboarding = profile?.onboarding;
    return (
        onboarding !== null &&
        onboarding !== undefined &&
        isPrimaryGoal(onboarding.primaryGoal) &&
        isTrainingEnvironment(onboarding.trainingEnvironment) &&
        isSupportMode(onboarding.supportMode) &&
        isExperienceLevel(onboarding.experienceLevel) &&
        onboarding.trainingDaysPerWeek !== null &&
        onboarding.trainingDaysPerWeek !== undefined &&
        isPositiveInteger(onboarding.trainingDaysPerWeek) &&
        isPositiveFiniteNumber(onboarding.completedAt)
    );
};

const PRIMARY_GOAL_LABELS = {
    strength: 'Build strength',
    muscle: 'Build muscle',
    fat_loss: 'Lose fat',
    general_fitness: 'General fitness',
    mobility: 'Move better',
    consistency: 'Build consistency',
    mental_wellness: 'Mental wellness',
} satisfies Record<PrimaryGoal, string>;

const TRAINING_ENVIRONMENT_LABELS = {
    full_gym: 'Full gym',
    minimal_equipment: 'Minimal equipment',
    home_bodyweight: 'Home / bodyweight',
    outdoor: 'Outdoor',
    mixed: 'Mixed',
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

const EQUIPMENT_ACCESS_LABELS = {
    none: 'No equipment',
    dumbbells: 'Dumbbells',
    bands: 'Bands',
    barbell_gym: 'Barbell / gym',
    mixed: 'Mixed equipment',
} satisfies Record<EquipmentAccess, string>;

const TIME_AVAILABLE_LABELS = {
    5: '5 minutes',
    10: '10 minutes',
    20: '20 minutes',
    30: '30 minutes',
    45: '45+ minutes',
} satisfies Record<TimeAvailableMinutes, string>;

const COACH_MODE_LABELS = {
    training_alone: 'Training alone',
    training_with_coach: 'Training with coach',
    i_am_coach: 'I am a coach',
} satisfies Record<CoachMode, string>;

const TRAINING_STYLE_LABELS = {
    simple: 'Simple',
    structured: 'Structured',
    intense: 'Intense',
    gentle: 'Gentle',
    progressive: 'Progressive',
} satisfies Record<PreferredTrainingStyle, string>;

export const getPrimaryGoalLabel = (goal: PrimaryGoal): string => PRIMARY_GOAL_LABELS[goal];

export const getTrainingEnvironmentLabel = (environment: TrainingEnvironment): string =>
    TRAINING_ENVIRONMENT_LABELS[environment];

export const getSupportModeLabel = (mode: SupportMode): string => SUPPORT_MODE_LABELS[mode];

export const getExperienceLevelLabel = (level: ExperienceLevel): string => EXPERIENCE_LEVEL_LABELS[level];

export const getEquipmentAccessLabel = (equipment: EquipmentAccess): string => EQUIPMENT_ACCESS_LABELS[equipment];

export const getTimeAvailableLabel = (minutes: TimeAvailableMinutes): string => TIME_AVAILABLE_LABELS[minutes];

export const getCoachModeLabel = (mode: CoachMode): string => COACH_MODE_LABELS[mode];

export const getTrainingStyleLabel = (style: PreferredTrainingStyle): string => TRAINING_STYLE_LABELS[style];
