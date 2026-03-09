import type { OneRepMaxes, UserProfile, WorkoutSession } from './types';

export const ONE_REP_MAX_RETEST_DAYS = 28;
export const ONE_REP_MAX_RETEST_WORKOUTS = 12;
export const ONE_REP_MAX_SNOOZE_DAYS = 7;

export interface OneRepMaxPromptStatus {
    due: boolean;
    shouldPrompt: boolean;
    isMissing: boolean;
    daysSinceUpdate: number | null;
    workoutsSinceUpdate: number;
    lastUpdatedAt: number | null;
    reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const countCompletedWorkoutsSince = (
    workouts: WorkoutSession[],
    updatedAt: number | null
): number => {
    if (!updatedAt) return workouts.length;
    return workouts.filter((workout) => workout.status === 'completed' && workout.startedAt >= updatedAt).length;
};

export const getOneRepMaxPromptStatus = (
    maxes: OneRepMaxes | null,
    workouts: WorkoutSession[],
    profile?: UserProfile | null,
    now = Date.now()
): OneRepMaxPromptStatus => {
    if (!maxes) {
        const snoozed = (profile?.oneRepMaxPromptSnoozeUntil || 0) > now;
        return {
            due: true,
            shouldPrompt: !snoozed,
            isMissing: true,
            daysSinceUpdate: null,
            workoutsSinceUpdate: workouts.filter((workout) => workout.status === 'completed').length,
            lastUpdatedAt: null,
            reason: 'Add your 1RM values so Iron workouts can scale to your actual strength.',
        };
    }

    const lastUpdatedAt = maxes.updatedAt || null;
    const daysSinceUpdate = lastUpdatedAt ? Math.floor((now - lastUpdatedAt) / MS_PER_DAY) : null;
    const workoutsSinceUpdate = countCompletedWorkoutsSince(workouts, lastUpdatedAt);
    const dueByDays = daysSinceUpdate !== null && daysSinceUpdate >= ONE_REP_MAX_RETEST_DAYS;
    const dueByWorkouts = workoutsSinceUpdate >= ONE_REP_MAX_RETEST_WORKOUTS;
    const due = dueByDays || dueByWorkouts;
    const snoozed = due && (profile?.oneRepMaxPromptSnoozeUntil || 0) > now;

    let reason = '1RM values are current.';
    if (dueByDays && dueByWorkouts) {
        reason = `${daysSinceUpdate} days and ${workoutsSinceUpdate} completed workouts since your last 1RM update.`;
    } else if (dueByDays && daysSinceUpdate !== null) {
        reason = `${daysSinceUpdate} days since your last 1RM update.`;
    } else if (dueByWorkouts) {
        reason = `${workoutsSinceUpdate} completed workouts since your last 1RM update.`;
    } else if (daysSinceUpdate !== null) {
        reason = `Last updated ${daysSinceUpdate} day${daysSinceUpdate === 1 ? '' : 's'} ago.`;
    }

    return {
        due,
        shouldPrompt: due && !snoozed,
        isMissing: false,
        daysSinceUpdate,
        workoutsSinceUpdate,
        lastUpdatedAt,
        reason,
    };
};

export const getOneRepMaxSnoozeUntil = (now = Date.now()): number => {
    return now + ONE_REP_MAX_SNOOZE_DAYS * MS_PER_DAY;
};
