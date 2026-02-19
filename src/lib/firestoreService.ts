import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import type { WorkoutSession, Challenge, Meal } from './types';

// ─── Workouts ───
export const saveWorkout = async (workout: WorkoutSession): Promise<void> => {
    await setDoc(doc(db, 'workouts', workout.id), workout);
};

export const getUserWorkouts = async (
    userId: string,
    maxResults = 50
): Promise<WorkoutSession[]> => {
    // Simple query — no composite index needed
    const q = query(
        collection(db, 'workouts'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => d.data() as WorkoutSession);
    // Sort client-side to avoid needing a Firestore composite index
    return results.sort((a, b) => b.startedAt - a.startedAt);
};

export const getRecentWorkouts = async (
    userId: string,
    days = 30
): Promise<WorkoutSession[]> => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    // Query only by userId + status — sort client-side
    const q = query(
        collection(db, 'workouts'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        limit(200)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as WorkoutSession)
        .filter((w) => w.startedAt >= since)
        .sort((a, b) => b.startedAt - a.startedAt);
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
