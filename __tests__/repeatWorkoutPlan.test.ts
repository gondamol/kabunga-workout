import { buildRepeatWorkoutSession } from '../src/lib/repeatWorkout.ts';
import type { WorkoutSession } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const sourceWorkout: WorkoutSession = {
    id: 'completed-workout-1',
    userId: 'athlete-original',
    templateId: 'iron-day-a',
    scheduledWorkoutId: 'coach-plan-1',
    coachNotes: 'Stay smooth and controlled',
    startedAt: 1000,
    endedAt: 4000,
    duration: 1800,
    exercises: [
        {
            id: 'exercise-1',
            name: 'Bench Press',
            sets: [
                { id: 'set-1', reps: 8, weight: 60, completed: true, completedAt: 1100, restTaken: 90 },
                { id: 'set-2', reps: 8, weight: 60, completed: true, completedAt: 1200, restTaken: 90 },
            ],
            notes: 'Touch and go',
            plannedSets: 2,
            plannedReps: 8,
            plannedWeight: 60,
            restSeconds: 90,
            cue: 'Drive feet down',
        },
        {
            id: 'exercise-2',
            name: 'Lat Pulldown',
            sets: [
                { id: 'set-3', reps: 12, weight: 45, completed: false },
                { id: 'set-4', reps: 12, weight: 45, completed: false },
            ],
            notes: '',
            restSeconds: 75,
        },
    ],
    mediaUrls: ['https://example.com/video.mp4'],
    caloriesEstimate: 420,
    notes: 'Felt strong',
    status: 'completed',
    createdAt: 900,
    updatedAt: 4100,
};

export function validateRepeatWorkoutPlan(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const repeated = buildRepeatWorkoutSession('athlete-repeat', sourceWorkout, 5000);

    if (
        repeated.userId === 'athlete-repeat'
        && repeated.status === 'active'
        && repeated.duration === 0
        && repeated.endedAt === null
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Repeat workout session metadata was not reset for a new active session');
    }

    if (
        repeated.templateId === sourceWorkout.templateId
        && repeated.scheduledWorkoutId === undefined
        && repeated.coachNotes === undefined
        && repeated.notes === ''
        && repeated.mediaUrls.length === 0
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Repeat workout session leaked coach linkage, notes, or media from the previous session');
    }

    const repeatedBench = repeated.exercises[0];
    if (
        repeatedBench.name === 'Bench Press'
        && repeatedBench.sets.length === 2
        && repeatedBench.sets.every((setItem) => !setItem.completed)
        && repeatedBench.sets.every((setItem) => setItem.completedAt === undefined && setItem.restTaken === undefined)
        && repeatedBench.sets[0]?.reps === 8
        && repeatedBench.sets[0]?.weight === 60
        && repeatedBench.restSeconds === 90
        && repeatedBench.cue === 'Drive feet down'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Repeat workout did not preserve the prior set targets or coaching metadata');
    }

    const idsReset = repeated.id !== sourceWorkout.id
        && repeated.exercises.every((exercise, index) => exercise.id !== sourceWorkout.exercises[index]?.id)
        && repeated.exercises.every((exercise, index) => (
            exercise.sets.every((setItem, setIndex) => setItem.id !== sourceWorkout.exercises[index]?.sets[setIndex]?.id)
        ));
    if (idsReset) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Repeat workout reused session, exercise, or set ids from the previous workout');
    }

    const fallbackExercise = repeated.exercises[1];
    if (
        fallbackExercise.plannedSets === 2
        && fallbackExercise.plannedReps === 12
        && fallbackExercise.plannedWeight === 45
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Repeat workout did not derive plan defaults from an exercise without planned values');
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateRepeatWorkoutPlan();
    console.log(`Repeat Workout Validation: ${result.passed} passed, ${result.failed} failed`);
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
