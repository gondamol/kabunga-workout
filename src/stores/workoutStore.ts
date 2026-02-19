import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Exercise, ExerciseSet, WorkoutSession, WorkoutTemplate, WorkoutPhase } from '../lib/types';
import { CALORIES_PER_MINUTE } from '../lib/constants';
import { playAlarm, playCountdownBeep, vibrateRestComplete, vibrateSetComplete, playCompletionChime } from '../lib/timerService';

interface WorkoutState {
    activeSession: WorkoutSession | null;
    timerSeconds: number;
    isTimerRunning: boolean;

    // Which exercise is currently "on screen" during a live session
    currentExerciseIndex: number;

    // Rest timer
    restSeconds: number;
    restTarget: number;
    isResting: boolean;
    defaultRestSeconds: number;

    // Template guided mode
    activeTemplate: WorkoutTemplate | null;
    isGuidedMode: boolean;

    // Actions
    initPlan: (userId: string) => void;          // Create session in planning state (no timer)
    startWorkout: (userId: string) => void;       // Start timer on existing or new session
    startFromTemplate: (userId: string, template: WorkoutTemplate) => void;
    endWorkout: () => WorkoutSession | null;
    cancelWorkout: () => void;

    addExercise: (name: string, planned?: {
        sets?: number; reps?: number; weight?: number;
        restSeconds?: number; cue?: string; isWarmup?: boolean;
    }) => void;
    removeExercise: (exerciseId: string) => void;
    updateExerciseNotes: (exerciseId: string, notes: string) => void;

    addSet: (exerciseId: string) => void;
    removeSet: (exerciseId: string, setId: string) => void;
    updateSet: (exerciseId: string, setId: string, data: Partial<ExerciseSet>) => void;
    toggleSetComplete: (exerciseId: string, setId: string) => void;
    completeSet: (exerciseId: string, setId: string) => void;

    addMediaUrl: (url: string) => void;

    tick: () => void;
    setTimerRunning: (running: boolean) => void;

    // Guided navigation (one exercise at a time)
    goToExercise: (index: number) => void;
    nextExercise: () => void;
    prevExercise: () => void;

    // Rest timer
    startRest: (seconds?: number) => void;
    stopRest: () => void;
    setDefaultRest: (seconds: number) => void;
}

const generateId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const blankSession = (userId: string): WorkoutSession => ({
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
});

