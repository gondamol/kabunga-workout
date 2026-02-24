import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    query, where, limit, getDocs, getDoc, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    Challenge,
    ExerciseHistory,
    FitnessDailyLog,
    Meal,
    OneRepMaxes,
    WorkoutSession,
} from './types';

const WORKOUT_CACHE_TTL_MS = 5 * 60 * 1000;
const WORKOUT_PERSISTED_CACHE_TTL_MS = 60 * 60 * 1000;
const WORKOUT_CACHE_KEY_PREFIX = 'kabunga:workouts:';
let hasWarnedAboutWorkoutIndex = false;

const workoutCache = new Map<string, {
    fetchedAt: number;
    maxResults: number;
    workouts: WorkoutSession[];
}>();

const getWorkoutCacheKey = (userId: string): string => `${WORKOUT_CACHE_KEY_PREFIX}${userId}`;

const isWorkoutSession = (value: unknown): value is WorkoutSession => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<WorkoutSession>;
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.userId === 'string' &&
        typeof candidate.startedAt === 'number' &&
        Array.isArray(candidate.exercises) &&
        candidate.status === 'completed'
    );
};

const readPersistedWorkoutCache = (userId: string): {
    fetchedAt: number;
    maxResults: number;
    workouts: WorkoutSession[];
} | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(getWorkoutCacheKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as {
            fetchedAt?: number;
            maxResults?: number;
            workouts?: unknown[];
        };
        if (
            typeof parsed.fetchedAt !== 'number' ||
            typeof parsed.maxResults !== 'number' ||
            !Array.isArray(parsed.workouts)
        ) {
            return null;
        }

        const workouts = parsed.workouts.filter(isWorkoutSession);
        if (Date.now() - parsed.fetchedAt > WORKOUT_PERSISTED_CACHE_TTL_MS) return null;

        return {
            fetchedAt: parsed.fetchedAt,
            maxResults: parsed.maxResults,
            workouts: workouts.sort((a, b) => b.startedAt - a.startedAt),
        };
    } catch {
        return null;
    }
};

const writePersistedWorkoutCache = (
    userId: string,
    entry: { fetchedAt: number; maxResults: number; workouts: WorkoutSession[] }
): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(getWorkoutCacheKey(userId), JSON.stringify(entry));
    } catch {
        // Ignore storage quota / serialization errors
    }
};

const clearPersistedWorkoutCache = (userId: string): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(getWorkoutCacheKey(userId));
    } catch {
        // Ignore storage errors
    }
};

const setWorkoutCache = (
    userId: string,
    entry: { fetchedAt: number; maxResults: number; workouts: WorkoutSession[] }
): void => {
    const normalized = {
        ...entry,
        workouts: [...entry.workouts].sort((a, b) => b.startedAt - a.startedAt),
    };
    workoutCache.set(userId, normalized);
    writePersistedWorkoutCache(userId, normalized);
};

const updateWorkoutCache = (
    userId: string,
    updater: (current: WorkoutSession[]) => WorkoutSession[]
): void => {
    const existing = workoutCache.get(userId) ?? readPersistedWorkoutCache(userId);
    if (!existing) return;
    const nextWorkouts = updater(existing.workouts)
        .filter((workout) => workout.status === 'completed')
        .sort((a, b) => b.startedAt - a.startedAt);
    setWorkoutCache(userId, {
        fetchedAt: Date.now(),
        maxResults: Math.max(existing.maxResults, nextWorkouts.length),
        workouts: nextWorkouts,
    });
};

const clearWorkoutCache = (userId: string): void => {
    workoutCache.delete(userId);
    clearPersistedWorkoutCache(userId);
};

const getCachedWorkouts = (userId: string, maxResults: number): WorkoutSession[] | null => {
    const cached = workoutCache.get(userId) ?? readPersistedWorkoutCache(userId);
    if (!cached) return null;
    workoutCache.set(userId, cached);
    if (Date.now() - cached.fetchedAt > WORKOUT_CACHE_TTL_MS) return null;
    if (cached.maxResults < maxResults) return null;
    return cached.workouts.slice(0, maxResults);
};

