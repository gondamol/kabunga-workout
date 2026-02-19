import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Exercise, ExerciseSet, WorkoutSession } from '../lib/types';
import { CALORIES_PER_MINUTE } from '../lib/constants';

interface WorkoutState {
    activeSession: WorkoutSession | null;
    timerSeconds: number;
    isTimerRunning: boolean;

    startWorkout: (userId: string) => void;
    endWorkout: () => WorkoutSession | null;
    cancelWorkout: () => void;

    addExercise: (name: string) => void;
    removeExercise: (exerciseId: string) => void;
    updateExerciseNotes: (exerciseId: string, notes: string) => void;

    addSet: (exerciseId: string) => void;
    removeSet: (exerciseId: string, setId: string) => void;
    updateSet: (exerciseId: string, setId: string, data: Partial<ExerciseSet>) => void;
    toggleSetComplete: (exerciseId: string, setId: string) => void;

    addMediaUrl: (url: string) => void;

    tick: () => void;
    setTimerRunning: (running: boolean) => void;
}

const generateId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useWorkoutStore = create<WorkoutState>()(
    persist(
        (set, get) => ({
            activeSession: null,
            timerSeconds: 0,
            isTimerRunning: false,

            startWorkout: (userId: string) => {
                const session: WorkoutSession = {
                    id: generateId(),
                    userId,
                    startedAt: Date.now(),
                    endedAt: null,
                    duration: 0,
                    exercises: [],
                    mediaUrls: [],
                    caloriesEstimate: 0,
                    notes: '',
                    status: 'active',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                set({ activeSession: session, timerSeconds: 0, isTimerRunning: true });
            },

            endWorkout: () => {
                const { activeSession, timerSeconds } = get();
                if (!activeSession) return null;

                const completed: WorkoutSession = {
                    ...activeSession,
                    endedAt: Date.now(),
                    duration: timerSeconds,
                    caloriesEstimate: Math.round(timerSeconds / 60 * CALORIES_PER_MINUTE.moderate),
                    status: 'completed',
                    updatedAt: Date.now(),
                };
                set({ activeSession: null, timerSeconds: 0, isTimerRunning: false });
                return completed;
            },

            cancelWorkout: () => {
                set({ activeSession: null, timerSeconds: 0, isTimerRunning: false });
            },

            addExercise: (name: string) => {
                const { activeSession } = get();
                if (!activeSession) return;
                const exercise: Exercise = {
                    id: generateId(),
                    name,
                    sets: [{ id: generateId(), reps: 0, weight: 0, completed: false }],
                    notes: '',
                };
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: [...activeSession.exercises, exercise],
                        updatedAt: Date.now(),
                    },
                });
            },

            removeExercise: (exerciseId: string) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.filter((e) => e.id !== exerciseId),
                        updatedAt: Date.now(),
                    },
                });
            },

            updateExerciseNotes: (exerciseId: string, notes: string) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map((e) =>
                            e.id === exerciseId ? { ...e, notes } : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            addSet: (exerciseId: string) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map((e) =>
                            e.id === exerciseId
                                ? {
                                    ...e,
                                    sets: [
                                        ...e.sets,
                                        { id: generateId(), reps: 0, weight: 0, completed: false },
                                    ],
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            removeSet: (exerciseId: string, setId: string) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map((e) =>
                            e.id === exerciseId
                                ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            updateSet: (exerciseId: string, setId: string, data: Partial<ExerciseSet>) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map((e) =>
                            e.id === exerciseId
                                ? {
                                    ...e,
                                    sets: e.sets.map((s) =>
                                        s.id === setId ? { ...s, ...data } : s
                                    ),
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            toggleSetComplete: (exerciseId: string, setId: string) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map((e) =>
                            e.id === exerciseId
                                ? {
                                    ...e,
                                    sets: e.sets.map((s) =>
                                        s.id === setId ? { ...s, completed: !s.completed } : s
                                    ),
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            addMediaUrl: (url: string) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        mediaUrls: [...activeSession.mediaUrls, url],
                        updatedAt: Date.now(),
                    },
                });
            },

            tick: () => {
                const { isTimerRunning } = get();
                if (isTimerRunning) {
                    set((state) => ({ timerSeconds: state.timerSeconds + 1 }));
                }
            },

            setTimerRunning: (running: boolean) => set({ isTimerRunning: running }),
        }),
        {
            name: 'kabunga-workout-session',
            partialize: (state) => ({
                activeSession: state.activeSession,
                timerSeconds: state.timerSeconds,
                isTimerRunning: state.isTimerRunning,
            }),
        }
    )
);
