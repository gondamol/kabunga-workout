import dayjs from 'dayjs';
import {
    buildCommunityGroupChallenge,
    buildCommunityGroupChallengeEntry,
    getCommunityChallengeWindow,
    getCommunityGroupChallengeStatus,
    sortCommunityGroupChallengeEntries,
} from '../src/lib/communityChallenges.ts';
import type { CommunityGroupChallenge, WorkoutSession } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const buildWorkout = (startedAt: number, id = String(startedAt)): WorkoutSession => ({
    id,
    userId: 'athlete-1',
    startedAt,
    endedAt: startedAt + 1000,
    duration: 45 * 60,
    exercises: [],
    mediaUrls: [],
    caloriesEstimate: 300,
    notes: '',
    status: 'completed',
    createdAt: startedAt,
    updatedAt: startedAt,
});

export function validateCommunityChallenges(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const monthlyWindow = getCommunityChallengeWindow('monthly', dayjs('2026-04-05T12:00:00Z').valueOf());
    if (
        dayjs(monthlyWindow.startDate).format('YYYY-MM-DD') === '2026-04-01'
        && dayjs(monthlyWindow.endDate).format('YYYY-MM-DD') === '2026-04-30'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Monthly community challenge window did not cover the correct month');
    }

    const challenge = buildCommunityGroupChallenge({
        id: 'challenge-1',
        groupId: 'group-1',
        ownerId: 'owner-1',
        createdById: 'owner-1',
        createdByName: ' Coach One ',
        title: '  April Consistency  ',
        description: '  Hit 12 workouts this month  ',
        period: 'monthly',
        targetCount: 12,
        now: dayjs('2026-04-05T12:00:00Z').valueOf(),
    });
    if (
        challenge.title === 'April Consistency'
        && challenge.description === 'Hit 12 workouts this month'
        && challenge.createdByName === 'Coach One'
        && challenge.status === 'active'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Community group challenge builder did not normalize the challenge payload');
    }

    const entry = buildCommunityGroupChallengeEntry({
        challenge,
        userId: 'athlete-1',
        userName: ' Athlete One ',
        workouts: [
            buildWorkout(dayjs('2026-04-02T10:00:00Z').valueOf(), 'in-range-1'),
            buildWorkout(dayjs('2026-04-11T10:00:00Z').valueOf(), 'in-range-2'),
            buildWorkout(dayjs('2026-03-28T10:00:00Z').valueOf(), 'out-of-range'),
        ],
        now: dayjs('2026-04-12T12:00:00Z').valueOf(),
    });
    if (
        entry.id === 'challenge-1_athlete-1'
        && entry.userName === 'Athlete One'
        && entry.completedWorkouts === 2
        && dayjs(entry.lastWorkoutAt || 0).format('YYYY-MM-DD') === '2026-04-11'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Community group challenge entry builder did not count in-range workouts correctly');
    }

    const sorted = sortCommunityGroupChallengeEntries([
        { ...entry, id: 'tied-slower', userId: 'athlete-2', userName: 'Bravo', completedWorkouts: 2, lastWorkoutAt: dayjs('2026-04-10').valueOf() },
        { ...entry, id: 'leader', userId: 'athlete-3', userName: 'Alpha', completedWorkouts: 3, lastWorkoutAt: dayjs('2026-04-09').valueOf() },
        { ...entry, id: 'entry', userId: 'athlete-1', userName: 'Athlete One' },
    ]);
    if (
        sorted[0]?.id === 'leader'
        && sorted[1]?.id === 'entry'
        && sorted[2]?.id === 'tied-slower'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Community leaderboard entries did not sort by score and freshest workout');
    }

    const completedStatus = getCommunityGroupChallengeStatus({
        ...challenge,
        endDate: dayjs('2026-03-31T23:59:59Z').valueOf(),
    } as CommunityGroupChallenge, dayjs('2026-04-05T12:00:00Z').valueOf());
    if (completedStatus === 'completed') {
        passed++;
    } else {
        failed++;
        errors.push('✗ Community group challenge status did not flip to completed after the deadline');
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateCommunityChallenges();
    console.log(`Community Challenges Validation: ${result.passed} passed, ${result.failed} failed`);
    if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach((error) => console.error(error));
    } else {
        console.log('✓ All validations passed!');
    }
    return result;
};

if (typeof process !== 'undefined' && typeof window === 'undefined') {
    const result = reportValidationResult();
    if (result.failed > 0) process.exitCode = 1;
}
