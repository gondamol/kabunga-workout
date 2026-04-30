import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    query, where, limit, getDocs, getDoc, orderBy, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    Challenge,
    CoachAthleteLink,
    CoachCode,
    CoachWorkoutPlan,
    CommunityGroup,
    CommunityGroupChallenge,
    CommunityGroupChallengeEntry,
    CommunityGroupKind,
    CommunityInvite,
    CommunityMessage,
    CommunityReport,
    CommunityReportStatus,
    ExerciseHistory,
    FitnessDailyConfig,
    FitnessDailyLog,
    Meal,
    OneRepMaxes,
    UserProfile,
    UserRole,
    WorkoutSession,
} from './types';
import {
    buildCommunityGroupChallengeEntry,
    getCommunityGroupChallengeStatus,
    sortCommunityGroupChallengeEntries,
    sortCommunityGroupChallenges,
} from './communityChallenges';
import { buildCommunityChallengeEntriesScope } from './communityChallengeQueries';

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

const normalizeCoachCode = (code: string): string =>
    code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const buildCoachCode = (coachId: string, coachName: string): string => {
    const alpha = coachName
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3)
        .padEnd(3, 'X');
    const suffix = coachId.slice(-5).toUpperCase();
    return `${alpha}${suffix}`;
};

const normalizeCommunityInviteCode = (code: string): string =>
    code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

const buildCommunityInviteCode = async (): Promise<string> => {
    for (let attempt = 0; attempt < 6; attempt++) {
        const randomPart = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 8);
        const candidate = `KBG${randomPart}`;
        const snap = await getDoc(doc(db, 'communityInvites', candidate));
        if (!snap.exists()) return candidate;
    }
    return `KBG${Date.now().toString(36).toUpperCase()}`.slice(0, 16);
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

    if (workout.scheduledWorkoutId) {
        try {
            await updateDoc(doc(db, 'coachPlans', workout.scheduledWorkoutId), {
                status: 'completed',
                completedWorkoutId: workout.id,
                completedAt: workout.endedAt ?? Date.now(),
                athleteInSession: false,
                progressCurrentExercise: null,
                updatedAt: Date.now(),
            });
        } catch (error) {
            console.warn('Could not update coach plan completion status:', error);
        }
    }
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

export const getWorkoutById = async (
    userId: string,
    workoutId: string
): Promise<WorkoutSession | null> => {
    try {
        const snap = await getDoc(doc(db, 'workouts', workoutId));
        if (!snap.exists()) return null;
        const workout = snap.data() as WorkoutSession;
        // Verify ownership
        if (workout.userId !== userId) return null;
        return workout;
    } catch (error) {
        console.error('Failed to fetch workout:', error);
        return null;
    }
};

// ─── Coach / Athlete Collaboration ───
export const setUserRole = async (
    uid: string,
    role: UserRole,
    profile: { displayName: string; email: string; existingCoachCode?: string | null }
): Promise<{ role: UserRole; coachCode: string | null }> => {
    const now = Date.now();
    let coachCode = profile.existingCoachCode ? normalizeCoachCode(profile.existingCoachCode) : null;

    if (role === 'coach') {
        if (!coachCode) coachCode = buildCoachCode(uid, profile.displayName || 'COACH');

        const coachCodeDoc: CoachCode = {
            code: coachCode,
            coachId: uid,
            coachName: profile.displayName || 'Coach',
            coachEmail: profile.email,
            createdAt: now,
            updatedAt: now,
        };

        const existing = await getDoc(doc(db, 'coachCodes', coachCode));
        if (existing.exists()) {
            const existingData = existing.data() as CoachCode;
            coachCodeDoc.createdAt = existingData.createdAt || now;
        }
        await setDoc(doc(db, 'coachCodes', coachCode), coachCodeDoc, { merge: true });
    }

    await setDoc(
        doc(db, 'users', uid),
        {
            role,
            coachCode,
            updatedAt: now,
        },
        { merge: true }
    );

    return { role, coachCode };
};

export const updateUserProfile = async (
    uid: string,
    patch: Partial<UserProfile>
): Promise<void> => {
    await setDoc(
        doc(db, 'users', uid),
        {
            ...patch,
            updatedAt: Date.now(),
        },
        { merge: true }
    );
};

export const getCoachCodeInfo = async (coachCode: string): Promise<CoachCode | null> => {
    const normalized = normalizeCoachCode(coachCode);
    if (!normalized) return null;
    const snap = await getDoc(doc(db, 'coachCodes', normalized));
    if (!snap.exists()) return null;
    return snap.data() as CoachCode;
};

