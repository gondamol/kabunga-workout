import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Exercise, ExerciseSet, WorkoutSession, WorkoutTemplate, WorkoutPhase } from '../lib/types';
import { CALORIES_PER_MINUTE } from '../lib/constants';
import { playAlarm, playCountdownBeep, vibrateRestComplete, vibrateSetComplete, playCompletionChime } from '../lib/timerService';

interface WorkoutState {
    activeSession: WorkoutSession | null;
    timerSeconds: number;
    isTimerRunning: boolean;

    // Rest timer
    restSeconds: number;
    restTarget: number; // how long they want to rest
    isResting: boolean;
    defaultRestSeconds: number;

    // Guided mode
    activeTemplate: WorkoutTemplate | null;
    currentPhaseIndex: number;
    currentExerciseIndex: number;
    isGuidedMode: boolean;

    // Actions
    startWorkout: (userId: string) => void;
    startFromTemplate: (userId: string, template: WorkoutTemplate) => void;
    endWorkout: () => WorkoutSession | null;
    cancelWorkout: () => void;

    addExercise: (name: string, planned?: { sets?: number; reps?: number; weight?: number; restSeconds?: number; cue?: string; isWarmup?: boolean }) => void;
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

    // Rest timer
    startRest: (seconds?: number) => void;
    stopRest: () => void;
    setDefaultRest: (seconds: number) => void;

    // Guided mode navigation
    nextExercise: () => void;
    prevExercise: () => void;
    getCurrentPhase: () => WorkoutPhase | null;
    getCurrentTemplateExercise: () => { name: string; cue: string } | null;
}