const shouldFallbackToUnindexedQuery = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string; message?: string };
    if (maybeError.code === 'failed-precondition') return true;
    return typeof maybeError.message === 'string' && maybeError.message.toLowerCase().includes('index');
};

const fetchCompletedWorkouts = async (
    userId: string,
    maxResults: number
): Promise<WorkoutSession[]> => {
    const fromCache = getCachedWorkouts(userId, maxResults);
    if (fromCache) return fromCache;

    let workouts: WorkoutSession[] = [];
    try {
        const indexedQuery = query(
            collection(db, 'workouts'),
            where('userId', '==', userId),
            where('status', '==', 'completed'),
            orderBy('startedAt', 'desc'),
            limit(maxResults)
        );
        const snap = await getDocs(indexedQuery);
        workouts = snap.docs.map((d) => d.data() as WorkoutSession);
    } catch (error) {
        if (!shouldFallbackToUnindexedQuery(error)) throw error;
        if (!hasWarnedAboutWorkoutIndex) {
            console.warn('Missing Firestore workouts index. Falling back to slower client-side sorting.');
            hasWarnedAboutWorkoutIndex = true;
        }
        const fallbackQuery = query(
            collection(db, 'workouts'),
            where('userId', '==', userId)
        );
        const snap = await getDocs(fallbackQuery);
        workouts = snap.docs
            .map((d) => d.data() as WorkoutSession)
            .filter((workout) => workout.status === 'completed')
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, maxResults);
    }

    setWorkoutCache(userId, {
        fetchedAt: Date.now(),
        maxResults,
        workouts,
    });
    return workouts;
};

// ─── Workouts ───
export const saveWorkout = async (workout: WorkoutSession): Promise<void> => {
    await setDoc(doc(db, 'workouts', workout.id), workout);
    updateWorkoutCache(workout.userId, (current) => {
        const withoutCurrent = current.filter((session) => session.id !== workout.id);
        return [workout, ...withoutCurrent];
    });
};

export const deleteWorkout = async (
    workoutId: string,
    userId: string
): Promise<void> => {
    await deleteDoc(doc(db, 'workouts', workoutId));
    updateWorkoutCache(userId, (current) => current.filter((session) => session.id !== workoutId));
    if (!workoutCache.get(userId)) {
        clearWorkoutCache(userId);
    }
};

export const getUserWorkouts = async (
    userId: string,
    maxResults = 50
): Promise<WorkoutSession[]> => {
    return fetchCompletedWorkouts(userId, maxResults);
};

export const getRecentWorkouts = async (
    userId: string,
    days = 30
): Promise<WorkoutSession[]> => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const maxResults = Math.max(80, Math.min(240, days * 8));
    const workouts = await fetchCompletedWorkouts(userId, maxResults);
    return workouts
        .filter((w) => w.startedAt >= since)
        .sort((a, b) => b.startedAt - a.startedAt);
};

// ─── One Rep Maxes ───
export const saveOneRepMaxes = async (
    uid: string,
    maxes: Partial<OneRepMaxes>
): Promise<void> => {
    const payload: Partial<OneRepMaxes> = {
        userId: uid,
        ...maxes,
        updatedAt: Date.now(),
    };
    await setDoc(doc(db, 'oneRepMaxes', uid), payload, { merge: true });
};

export const getOneRepMaxes = async (uid: string): Promise<OneRepMaxes | null> => {
    const snap = await getDoc(doc(db, 'oneRepMaxes', uid));
    if (!snap.exists()) return null;
    return snap.data() as OneRepMaxes;
};

// ─── Fitness Dailies ───
export const saveFitnessDailyLog = async (
    uid: string,
    date: string,
    log: Partial<FitnessDailyLog>
): Promise<void> => {
    const payload: Partial<FitnessDailyLog> = {
        userId: uid,
        date,
        ...log,
        completedAt: Date.now(),
    };
    await setDoc(doc(db, 'fitnessDailies', uid, 'logs', date), payload, { merge: true });
};

export const getFitnessDailyLogs = async (
    uid: string,
    days: number
): Promise<FitnessDailyLog[]> => {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const q = query(
        collection(db, 'fitnessDailies', uid, 'logs'),
        limit(Math.max(days + 14, 30))
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as FitnessDailyLog)
        .filter((log) => log.date >= sinceDate)
        .sort((a, b) => b.date.localeCompare(a.date));
};