export const linkAthleteToCoach = async (input: {
    athleteId: string;
    athleteName: string;
    athleteEmail: string;
    coachCode: string;
}): Promise<CoachAthleteLink> => {
    const coach = await getCoachCodeInfo(input.coachCode);
    if (!coach) throw new Error('Coach code not found');
    if (coach.coachId === input.athleteId) throw new Error('You cannot connect to your own coach code');

    const now = Date.now();
    const linkRef = doc(db, 'coachAthletes', input.athleteId);
    const existing = await getDoc(linkRef);

    const link: CoachAthleteLink = {
        athleteId: input.athleteId,
        athleteName: input.athleteName || 'Athlete',
        athleteEmail: input.athleteEmail,
        coachId: coach.coachId,
        coachName: coach.coachName,
        coachEmail: coach.coachEmail,
        coachCode: coach.code,
        status: 'active',
        createdAt: now,
        updatedAt: now,
    };

    if (existing.exists()) {
        const existingLink = existing.data() as CoachAthleteLink;
        link.createdAt = existingLink.createdAt || now;
    }

    await setDoc(linkRef, link, { merge: true });
    return link;
};

export const unlinkAthleteCoach = async (athleteId: string): Promise<void> => {
    await deleteDoc(doc(db, 'coachAthletes', athleteId));
};

export const getAthleteCoachLink = async (athleteId: string): Promise<CoachAthleteLink | null> => {
    const snap = await getDoc(doc(db, 'coachAthletes', athleteId));
    if (!snap.exists()) return null;
    return snap.data() as CoachAthleteLink;
};

export const getCoachAthletes = async (coachId: string): Promise<CoachAthleteLink[]> => {
    const q = query(
        collection(db, 'coachAthletes'),
        where('coachId', '==', coachId),
        limit(200)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as CoachAthleteLink)
        .filter((link) => link.status === 'active')
        .sort((a, b) => a.athleteName.localeCompare(b.athleteName));
};

export const saveCoachPlan = async (plan: CoachWorkoutPlan): Promise<void> => {
    await setDoc(doc(db, 'coachPlans', plan.id), plan);
};

export const updateCoachPlan = async (
    planId: string,
    data: Partial<CoachWorkoutPlan>
): Promise<void> => {
    await updateDoc(doc(db, 'coachPlans', planId), {
        ...data,
        updatedAt: Date.now(),
    });
};

export const updateCoachPlanProgress = async (
    planId: string,
    data: Partial<Pick<
        CoachWorkoutPlan,
        'progressCompletedSets' | 'progressTotalSets' | 'progressCurrentExercise' | 'athleteInSession'
    >>
): Promise<void> => {
    await updateDoc(doc(db, 'coachPlans', planId), {
        ...data,
        progressUpdatedAt: Date.now(),
        updatedAt: Date.now(),
    });
};

export const deleteCoachPlan = async (planId: string): Promise<void> => {
    await deleteDoc(doc(db, 'coachPlans', planId));
};

export const getAthleteCoachPlans = async (
    athleteId: string,
    daysAhead = 21,
    daysBack = 14
): Promise<CoachWorkoutPlan[]> => {
    const q = query(
        collection(db, 'coachPlans'),
        where('athleteId', '==', athleteId),
        limit(Math.max(daysAhead * 6, 80))
    );
    const snap = await getDocs(q);

    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return snap.docs
        .map((d) => d.data() as CoachWorkoutPlan)
        .filter((plan) => (
            plan.status !== 'cancelled' &&
            plan.scheduledDate >= startDate &&
            plan.scheduledDate <= endDate
        ))
        .sort((a, b) => (
            a.scheduledDate.localeCompare(b.scheduledDate) ||
            b.createdAt - a.createdAt
        ));
};

export const getCoachPlansByCoach = async (
    coachId: string,
    athleteId?: string
): Promise<CoachWorkoutPlan[]> => {
    const q = query(
        collection(db, 'coachPlans'),
        where('coachId', '==', coachId),
        limit(240)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as CoachWorkoutPlan)
        .filter((plan) => !athleteId || plan.athleteId === athleteId)
        .sort((a, b) => (
            a.scheduledDate.localeCompare(b.scheduledDate) ||
            a.title.localeCompare(b.title)
        ));
};

export const getCoachVisibleWorkouts = async (
    coachId: string,
    athleteId: string,
    maxResults = 40
): Promise<WorkoutSession[]> => {
    const linkSnap = await getDoc(doc(db, 'coachAthletes', athleteId));
    if (!linkSnap.exists()) return [];

    const link = linkSnap.data() as CoachAthleteLink;
    if (link.coachId !== coachId || link.status !== 'active') return [];

    return fetchCompletedWorkouts(athleteId, maxResults);
};

