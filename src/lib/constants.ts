// ─── Common exercises for quick-add ───
export const COMMON_EXERCISES = [
    'Bench Press', 'Squat', 'Deadlift', 'Overhead Press',
    'Barbell Row', 'Pull-ups', 'Push-ups', 'Dips',
    'Lat Pulldown', 'Cable Row', 'Leg Press', 'Leg Curl',
    'Leg Extension', 'Calf Raises', 'Bicep Curls', 'Tricep Pushdown',
    'Lateral Raises', 'Face Pulls', 'Plank', 'Lunges',
    'Romanian Deadlift', 'Hip Thrust', 'Chest Fly', 'Incline Press',
];

// ─── Meal presets ───
export const MEAL_PRESETS = [
    { name: 'Eggs (2)', calories: 140, protein: 12, carbs: 1, fat: 10 },
    { name: 'Chicken Breast (150g)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { name: 'Rice (1 cup)', calories: 206, protein: 4, carbs: 45, fat: 0.4 },
    { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
    { name: 'Protein Shake', calories: 120, protein: 25, carbs: 3, fat: 1 },
    { name: 'Oatmeal (1 cup)', calories: 154, protein: 5, carbs: 27, fat: 2.6 },
    { name: 'Greek Yogurt (200g)', calories: 130, protein: 20, carbs: 6, fat: 0.7 },
    { name: 'Avocado (half)', calories: 120, protein: 1.5, carbs: 6, fat: 11 },
    { name: 'Sweet Potato (medium)', calories: 103, protein: 2, carbs: 24, fat: 0.1 },
    { name: 'Salmon (150g)', calories: 280, protein: 30, carbs: 0, fat: 17 },
    { name: 'Bread (2 slices)', calories: 160, protein: 6, carbs: 30, fat: 2 },
    { name: 'Peanut Butter (2 tbsp)', calories: 190, protein: 7, carbs: 7, fat: 16 },
];

// ─── Calorie estimation per minute by intensity ───
export const CALORIES_PER_MINUTE = {
    light: 4,   // stretching, walking
    moderate: 7, // weight training
    intense: 10, // HIIT, heavy lifting
};

// ─── Challenge templates ───
export const CHALLENGE_TEMPLATES = [
    { title: '12 Workouts This Month', period: 'monthly' as const, targetCount: 12 },
    { title: '4 Workouts This Week', period: 'weekly' as const, targetCount: 4 },
    { title: '150 Workouts This Year', period: 'yearly' as const, targetCount: 150 },
    { title: 'Daily Warrior (30 days)', period: 'monthly' as const, targetCount: 30 },
    { title: '3x Week Consistency', period: 'weekly' as const, targetCount: 3 },
];
