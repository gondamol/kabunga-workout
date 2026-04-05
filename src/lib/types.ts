// ─── User ───
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    role?: UserRole;
    coachCode?: string | null;
    oneRepMaxPromptSnoozeUntil?: number | null;
    oneRepMaxPromptLastShownAt?: number | null;
    createdAt: number;
    updatedAt: number;
}

export type UserRole = 'athlete' | 'coach';

export interface CoachCode {
    code: string;
    coachId: string;
    coachName: string;
    coachEmail: string;
    createdAt: number;
    updatedAt: number;
}

export interface CoachAthleteLink {
    athleteId: string;
    athleteName: string;
    athleteEmail: string;
    coachId: string;
    coachName: string;
    coachEmail: string;
    coachCode: string;
    status: 'active' | 'paused';
    createdAt: number;
    updatedAt: number;
}

export interface CoachPlanExercise {
    name: string;
    sets: number;
    reps: number;
    weight: number;
    restSeconds: number;
    cue: string;
}

export interface CoachWorkoutPlan {
    id: string;
    coachId: string;
    coachName: string;
    athleteId: string;
    athleteName: string;
    title: string;
    scheduledDate: string; // YYYY-MM-DD
    notes: string;
    exercises: CoachPlanExercise[];
    status: 'scheduled' | 'completed' | 'cancelled';
    completedWorkoutId?: string;
    completedAt?: number;
    progressCompletedSets?: number;
    progressTotalSets?: number;
    progressCurrentExercise?: string;
    progressUpdatedAt?: number;
    athleteInSession?: boolean;
    createdAt: number;
    updatedAt: number;
}

// ─── User Preferences ───
export interface UserPreferences {
    userId: string;
    units: 'kg' | 'lb';
    defaultRestSeconds: number;
    progressionStyle: 'linear' | 'double' | 'maintenance';
    weeklyGoal: number;
    notifications: boolean;
    createdAt: number;
}

// ─── Iron Protocol 1RMs ───
export interface OneRepMaxes {
    userId: string;
    benchPress: number;    // kg
    backSquat: number;     // kg
    overheadPress: number; // kg
    bentOverRow: number;   // kg
    romanianDL: number;    // kg
    updatedAt: number;
}

export interface ExerciseCatalogItem {
    id: string;
    name: string;
    bodyPart: string;
    targetMuscle: string;
    equipment: string;
    equipmentList?: string[];
    exerciseType?: string | null;
    difficulty?: string | null;
    gifUrl: string | null;
    muscleImageUrl?: string | null;
    instructions: string[];
    safetyInfo?: string | null;
    source: 'api' | 'local';
}

// ─── Fitness Dailies Tracking ───
export interface FitnessDailyLog {
    userId: string;
    date: string; // YYYY-MM-DD
    legRaisesDone: boolean;
    armCurlsDone: boolean;
    barHangDone: boolean;
    completedAt: number;
}

// ─── Health / Readiness ───
export type HealthMood = 'energetic' | 'normal' | 'tired';
export type ReadinessStatus = 'excellent' | 'good' | 'moderate' | 'poor';

