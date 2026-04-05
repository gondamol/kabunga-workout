import dayjs from 'dayjs';
import type {
    ChallengePeriod,
    CommunityGroupChallenge,
    CommunityGroupChallengeEntry,
    WorkoutSession,
} from './types';

const STATUS_WEIGHT = {
    active: 0,
    completed: 1,
} as const;

export const getCommunityChallengeWindow = (
    period: ChallengePeriod,
    now = Date.now()
): { startDate: number; endDate: number } => {
    const date = dayjs(now);
    if (period === 'weekly') {
        return {
            startDate: date.startOf('week').valueOf(),
            endDate: date.endOf('week').valueOf(),
        };
    }
    if (period === 'yearly') {
        return {
            startDate: date.startOf('year').valueOf(),
            endDate: date.endOf('year').valueOf(),
        };
    }
    return {
        startDate: date.startOf('month').valueOf(),
        endDate: date.endOf('month').valueOf(),
    };
};

export const getCommunityGroupChallengeStatus = (
    challenge: Pick<CommunityGroupChallenge, 'status' | 'endDate'>,
    now = Date.now()
): CommunityGroupChallenge['status'] => {
    if (challenge.status === 'completed') return 'completed';
    return challenge.endDate < now ? 'completed' : 'active';
};

export const buildCommunityGroupChallenge = (input: {
    id: string;
    groupId: string;
    ownerId: string;
    createdById: string;
    createdByName: string;
    title: string;
    description?: string;
    period: ChallengePeriod;
    targetCount: number;
    now?: number;
}): CommunityGroupChallenge => {
    const timestamp = input.now ?? Date.now();
    const { startDate, endDate } = getCommunityChallengeWindow(input.period, timestamp);

    return {
        id: input.id,
        groupId: input.groupId,
        ownerId: input.ownerId,
        createdById: input.createdById,
        createdByName: input.createdByName.trim() || 'Coach',
        title: input.title.trim(),
        description: (input.description || '').trim(),
        period: input.period,
        targetCount: Math.max(1, Math.round(input.targetCount)),
        startDate,
        endDate,
        status: endDate < timestamp ? 'completed' : 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
    };
};

export const buildCommunityGroupChallengeEntry = (input: {
    challenge: CommunityGroupChallenge;
    userId: string;
    userName: string;
    workouts: WorkoutSession[];
    existingJoinedAt?: number;
    now?: number;
}): CommunityGroupChallengeEntry => {
    const timestamp = input.now ?? Date.now();
    const inRange = input.workouts.filter((workout) => (
        workout.status === 'completed'
        && workout.startedAt >= input.challenge.startDate
        && workout.startedAt <= input.challenge.endDate
    ));
    const lastWorkoutAt = inRange.length > 0
        ? Math.max(...inRange.map((workout) => workout.startedAt))
        : null;

    return {
        id: `${input.challenge.id}_${input.userId}`,
        challengeId: input.challenge.id,
        groupId: input.challenge.groupId,
        userId: input.userId,
        userName: input.userName.trim() || 'Member',
        completedWorkouts: inRange.length,
        targetCount: input.challenge.targetCount,
        lastWorkoutAt,
        joinedAt: input.existingJoinedAt ?? timestamp,
        updatedAt: timestamp,
    };
};

export const sortCommunityGroupChallenges = (
    challenges: CommunityGroupChallenge[],
    now = Date.now()
): CommunityGroupChallenge[] => {
    return [...challenges].sort((left, right) => {
        const statusDelta = STATUS_WEIGHT[getCommunityGroupChallengeStatus(left, now)] - STATUS_WEIGHT[getCommunityGroupChallengeStatus(right, now)];
        if (statusDelta !== 0) return statusDelta;
        if (left.endDate !== right.endDate) return left.endDate - right.endDate;
        return right.createdAt - left.createdAt;
    });
};

export const sortCommunityGroupChallengeEntries = (
    entries: CommunityGroupChallengeEntry[]
): CommunityGroupChallengeEntry[] => {
    return [...entries].sort((left, right) => {
        if (left.completedWorkouts !== right.completedWorkouts) {
            return right.completedWorkouts - left.completedWorkouts;
        }
        const leftLastWorkout = left.lastWorkoutAt ?? 0;
        const rightLastWorkout = right.lastWorkoutAt ?? 0;
        if (leftLastWorkout !== rightLastWorkout) {
            return rightLastWorkout - leftLastWorkout;
        }
        return left.userName.localeCompare(right.userName);
    });
};
