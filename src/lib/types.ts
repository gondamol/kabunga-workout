// ─── User ───
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    createdAt: number;
    updatedAt: number;
}

// ─── Workout ───
export interface ExerciseSet {
    id: string;
    reps: number;
    weight: number; // kg
    completed: boolean;
}

export interface Exercise {
    id: string;
    name: string;
    sets: ExerciseSet[];
    notes: string;
}

export interface WorkoutSession {
    id: string;
    userId: string;
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
