import type { Meal, ReadinessScore, ReadinessStatus } from './types';

export type GuidanceTone = 'green' | 'cyan' | 'amber' | 'red';

export interface DailyNutritionSnapshot {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealsLogged: number;
}

export interface ReadinessGuidanceItem {
    id: string;
    title: string;
    detail: string;
    tone: GuidanceTone;
}

export interface ReadinessGuidance {
    headline: string;
    summary: string;
    items: ReadinessGuidanceItem[];
}

const TARGETS_BY_STATUS: Record<ReadinessStatus, { protein: number; carbs: number; calories: number }> = {
    poor: { protein: 110, carbs: 140, calories: 1400 },
    moderate: { protein: 120, carbs: 160, calories: 1600 },
    good: { protein: 130, carbs: 180, calories: 1800 },
    excellent: { protein: 140, carbs: 200, calories: 2000 },
};

const HEADLINE_BY_STATUS: Record<ReadinessStatus, string> = {
    poor: 'Recovery-first fuel plan',
    moderate: 'Protect recovery and keep fuel steady',
    good: 'Fuel the session',
    excellent: 'Fuel the green light',
};

const addItem = (items: ReadinessGuidanceItem[], item: ReadinessGuidanceItem) => {
    if (!items.some((existing) => existing.id === item.id)) {
        items.push(item);
    }
};

const getMacroGap = (target: number, current: number) => Math.max(0, Math.round(target - current));

const getNutritionSummary = (nutrition: DailyNutritionSnapshot): string => {
    if (nutrition.mealsLogged === 0) {
        return 'No meals logged yet today. Start recovery support early.';
    }

    return `${nutrition.mealsLogged} meals logged • ${nutrition.protein}g protein • ${nutrition.carbs}g carbs`;
};

export const summarizeDailyNutrition = (meals: Meal[]): DailyNutritionSnapshot => {
    return meals.reduce<DailyNutritionSnapshot>((summary, meal) => ({
        calories: summary.calories + meal.calories,
        protein: summary.protein + meal.protein,
        carbs: summary.carbs + meal.carbs,
        fat: summary.fat + meal.fat,
        mealsLogged: summary.mealsLogged + 1,
    }), {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        mealsLogged: 0,
    });
};

export const buildReadinessRecoveryGuidance = (
    readiness: ReadinessScore,
    nutrition: DailyNutritionSnapshot
): ReadinessGuidance => {
    const items: ReadinessGuidanceItem[] = [];
    const targets = TARGETS_BY_STATUS[readiness.status];
    const proteinGap = getMacroGap(targets.protein, nutrition.protein);
    const carbGap = getMacroGap(targets.carbs, nutrition.carbs);
    const calorieGap = getMacroGap(targets.calories, nutrition.calories);

    if (readiness.status === 'poor') {
        addItem(items, {
            id: 'training-load',
            title: 'Shift to recovery work',
            detail: 'If you train, keep it short and easy. Mobility, walking, and technique work beat grinders today.',
            tone: 'red',
        });
    } else if (readiness.status === 'moderate') {
        addItem(items, {
            id: 'training-load',
            title: 'Keep the main work, trim the extras',
            detail: 'Protect energy by cutting bonus volume if the warm-up still feels heavy.',
            tone: 'amber',
        });
    } else if (readiness.status === 'good') {
        addItem(items, {
            id: 'training-load',
            title: 'You are clear to train',
            detail: 'Run the plan, but keep the first working sets honest before you chase load.',
            tone: 'cyan',
        });
    } else {
        addItem(items, {
            id: 'training-load',
            title: 'Performance window is open',
            detail: 'Normal session is on. Stay disciplined with your warm-up and fuel around the workout.',
            tone: 'green',
        });
    }

    if (nutrition.mealsLogged === 0) {
        addItem(items, {
            id: 'first-meal',
            title: 'Get the first meal in early',
            detail: 'Lead with protein plus easy carbs so recovery does not get pushed to the end of the day.',
            tone: readiness.status === 'poor' ? 'amber' : 'cyan',
        });
    } else if (proteinGap >= 20) {
        addItem(items, {
            id: 'protein-gap',
            title: 'Close the protein gap',
            detail: `You are at ${nutrition.protein}g so far. Add roughly ${proteinGap}g protein across your next meal or shake.`,
            tone: readiness.status === 'excellent' ? 'green' : 'amber',
        });
    }

    if (calorieGap > 0 && (carbGap >= 40 || nutrition.mealsLogged < 2)) {
        addItem(items, {
            id: 'energy-support',
            title: readiness.score <= 5 ? 'Choose easy recovery carbs' : 'Top up training fuel',
            detail: readiness.score <= 5
                ? `Energy is still light at ${nutrition.calories} kcal. Add fruit, oats, rice, bread, or potatoes with fluids.`
                : 'Calories and carbs are still building. Add a simple carb source before or after training to stay ahead.',
            tone: readiness.score <= 5 ? 'amber' : 'cyan',
        });
    }

    addItem(items, {
        id: 'hydration',
        title: readiness.score <= 5 ? 'Hydrate and protect tonight' : 'Keep hydration steady',
        detail: readiness.score <= 5
            ? 'Keep water moving, include something salty, and make sleep the main recovery target tonight.'
            : 'Keep water steady between meals and finish with a real dinner instead of chasing calories late.',
        tone: readiness.score <= 5 ? 'amber' : 'cyan',
    });

    if (proteinGap < 20 && carbGap < 40 && calorieGap === 0 && nutrition.mealsLogged > 0) {
        addItem(items, {
            id: 'on-track',
            title: 'Fueling is on track',
            detail: 'Your food log already supports today’s readiness. Keep protein spread through the rest of the day.',
            tone: readiness.status === 'excellent' ? 'green' : 'cyan',
        });
    }

    return {
        headline: HEADLINE_BY_STATUS[readiness.status],
        summary: getNutritionSummary(nutrition),
        items: items.slice(0, 3),
    };
};