// ─── Exercise History (Progressive Overload) ───
const normalizeExerciseName = (name: string): string =>
    name.trim().toLowerCase().replace(/\s+/g, ' ');

const toBestSet = (sets: Array<{ reps: number; weight: number; rpe?: number }>) => {
    return sets.reduce(
        (best, setItem) => {
            const bestScore = best.weight * best.reps;
            const currentScore = setItem.weight * setItem.reps;
            if (currentScore > bestScore) {
                return { reps: setItem.reps, weight: setItem.weight };
            }
            if (currentScore === bestScore && setItem.weight > best.weight) {
                return { reps: setItem.reps, weight: setItem.weight };
            }
            return best;
        },
        { reps: 0, weight: 0 }
    );
};

export const getExerciseHistory = async (
    uid: string,
    exerciseName: string,
    limitSessions = 8
): Promise<ExerciseHistory | null> => {
    const normalized = normalizeExerciseName(exerciseName);
    const workouts = await fetchCompletedWorkouts(uid, 180);

    const sessions: ExerciseHistory['sessions'] = [];

    for (const workout of workouts) {
        if (sessions.length >= limitSessions) break;
        const matchingExercises = workout.exercises.filter(
            (exercise) => normalizeExerciseName(exercise.name) === normalized
        );
        for (const exercise of matchingExercises) {
            if (sessions.length >= limitSessions) break;
            const sets = exercise.sets
                .filter((setItem) => setItem.reps > 0 || setItem.weight > 0)
                .map((setItem) => ({
                    reps: setItem.reps,
                    weight: setItem.weight,
                    rpe: setItem.rpe,
                }));
            if (sets.length === 0) continue;
            sessions.push({
                date: workout.startedAt,
                sets,
                bestSet: toBestSet(sets),
            });
        }
    }

    if (sessions.length === 0) return null;

    return {
        name: normalized,
        sessions,
    };
};

// ─── Challenges ───
export const saveChallenge = async (challenge: Challenge): Promise<void> => {
    await setDoc(doc(db, 'challenges', challenge.id), challenge);
};

export const updateChallenge = async (
    challengeId: string,
    data: Partial<Challenge>
): Promise<void> => {
    await updateDoc(doc(db, 'challenges', challengeId), data);
};

export const getUserChallenges = async (userId: string): Promise<Challenge[]> => {
    // Only filter by userId — no composite index needed
    const q = query(
        collection(db, 'challenges'),
        where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => d.data() as Challenge);
    // Sort client-side
    return results.sort((a, b) => b.createdAt - a.createdAt);
};

export const getActiveChallenges = async (userId: string): Promise<Challenge[]> => {
    const now = Date.now();
    const q = query(
        collection(db, 'challenges'),
        where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as Challenge)
        .filter((c) => c.endDate >= now)
        .sort((a, b) => a.endDate - b.endDate);
};

// ─── Meals ───
export const saveMeal = async (meal: Meal): Promise<void> => {
    await setDoc(doc(db, 'meals', meal.id), meal);
};

export const deleteMeal = async (mealId: string): Promise<void> => {
    await deleteDoc(doc(db, 'meals', mealId));
};

export const getMealsByDate = async (
    userId: string,
    date: string
): Promise<Meal[]> => {
    const q = query(
        collection(db, 'meals'),
        where('userId', '==', userId),
        where('date', '==', date)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => d.data() as Meal);
    return results.sort((a, b) => a.createdAt - b.createdAt);
};

export const getMealsInRange = async (
    userId: string,
    startDate: string,
    endDate: string
): Promise<Meal[]> => {
    const q = query(
        collection(db, 'meals'),
        where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as Meal)
        .filter((m) => m.date >= startDate && m.date <= endDate)
        .sort((a, b) => b.date.localeCompare(a.date));
};

// ─── Media Upload (via Supabase — see supabaseStorage.ts) ───
export const uploadMedia = async (
    userId: string,
    file: Blob,
    filename: string
): Promise<string> => {
    // Dynamically import to avoid loading Supabase if not configured
    const { uploadToSupabase } = await import('./supabaseStorage');
    return uploadToSupabase(userId, file, filename);
};