// ─── Community ───
export const getPublicCommunityGroups = async (): Promise<CommunityGroup[]> => {
    const q = query(
        collection(db, 'communityGroups'),
        where('isPublic', '==', true),
        limit(80)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as CommunityGroup)
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const getMyCommunityGroups = async (userId: string): Promise<CommunityGroup[]> => {
    const q = query(
        collection(db, 'communityGroups'),
        where('memberIds', 'array-contains', userId),
        limit(120)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as CommunityGroup)
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const saveCommunityGroup = async (group: CommunityGroup): Promise<void> => {
    await setDoc(doc(db, 'communityGroups', group.id), group);
};

const saveCommunityInvite = async (invite: CommunityInvite): Promise<void> => {
    await setDoc(doc(db, 'communityInvites', invite.code), invite);
};

export const createCommunityGroup = async (input: {
    id: string;
    name: string;
    description: string;
    kind: CommunityGroupKind;
    ownerId: string;
    ownerName: string;
    isPublic: boolean;
    memberIds: string[];
}): Promise<CommunityGroup> => {
    const now = Date.now();
    const normalizedMembers = Array.from(new Set([input.ownerId, ...input.memberIds]));
    const inviteCode = await buildCommunityInviteCode();
    const payload: CommunityGroup = {
        id: input.id,
        name: input.name.trim(),
        description: input.description.trim(),
        kind: input.kind,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        isPublic: input.isPublic,
        inviteCode,
        memberIds: normalizedMembers,
        createdAt: now,
        updatedAt: now,
    };
    const invite: CommunityInvite = {
        code: inviteCode,
        groupId: payload.id,
        groupName: payload.name,
        ownerId: payload.ownerId,
        ownerName: payload.ownerName,
        status: 'active',
        createdAt: now,
        updatedAt: now,
    };
    await saveCommunityGroup(payload);
    await saveCommunityInvite(invite);
    return payload;
};

export const joinCommunityGroup = async (groupId: string, userId: string): Promise<void> => {
    await updateDoc(doc(db, 'communityGroups', groupId), {
        memberIds: arrayUnion(userId),
        updatedAt: Date.now(),
    });
};

export const leaveCommunityGroup = async (groupId: string, userId: string): Promise<void> => {
    await updateDoc(doc(db, 'communityGroups', groupId), {
        memberIds: arrayRemove(userId),
        updatedAt: Date.now(),
    });
};

export const joinCommunityGroupByInviteCode = async (
    rawInviteCode: string,
    userId: string
): Promise<CommunityGroup> => {
    const inviteCode = normalizeCommunityInviteCode(rawInviteCode);
    if (!inviteCode) throw new Error('Enter a valid invite code');

    const inviteSnap = await getDoc(doc(db, 'communityInvites', inviteCode));
    if (!inviteSnap.exists()) throw new Error('Invite code not found');

    const invite = inviteSnap.data() as CommunityInvite;
    if (invite.status !== 'active') throw new Error('Invite code is no longer active');

    const groupRef = doc(db, 'communityGroups', invite.groupId);
    await updateDoc(groupRef, {
        memberIds: arrayUnion(userId),
        updatedAt: Date.now(),
    });

    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) throw new Error('Group no longer exists');
    return groupSnap.data() as CommunityGroup;
};

export const addMembersToCommunityGroup = async (
    groupId: string,
    memberIds: string[]
): Promise<void> => {
    const uniqueMembers = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
    if (uniqueMembers.length === 0) return;
    await updateDoc(doc(db, 'communityGroups', groupId), {
        memberIds: arrayUnion(...uniqueMembers),
        updatedAt: Date.now(),
    });
};

export const regenerateCommunityGroupInviteCode = async (
    groupId: string,
    ownerId: string
): Promise<string> => {
    const groupRef = doc(db, 'communityGroups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) throw new Error('Group not found');

    const group = groupSnap.data() as CommunityGroup;
    if (group.ownerId !== ownerId) throw new Error('Only the group owner can regenerate invite code');

    const now = Date.now();
    const nextInviteCode = await buildCommunityInviteCode();
    const oldInviteCode = normalizeCommunityInviteCode(group.inviteCode || '');

    const nextInvite: CommunityInvite = {
        code: nextInviteCode,
        groupId: group.id,
        groupName: group.name,
        ownerId: group.ownerId,
        ownerName: group.ownerName,
        status: 'active',
        createdAt: now,
        updatedAt: now,
    };

    const writes: Array<Promise<void>> = [
        updateDoc(groupRef, {
            inviteCode: nextInviteCode,
            updatedAt: now,
        }),
        saveCommunityInvite(nextInvite),
    ];

    if (oldInviteCode) {
        writes.push(
            setDoc(doc(db, 'communityInvites', oldInviteCode), {
                code: oldInviteCode,
                groupId: group.id,
                groupName: group.name,
                ownerId: group.ownerId,
                ownerName: group.ownerName,
                status: 'revoked',
                updatedAt: now,
            }, { merge: true })
        );
    }

    await Promise.all(writes);
    return nextInviteCode;
};

export const saveCommunityMessage = async (message: CommunityMessage): Promise<void> => {
    await setDoc(doc(db, 'communityMessages', message.id), message);
};

export const getCommunityMessages = async (
    groupId: string,
    maxResults = 120
): Promise<CommunityMessage[]> => {
    const q = query(
        collection(db, 'communityMessages'),
        where('groupId', '==', groupId),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as CommunityMessage)
        .sort((a, b) => a.createdAt - b.createdAt);
};

export const saveCommunityGroupChallenge = async (
    challenge: CommunityGroupChallenge
): Promise<void> => {
    await setDoc(doc(db, 'communityGroupChallenges', challenge.id), challenge);
};

export const getCommunityGroupChallenges = async (
    groupId: string,
    maxResults = 20
): Promise<CommunityGroupChallenge[]> => {
    const q = query(
        collection(db, 'communityGroupChallenges'),
        where('groupId', '==', groupId),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    const challenges = snap.docs
        .map((d) => d.data() as CommunityGroupChallenge)
        .map((challenge) => ({
            ...challenge,
            status: getCommunityGroupChallengeStatus(challenge),
        }));
    return sortCommunityGroupChallenges(challenges);
};

export const getCommunityGroupChallengeEntries = async (
    groupId: string,
    challengeId: string,
    maxResults = 80
): Promise<CommunityGroupChallengeEntry[]> => {
    const scope = buildCommunityChallengeEntriesScope({ groupId, challengeId, maxResults });
    const q = query(
        collection(db, 'communityGroupChallengeEntries'),
        where('groupId', '==', scope.groupId),
        where('challengeId', '==', scope.challengeId),
        limit(scope.maxResults)
    );
    const snap = await getDocs(q);
    return sortCommunityGroupChallengeEntries(
        snap.docs.map((d) => d.data() as CommunityGroupChallengeEntry)
    );
};

export const syncCommunityGroupChallengeProgress = async (
    challenge: CommunityGroupChallenge,
    userId: string,
    userName: string,
    options?: { existingJoinedAt?: number }
): Promise<CommunityGroupChallengeEntry> => {
    const workouts = await getUserWorkouts(userId, challenge.period === 'yearly' ? 520 : 240);
    const payload = buildCommunityGroupChallengeEntry({
        challenge,
        userId,
        userName,
        workouts,
        existingJoinedAt: options?.existingJoinedAt,
    });

    await setDoc(doc(db, 'communityGroupChallengeEntries', payload.id), payload, { merge: true });
    return payload;
};

export const saveCommunityReport = async (report: CommunityReport): Promise<void> => {
    await setDoc(doc(db, 'communityReports', report.id), report);
};

export const getCommunityReports = async (
    groupId: string,
    ownerId: string,
    maxResults = 80
): Promise<CommunityReport[]> => {
    const q = query(
        collection(db, 'communityReports'),
        where('groupId', '==', groupId),
        where('ownerId', '==', ownerId),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data() as CommunityReport)
        .sort((a, b) => {
            if (a.status !== b.status) {
                const weight = { open: 0, reviewed: 1, resolved: 2 };
                return weight[a.status] - weight[b.status];
            }
            return b.createdAt - a.createdAt;
        });
};

export const updateCommunityReportStatus = async (
    reportId: string,
    status: CommunityReportStatus
): Promise<void> => {
    await updateDoc(doc(db, 'communityReports', reportId), {
        status,
        updatedAt: Date.now(),
    });
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
export const saveFitnessDailyConfig = async (
    uid: string,
    config: FitnessDailyConfig
): Promise<void> => {
    const payload: FitnessDailyConfig = {
        ...config,
        userId: uid,
        updatedAt: Date.now(),
    };
    await setDoc(doc(db, 'fitnessDailies', uid, 'config', 'current'), payload, { merge: true });
};

export const getFitnessDailyConfig = async (uid: string): Promise<FitnessDailyConfig | null> => {
    const snap = await getDoc(doc(db, 'fitnessDailies', uid, 'config', 'current'));
    if (!snap.exists()) return null;
    return snap.data() as FitnessDailyConfig;
};

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