export const useWorkoutStore = create<WorkoutState>()(
    persist(
        (set, get) => ({
            activeSession: null,
            timerSeconds: 0,
            isTimerRunning: false,
            currentExerciseIndex: 0,

            restSeconds: 0,
            restTarget: 90,
            isResting: false,
            defaultRestSeconds: 90,

            activeTemplate: null,
            isGuidedMode: false,

            // ─── initPlan ───
            // Creates a session in "planning" state — exercises can be added,
            // but the timer is NOT running yet.
            initPlan: (userId: string) => {
                const existing = get().activeSession;
                if (existing) return; // already have one
                set({
                    activeSession: { ...blankSession(userId), status: 'active' },
                    timerSeconds: 0,
                    isTimerRunning: false,
                    currentExerciseIndex: 0,
                    isResting: false,
                    restSeconds: 0,
                });
            },

            // ─── startWorkout ───
            // Boots the timer on whatever session exists (or creates one).
            startWorkout: (userId: string) => {
                const existing = get().activeSession;
                if (existing) {
                    // Reuse the existing plan — just start the timer
                    set({
                        isTimerRunning: true,
                        currentExerciseIndex: 0,
                        activeSession: { ...existing, startedAt: Date.now() },
                    });
                } else {
                    set({
                        activeSession: blankSession(userId),
                        timerSeconds: 0,
                        isTimerRunning: true,
                        currentExerciseIndex: 0,
                        isResting: false,
                        restSeconds: 0,
                        isGuidedMode: false,
                        activeTemplate: null,
                    });
                }
            },

            // ─── startFromTemplate ───
            startFromTemplate: (userId: string, template: WorkoutTemplate) => {
                const exercises: Exercise[] = [];
                for (const phase of template.phases) {
                    for (const ex of phase.exercises) {
                        const sets: ExerciseSet[] = Array.from({ length: ex.sets }, () => ({
                            id: generateId(),
                            reps: 0,
                            weight: ex.weight,
                            completed: false,
                            isWarmup: ex.isWarmup,
                        }));
                        exercises.push({
                            id: generateId(),
                            name: ex.name,
                            sets,
                            notes: '',
                            plannedSets: ex.sets,
                            plannedReps: ex.reps,
                            plannedWeight: ex.weight,
                            restSeconds: ex.restSeconds,
                            cue: ex.cue,
                            isWarmup: ex.isWarmup,
                        });
                    }
                }

                set({
                    activeSession: { ...blankSession(userId), templateId: template.id, exercises },
                    timerSeconds: 0,
                    isTimerRunning: true,
                    isGuidedMode: true,
                    activeTemplate: template,
                    currentExerciseIndex: 0,
                    restSeconds: 0,
                    isResting: false,
                });
            },

            // ─── endWorkout ───
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
                set({
                    activeSession: null,
                    timerSeconds: 0,
                    isTimerRunning: false,
                    isResting: false,
                    restSeconds: 0,
                    isGuidedMode: false,
                    activeTemplate: null,
                    currentExerciseIndex: 0,
                });
                playCompletionChime();
                return completed;
            },

            // ─── cancelWorkout ───
            cancelWorkout: () => {
                set({
                    activeSession: null,
                    timerSeconds: 0,
                    isTimerRunning: false,
                    isResting: false,
                    restSeconds: 0,
                    isGuidedMode: false,
                    activeTemplate: null,
                    currentExerciseIndex: 0,
                });
            },

            // ─── Exercise management ───
            addExercise: (name, planned) => {
                const { activeSession } = get();
                if (!activeSession) return;
                const numSets = planned?.sets || 3;
                const exercise: Exercise = {
                    id: generateId(),
                    name,
                    sets: Array.from({ length: numSets }, () => ({
                        id: generateId(),
                        reps: planned?.reps || 0,
                        weight: planned?.weight || 0,
                        completed: false,
                        isWarmup: planned?.isWarmup,
                    })),
                    notes: '',
                    plannedSets: planned?.sets || 3,
                    plannedReps: planned?.reps,
                    plannedWeight: planned?.weight,
                    restSeconds: planned?.restSeconds,
                    cue: planned?.cue,
                    isWarmup: planned?.isWarmup,
                };
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: [...activeSession.exercises, exercise],
                        updatedAt: Date.now(),
                    },
                });
            },

            removeExercise: (exerciseId) => {
                const { activeSession, currentExerciseIndex } = get();
                if (!activeSession) return;
                const newExercises = activeSession.exercises.filter(e => e.id !== exerciseId);
                set({
                    activeSession: { ...activeSession, exercises: newExercises, updatedAt: Date.now() },
                    // Clamp index if we removed an exercise before current
                    currentExerciseIndex: Math.min(currentExerciseIndex, Math.max(0, newExercises.length - 1)),
                });
            },

            updateExerciseNotes: (exerciseId, notes) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map(e =>
                            e.id === exerciseId ? { ...e, notes } : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            addSet: (exerciseId) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map(e =>
                            e.id === exerciseId
                                ? {
                                    ...e,
                                    sets: [...e.sets, {
                                        id: generateId(),
                                        reps: e.sets[e.sets.length - 1]?.reps || 0,
                                        weight: e.sets[e.sets.length - 1]?.weight || e.plannedWeight || 0,
                                        completed: false,
                                    }],
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            removeSet: (exerciseId, setId) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map(e =>
                            e.id === exerciseId
                                ? { ...e, sets: e.sets.filter(s => s.id !== setId) }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            updateSet: (exerciseId, setId, data) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map(e =>
                            e.id === exerciseId
                                ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...data } : s) }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });
            },

            toggleSetComplete: (exerciseId, setId) => {
                const { activeSession } = get();
                if (!activeSession) return;
                const exercise = activeSession.exercises.find(e => e.id === exerciseId);
                const setItem = exercise?.sets.find(s => s.id === setId);
                const newCompleted = !setItem?.completed;

                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map(e =>
                            e.id === exerciseId
                                ? {
                                    ...e, sets: e.sets.map(s =>
                                        s.id === setId ? { ...s, completed: newCompleted, completedAt: newCompleted ? Date.now() : undefined } : s
                                    ),
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });

                if (newCompleted) vibrateSetComplete();
            },

            completeSet: (exerciseId, setId) => {
                const { activeSession, defaultRestSeconds } = get();
                if (!activeSession) return;
                const exercise = activeSession.exercises.find(e => e.id === exerciseId);
                const restTime = exercise?.restSeconds || defaultRestSeconds;

                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map(e =>
                            e.id === exerciseId
                                ? {
                                    ...e, sets: e.sets.map(s =>
                                        s.id === setId ? { ...s, completed: true, completedAt: Date.now() } : s
                                    ),
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });

                vibrateSetComplete();
                get().startRest(restTime);
            },

            addMediaUrl: (url) => {
                const { activeSession } = get();
                if (!activeSession) return;
                set({ activeSession: { ...activeSession, mediaUrls: [...activeSession.mediaUrls, url], updatedAt: Date.now() } });
            },

            // ─── Timer ───
            tick: () => {
                const { isTimerRunning, isResting, restSeconds } = get();
                if (isTimerRunning) {
                    set(state => ({ timerSeconds: state.timerSeconds + 1 }));
                }
                if (isResting && restSeconds > 0) {
                    const newRest = restSeconds - 1;
                    set({ restSeconds: newRest });
                    if (newRest <= 3 && newRest > 0) playCountdownBeep();
                    if (newRest === 0) {
                        playAlarm();
                        vibrateRestComplete();
                        set({ isResting: false });
                    }
                }
            },

            setTimerRunning: (running) => set({ isTimerRunning: running }),

            // ─── Guided navigation ───
            goToExercise: (index) => {
                const exercises = get().activeSession?.exercises ?? [];
                if (index >= 0 && index < exercises.length) {
                    set({ currentExerciseIndex: index });
                }
            },

            nextExercise: () => {
                const exercises = get().activeSession?.exercises ?? [];
                const { currentExerciseIndex } = get();
                if (currentExerciseIndex < exercises.length - 1) {
                    set({ currentExerciseIndex: currentExerciseIndex + 1 });
                }
            },

            prevExercise: () => {
                const { currentExerciseIndex } = get();
                if (currentExerciseIndex > 0) {
                    set({ currentExerciseIndex: currentExerciseIndex - 1 });
                }
            },

            // ─── Rest timer ───
            startRest: (seconds) => {
                const target = seconds || get().defaultRestSeconds;
                set({ isResting: true, restSeconds: target, restTarget: target });
            },

            stopRest: () => set({ isResting: false, restSeconds: 0 }),

            setDefaultRest: (seconds) => set({ defaultRestSeconds: seconds }),
        }),
        {
            name: 'kabunga-workout-session',
            partialize: (state) => ({
                activeSession: state.activeSession,
                timerSeconds: state.timerSeconds,
                isTimerRunning: state.isTimerRunning,
                currentExerciseIndex: state.currentExerciseIndex,
                isGuidedMode: state.isGuidedMode,
                activeTemplate: state.activeTemplate,
                defaultRestSeconds: state.defaultRestSeconds,
            }),
        }
    )
);
