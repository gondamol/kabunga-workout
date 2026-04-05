import type { Exercise, ExerciseSet, WorkoutSession } from './types';

const generateId = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const getRepeatSourceSets = (exercise: Exercise): ExerciseSet[] => {
    const completedSets = exercise.sets.filter((setItem) => setItem.completed);
    return completedSets.length > 0 ? completedSets : exercise.sets;
};

const cloneRepeatSets = (exercise: Exercise): ExerciseSet[] => {
    return getRepeatSourceSets(exercise).map((setItem) => ({
        id: generateId(),
        reps: setItem.reps,
        weight: setItem.weight,
        completed: false,
        rpe: setItem.rpe,
        isWarmup: setItem.isWarmup,
        setType: setItem.setType,
    }));
};

const cloneRepeatExercise = (exercise: Exercise): Exercise => {
    const sets = cloneRepeatSets(exercise);
    const firstSet = sets[0];

    return {
        ...exercise,
        id: generateId(),
        sets,
        exerciseTime: undefined,
        personalBest: false,
        plannedSets: exercise.plannedSets ?? sets.length,
        plannedReps: exercise.plannedReps ?? firstSet?.reps,
        plannedWeight: exercise.plannedWeight ?? firstSet?.weight,
    };
};

export const buildRepeatWorkoutSession = (
    userId: string,
    sourceWorkout: WorkoutSession,
    now = Date.now()
): WorkoutSession => {
    return {
        id: generateId(),
        userId,
        templateId: sourceWorkout.templateId,
        startedAt: now,
        endedAt: null,
        duration: 0,
        exercises: sourceWorkout.exercises.map(cloneRepeatExercise),
        mediaUrls: [],
        caloriesEstimate: 0,
        notes: '',
        status: 'active',
        createdAt: now,
        updatedAt: now,
    };
};