export interface HealthCheck {
    athleteId: string;
    date: string; // YYYY-MM-DD
    sleepQuality: 1 | 2 | 3 | 4 | 5;
    soreness: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    mood: HealthMood;
    bodyWeightKg?: number;
    bodyFatPercent?: number;
    painNotes?: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ReadinessScore {
    athleteId: string;
    date: string;
    score: number;
    status: ReadinessStatus;
    warnings: string[];
    recommendations: string[];
    updatedAt: number;
}

export interface ReadinessTrendPoint {
    date: string;
    score: number | null;
    status: ReadinessStatus | null;
}

// ─── Workout ───
export type IronSetType = 'warmup' | 'working' | 'heavy' | 'backoff' | 'accessories';

export interface ExerciseSet {
    id: string;
    reps: number;
    weight: number; // kg or lb based on prefs
    completed: boolean;
    rpe?: number; // Rate of Perceived Exertion 1-10
    restTaken?: number; // seconds of rest taken after this set
    completedAt?: number; // timestamp
    isWarmup?: boolean;
    personalBest?: boolean;
    setType?: IronSetType;
}

export interface Exercise {
    id: string;
    name: string;
    sets: ExerciseSet[];
    notes: string;
    // Planning fields (from template)
    plannedSets?: number;
    plannedReps?: number;
    plannedWeight?: number;
    restSeconds?: number; // per-exercise rest override
    cue?: string; // coaching cue text
    isWarmup?: boolean;
    phaseName?: string;
    phaseType?: IronSetType;
    // Tracking
    personalBest?: boolean;
    exerciseTime?: number; // seconds spent on this exercise
}

export interface WorkoutSession {
    id: string;
    userId: string;
    templateId?: string; // which template was used
    scheduledWorkoutId?: string; // link to scheduled workout
    coachNotes?: string; // immutable notes from assigned coach plan
    startedAt: number;
    endedAt: number | null;
    duration: number; // seconds
    exercises: Exercise[];
    mediaUrls: string[];
    caloriesEstimate: number;
    notes: string;
    status: 'active' | 'completed' | 'cancelled';
    createdAt: number;
    updatedAt: number;
}

// ─── Workout Templates ───
export interface TemplateExercise {
    name: string;
    sets: number;
    reps: number;
    weight: number;
    restSeconds: number;
    isWarmup: boolean;
    cue: string;
}

export interface WorkoutPhase {
    name: string; // "Warmup", "Main Lifts", "Accessories", "Cooldown"
    duration?: number; // optional time limit in seconds
    exercises: TemplateExercise[];
}

export interface WorkoutTemplate {
    id: string;
    userId: string; // "SYSTEM" for built-in templates
    title: string;
    category: string;
    goalFocus: 'strength' | 'hypertrophy' | 'endurance' | 'general';
    phases: WorkoutPhase[];
    progressionRule: 'linear' | 'double' | 'maintenance';
    createdAt: number;
    updatedAt: number;
}

// ─── Scheduled Workouts ───
export type ScheduledStatus = 'scheduled' | 'completed' | 'skipped' | 'rescheduled';

export interface ScheduledWorkout {
    id: string;
    userId: string;
    templateId: string;
    title: string;
    scheduledDate: string; // YYYY-MM-DD
    scheduledTime?: string; // HH:mm
    status: ScheduledStatus;
    completedSessionId?: string;
    skippedReason?: string;
    createdAt: number;
}

// ─── Exercise History (for progressive overload) ───
export interface ExerciseHistory {
    name: string; // normalized exercise name
    sessions: Array<{
        date: number;
        sets: Array<{ reps: number; weight: number; rpe?: number }>;
        bestSet: { reps: number; weight: number }; // heaviest weight at target reps
    }>;
}

// ─── Challenge ───
export type ChallengePeriod = 'weekly' | 'monthly' | 'yearly';

export interface Challenge {
    id: string;
    userId: string;
    title: string;
    description: string;
    period: ChallengePeriod;
    targetCount: number;
    currentCount: number;
    startDate: number;
    endDate: number;
    completed: boolean;
    createdAt: number;
}

// ─── Community ───
export type CommunityGroupKind = 'women' | 'men' | 'mixed' | 'coach';

export interface CommunityGroup {
    id: string;
    name: string;
    description: string;
    kind: CommunityGroupKind;
    ownerId: string;
    ownerName: string;
    isPublic: boolean;
    inviteCode?: string;
    memberIds: string[];
    createdAt: number;
    updatedAt: number;
}

export interface CommunityInvite {
    code: string;
    groupId: string;
    groupName: string;
    ownerId: string;
    ownerName: string;
    status: 'active' | 'revoked';
    createdAt: number;
    updatedAt: number;
}

export interface CommunityMessage {
    id: string;
    groupId: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: number;
    updatedAt: number;
}

// ─── Nutrition ───
export interface Meal {
    id: string;
    userId: string;
    name: string;
    calories: number;
    protein: number; // grams
    carbs: number;
    fat: number;
    date: string; // YYYY-MM-DD
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    createdAt: number;
}

export interface DailyNutrition {
    date: string;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    meals: Meal[];
}

// ─── Dashboard ───
export interface DashboardStats {
    totalWorkouts: number;
    totalDuration: number; // seconds
    totalCaloriesBurned: number;
    currentStreak: number;
    weeklyWorkouts: number;
    monthlyWorkouts: number;
}

// ─── Offline Queue ───
export interface QueuedAction {
    id: string;
    type: 'workout' | 'meal' | 'challenge' | 'oneRepMaxes' | 'fitnessDaily' | 'healthCheck';
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    retries: number;
}
