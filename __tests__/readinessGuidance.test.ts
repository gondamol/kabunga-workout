import { buildReadinessRecoveryGuidance, summarizeDailyNutrition } from '../src/lib/readinessGuidance.ts';
import type { Meal, ReadinessScore } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const buildReadiness = (overrides: Partial<ReadinessScore> = {}): ReadinessScore => ({
    athleteId: 'athlete-1',
    date: '2026-04-05',
    score: 10,
    status: 'excellent',
    warnings: [],
    recommendations: [],
    updatedAt: 1,
    ...overrides,
});

const buildMeal = (overrides: Partial<Meal> = {}): Meal => ({
    id: Math.random().toString(36).slice(2, 10),
    userId: 'athlete-1',
    name: 'Meal',
    calories: 500,
    protein: 35,
    carbs: 50,
    fat: 15,
    date: '2026-04-05',
    mealType: 'lunch',
    createdAt: 1,
    ...overrides,
});

export function validateReadinessGuidance(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const emptySummary = summarizeDailyNutrition([]);
    if (
        emptySummary.calories === 0
        && emptySummary.protein === 0
        && emptySummary.carbs === 0
        && emptySummary.fat === 0
        && emptySummary.mealsLogged === 0
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Empty meal summary did not return zeroed daily nutrition totals');
    }

    const poorGuidance = buildReadinessRecoveryGuidance(
        buildReadiness({ score: 2, status: 'poor', warnings: ['Low sleep quality reported'] }),
        summarizeDailyNutrition([])
    );
    if (
        poorGuidance.headline === 'Recovery-first fuel plan'
        && poorGuidance.items.some((item) => item.id === 'training-load' && item.tone === 'red')
        && poorGuidance.items.some((item) => item.id === 'first-meal')
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Poor readiness guidance did not prioritize recovery work and early fueling');
    }

    const goodGuidance = buildReadinessRecoveryGuidance(
        buildReadiness({ score: 7, status: 'good' }),
        summarizeDailyNutrition([
            buildMeal({ protein: 25, carbs: 30, calories: 260, mealType: 'breakfast' }),
        ])
    );
    if (
        goodGuidance.headline === 'Fuel the session'
        && goodGuidance.items.some((item) => item.id === 'protein-gap')
        && goodGuidance.items.some((item) => item.id === 'energy-support')
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Good readiness guidance did not flag the protein and fueling gaps');
    }

    const excellentGuidance = buildReadinessRecoveryGuidance(
        buildReadiness({ score: 9, status: 'excellent' }),
        summarizeDailyNutrition([
            buildMeal({ protein: 45, carbs: 70, calories: 650, mealType: 'breakfast' }),
            buildMeal({ protein: 50, carbs: 80, calories: 700, mealType: 'lunch' }),
            buildMeal({ protein: 55, carbs: 70, calories: 700, mealType: 'dinner' }),
        ])
    );
    if (
        excellentGuidance.summary.includes('3 meals logged')
        && excellentGuidance.items.some((item) => item.id === 'on-track' && item.tone === 'green')
        && excellentGuidance.items.length <= 3
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Excellent readiness guidance did not switch to a positive on-track message');
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateReadinessGuidance();
    console.log(`Readiness Guidance Validation: ${result.passed} passed, ${result.failed} failed`);
    if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach((error) => console.error(error));
    } else {
        console.log('✓ All validations passed!');
    }
    return result;
};

if (typeof process !== 'undefined' && typeof window === 'undefined') {
    const result = reportValidationResult();
    if (result.failed > 0) process.exitCode = 1;
}