const generateId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useWorkoutStore = create<WorkoutState>()(
    persist(
        (set, get) => ({
            activeSession: null,
            timerSeconds: 0,
            isTimerRunning: false,

            // Rest timer state
            restSeconds: 0,
            restTarget: 90,
            isResting: false,
            defaultRestSeconds: 90,

            // Guided mode state
            activeTemplate: null,
            currentPhaseIndex: 0,
            currentExerciseIndex: 0,
            isGuidedMode: false,

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
                set({
                    activeSession: session,
                    timerSeconds: 0,
                    isTimerRunning: true,
                    isGuidedMode: false,
                    activeTemplate: null,
                    restSeconds: 0,
                    isResting: false,
                });
            },

            startFromTemplate: (userId: string, template: WorkoutTemplate) => {
                // Build exercises from all template phases
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

                const session: WorkoutSession = {
                    id: generateId(),
                    userId,
                    templateId: template.id,
                    startedAt: Date.now(),
                    endedAt: null,
                    duration: 0,
                    exercises,
                    mediaUrls: [],
                    caloriesEstimate: 0,
                    notes: '',
                    status: 'active',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };

                set({
                    activeSession: session,
                    timerSeconds: 0,
                    isTimerRunning: true,
                    isGuidedMode: true,
                    activeTemplate: template,
                    currentPhaseIndex: 0,
                    currentExerciseIndex: 0,
                    restSeconds: 0,
                    isResting: false,
                });
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
                set({
                    activeSession: null,
                    timerSeconds: 0,
                    isTimerRunning: false,
                    isResting: false,
                    restSeconds: 0,
                    isGuidedMode: false,
                    activeTemplate: null,
                });
                playCompletionChime();
                return completed;
            },

            cancelWorkout: () => {
                set({
                    activeSession: null,
                    timerSeconds: 0,
                    isTimerRunning: false,
                    isResting: false,
                    restSeconds: 0,
                    isGuidedMode: false,
                    activeTemplate: null,
                });
            },

            addExercise: (name: string, planned) => {
                const { activeSession } = get();
                if (!activeSession) return;
                const numSets = planned?.sets || 1;
                const exercise: Exercise = {
                    id: generateId(),
                    name,
                    sets: Array.from({ length: numSets }, () => ({
                        id: generateId(),
                        reps: 0,
                        weight: planned?.weight || 0,
                        completed: false,
                        isWarmup: planned?.isWarmup,
                    })),
                    notes: '',
                    plannedSets: planned?.sets,
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
                                        {
                                            id: generateId(),
                                            reps: 0,
                                            weight: e.sets[e.sets.length - 1]?.weight || e.plannedWeight || 0,
                                            completed: false,
                                        },
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
                const exercise = activeSession.exercises.find(e => e.id === exerciseId);
                const setItem = exercise?.sets.find(s => s.id === setId);
                const newCompleted = !setItem?.completed;

                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map((e) =>
                            e.id === exerciseId
                                ? {
                                    ...e,
                                    sets: e.sets.map((s) =>
                                        s.id === setId ? {
                                            ...s,
                                            completed: newCompleted,
                                            completedAt: newCompleted ? Date.now() : undefined,
                                        } : s
                                    ),
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });

                if (newCompleted) {
                    vibrateSetComplete();
                }
            },

            completeSet: (exerciseId: string, setId: string) => {
                const { activeSession, defaultRestSeconds } = get();
                if (!activeSession) return;
                const exercise = activeSession.exercises.find(e => e.id === exerciseId);
                const restTime = exercise?.restSeconds || defaultRestSeconds;

                set({
                    activeSession: {
                        ...activeSession,
                        exercises: activeSession.exercises.map((e) =>
                            e.id === exerciseId
                                ? {
                                    ...e,
                                    sets: e.sets.map((s) =>
                                        s.id === setId ? {
                                            ...s,
                                            completed: true,
                                            completedAt: Date.now(),
                                        } : s
                                    ),
                                }
                                : e
                        ),
                        updatedAt: Date.now(),
                    },
                });

                vibrateSetComplete();
                // Auto-start rest timer
                get().startRest(restTime);
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
                const { isTimerRunning, isResting, restSeconds, restTarget } = get();
                if (isTimerRunning) {
                    set((state) => ({ timerSeconds: state.timerSeconds + 1 }));
                }
                if (isResting && restSeconds > 0) {
                    const newRest = restSeconds - 1;
                    set({ restSeconds: newRest });

                    // Countdown beeps in last 3 seconds
                    if (newRest <= 3 && newRest > 0) {
                        playCountdownBeep();
                    }
                    // Rest complete
                    if (newRest === 0) {
                        playAlarm();
                        vibrateRestComplete();
                        set({ isResting: false });
                    }
                }
            },

            setTimerRunning: (running: boolean) => set({ isTimerRunning: running }),

            // Rest timer
            startRest: (seconds?: number) => {
                const { defaultRestSeconds } = get();
                const target = seconds || defaultRestSeconds;
                set({ isResting: true, restSeconds: target, restTarget: target });
            },

            stopRest: () => {
                set({ isResting: false, restSeconds: 0 });
            },

            setDefaultRest: (seconds: number) => {
                set({ defaultRestSeconds: seconds });
            },

            // Guided mode navigation
            nextExercise: () => {
                const { activeTemplate, currentPhaseIndex, currentExerciseIndex } = get();
                if (!activeTemplate) return;

                const phase = activeTemplate.phases[currentPhaseIndex];
                if (!phase) return;

                if (currentExerciseIndex < phase.exercises.length - 1) {
                    set({ currentExerciseIndex: currentExerciseIndex + 1 });
                } else if (currentPhaseIndex < activeTemplate.phases.length - 1) {
                    set({ currentPhaseIndex: currentPhaseIndex + 1, currentExerciseIndex: 0 });
                }
            },

            prevExercise: () => {
                const { activeTemplate, currentPhaseIndex, currentExerciseIndex } = get();
                if (!activeTemplate) return;

                if (currentExerciseIndex > 0) {
                    set({ currentExerciseIndex: currentExerciseIndex - 1 });
                } else if (currentPhaseIndex > 0) {
                    const prevPhase = activeTemplate.phases[currentPhaseIndex - 1];
                    set({
                        currentPhaseIndex: currentPhaseIndex - 1,
                        currentExerciseIndex: prevPhase.exercises.length - 1,
                    });
                }
            },

            getCurrentPhase: () => {
                const { activeTemplate, currentPhaseIndex } = get();
                return activeTemplate?.phases[currentPhaseIndex] || null;
            },

            getCurrentTemplateExercise: () => {
                const { activeTemplate, currentPhaseIndex, currentExerciseIndex } = get();
                if (!activeTemplate) return null;
                const phase = activeTemplate.phases[currentPhaseIndex];
                if (!phase) return null;
                const ex = phase.exercises[currentExerciseIndex];
                return ex ? { name: ex.name, cue: ex.cue } : null;
            },
        }),
        {
            name: 'kabunga-workout-session',
            partialize: (state) => ({
                activeSession: state.activeSession,
                timerSeconds: state.timerSeconds,
                isTimerRunning: state.isTimerRunning,
                isGuidedMode: state.isGuidedMode,
                activeTemplate: state.activeTemplate,
                currentPhaseIndex: state.currentPhaseIndex,
                currentExerciseIndex: state.currentExerciseIndex,
                defaultRestSeconds: state.defaultRestSeconds,
            }),
        }
    )
);
