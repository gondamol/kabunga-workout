import type { CardioActivityType, CardioSummary, WorkoutSession } from './types';

// Heart points loosely mirror Google Fit:
// 1 point per minute of moderate-intensity activity, 2 per minute of vigorous.
// Strength/calisthenics earns ~1 pt per minute when sets are being performed.

const VIGOROUS_ACTIVITIES: CardioActivityType[] = ['run', 'cycle', 'row'];

const MET_BY_ACTIVITY: Record<CardioActivityType, number> = {
    run: 9.8,
    cycle: 7.5,
    row: 7.0,
    hike: 6.0,
    walk: 3.8,
};

export function classifyCardioIntensity(
    activity: CardioActivityType,
    avgPaceMinPerKm: number | null | undefined,
): 'easy' | 'moderate' | 'vigorous' {
    if (VIGOROUS_ACTIVITIES.includes(activity) && avgPaceMinPerKm && avgPaceMinPerKm < 6) return 'vigorous';
    if (activity === 'run') return avgPaceMinPerKm && avgPaceMinPerKm < 8 ? 'vigorous' : 'moderate';
    if (activity === 'cycle') return 'vigorous';
    if (activity === 'walk') return 'moderate';
    return 'moderate';
}

export function computeHeartPointsForCardio(
    durationSeconds: number,
    intensity: 'easy' | 'moderate' | 'vigorous',
): number {
    const minutes = durationSeconds / 60;
    if (intensity === 'vigorous') return Math.round(minutes * 2);
    if (intensity === 'moderate') return Math.round(minutes);
    return Math.round(minutes * 0.5);
}

export function computeStrengthHeartPoints(workoutDurationSeconds: number, completedSets: number): number {
    // Strength counts as moderate when at least one set per ~3 minutes.
    const minutes = workoutDurationSeconds / 60;
    const density = completedSets / Math.max(minutes, 1);
    if (density > 0.5) return Math.round(minutes); // moderate intensity
    return Math.round(minutes * 0.5);
}

export function summarizeHeartPoints(session: WorkoutSession): number {
    if (session.heartPoints && session.heartPoints > 0) return session.heartPoints;
    if (session.cardio) {
        return computeHeartPointsForCardio(session.duration, session.cardio.intensity ?? 'moderate');
    }
    const completedSets = session.exercises.reduce(
        (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
        0,
    );
    return computeStrengthHeartPoints(session.duration, completedSets);
}

export function computeCardioSummary(
    activity: CardioActivityType,
    durationSeconds: number,
    distanceKm: number | undefined,
): CardioSummary {
    const minutes = durationSeconds / 60;
    const safeDistance = distanceKm && distanceKm > 0 ? distanceKm : undefined;
    const avgPaceMinPerKm = safeDistance ? minutes / safeDistance : undefined;
    const avgSpeedKmh = safeDistance ? safeDistance / (minutes / 60) : undefined;
    const intensity = classifyCardioIntensity(activity, avgPaceMinPerKm ?? null);
    return {
        activity,
        distanceKm: safeDistance,
        avgPaceMinPerKm,
        avgSpeedKmh,
        intensity,
    };
}

export function estimateCardioCalories(
    activity: CardioActivityType,
    durationSeconds: number,
    bodyWeightKg: number = 70,
): number {
    const met = MET_BY_ACTIVITY[activity] ?? 5;
    // Calories = MET × weight(kg) × hours
    return Math.round(met * bodyWeightKg * (durationSeconds / 3600));
}

export function formatPace(paceMinPerKm: number | undefined): string {
    if (!paceMinPerKm || !isFinite(paceMinPerKm) || paceMinPerKm <= 0) return '—';
    const wholeMin = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - wholeMin) * 60);
    return `${wholeMin}:${String(seconds).padStart(2, '0')}/km`;
}

export function aggregateWeeklyHeartPoints(sessions: WorkoutSession[], windowMs = 7 * 24 * 60 * 60 * 1000): number {
    const since = Date.now() - windowMs;
    return sessions
        .filter((s) => s.startedAt >= since)
        .reduce((sum, s) => sum + summarizeHeartPoints(s), 0);
}
