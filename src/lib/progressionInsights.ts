import type { ExerciseHistory, WorkoutSession, WorkoutTemplate } from './types';
import { getOverloadSuggestion, type OverloadSuggestion } from './timerService';

interface SessionLike {
    sets: Array<{ reps: number; weight: number; rpe?: number }>;
}

export interface ProgressionInsight extends OverloadSuggestion {
    exerciseName: string;
    sourceSessions: number;
}

const normalizeExerciseName = (name: string): string =>
    name.trim().toLowerCase().replace(/\s+/g, ' ');

const toSessionSets = (session: WorkoutSession, exerciseName: string): SessionLike[] => {
    const normalized = normalizeExerciseName(exerciseName);
    return session.exercises
        .filter((exercise) => normalizeExerciseName(exercise.name) === normalized)
        .map((exercise) => ({
            sets: exercise.sets
                .filter((setItem) => setItem.reps > 0 || setItem.weight > 0)
                .map((setItem) => ({
                    reps: setItem.reps,
                    weight: setItem.weight,
                    rpe: setItem.rpe,
                })),
        }))
        .filter((entry) => entry.sets.length > 0);
};

const inferPlannedRepsFromSession = (session: WorkoutSession, exerciseName: string): number => {
    const normalized = normalizeExerciseName(exerciseName);
    const exercise = session.exercises.find((item) => normalizeExerciseName(item.name) === normalized);
    if (!exercise) return 8;
    if (exercise.plannedReps && exercise.plannedReps > 0) return exercise.plannedReps;
    const completedSet = exercise.sets.find((setItem) => setItem.reps > 0);
    return completedSet?.reps || 8;
};

export const getProgressionSuggestionFromHistory = (
    history: ExerciseHistory | null,
    exerciseName: string,
    plannedReps: number | null | undefined,
    progressionStyle: WorkoutTemplate['progressionRule'] = 'linear'
): ProgressionInsight | null => {
    if (!history || !plannedReps || plannedReps <= 0) return null;

    const sessions = history.sessions.map((session) => ({
        sets: session.sets,
    }));
    const suggestion = getOverloadSuggestion(exerciseName, sessions, plannedReps, progressionStyle);
    if (!suggestion) return null;

    return {
        ...suggestion,
        exerciseName,
        sourceSessions: sessions.length,
    };
};

export const getProgressionSuggestionFromWorkouts = (
    workouts: WorkoutSession[],
    exerciseName: string,
    plannedReps: number | null | undefined,
    progressionStyle: WorkoutTemplate['progressionRule'] = 'linear'
): ProgressionInsight | null => {
    if (!plannedReps || plannedReps <= 0) return null;

    const sessions = workouts
        .flatMap((session) => toSessionSets(session, exerciseName))
        .slice(0, 5);
    if (sessions.length === 0) return null;

    const suggestion = getOverloadSuggestion(exerciseName, sessions, plannedReps, progressionStyle);
    if (!suggestion) return null;

    return {
        ...suggestion,
        exerciseName,
        sourceSessions: sessions.length,
    };
};

export const getDashboardProgressionInsight = (
    workouts: WorkoutSession[],
    progressionStyle: WorkoutTemplate['progressionRule'] = 'linear'
): ProgressionInsight | null => {
    if (workouts.length === 0) return null;

    const latestWorkout = workouts[0];
    const seen = new Set<string>();

    for (const exercise of latestWorkout.exercises) {
        const normalized = normalizeExerciseName(exercise.name);
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const plannedReps = inferPlannedRepsFromSession(latestWorkout, exercise.name);
        const suggestion = getProgressionSuggestionFromWorkouts(
            workouts,
            exercise.name,
            plannedReps,
            progressionStyle
        );
        if (suggestion) return suggestion;
    }

    return null;
};
