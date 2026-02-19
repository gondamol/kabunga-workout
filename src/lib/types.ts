// ─── User ───
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
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

// ─── Workout ───
export interface ExerciseSet {
    id: string;
    reps: number;
    weight: number; // kg or lb based on prefs
    completed: boolean;
    rpe?: number; // Rate of Perceived Exertion 1-10
    restTaken?: number; // seconds of rest taken after this set
    completedAt?: number; // timestamp
    isWarmup?: boolean;
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
    // Tracking
    personalBest?: boolean;
    exerciseTime?: number; // seconds spent on this exercise
}

export interface WorkoutSession {
    id: string;
    userId: string;
    templateId?: string; // which template was used
    scheduledWorkoutId?: string; // link to scheduled workout
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
    type: 'workout' | 'meal' | 'challenge';
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    retries: number;
}
