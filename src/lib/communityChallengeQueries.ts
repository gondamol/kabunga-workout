export type CommunityChallengeEntriesScope = {
    groupId: string;
    challengeId: string;
    maxResults: number;
};

export const buildCommunityChallengeEntriesScope = ({
    groupId,
    challengeId,
    maxResults = 80,
}: {
    groupId: string;
    challengeId: string;
    maxResults?: number;
}): CommunityChallengeEntriesScope => {
    const normalizedGroupId = groupId.trim();
    const normalizedChallengeId = challengeId.trim();
    if (!normalizedGroupId) {
        throw new Error('Community challenge leaderboard requires a group ID.');
    }
    if (!normalizedChallengeId) {
        throw new Error('Community challenge leaderboard requires a challenge ID.');
    }
    const normalizedLimit = Number.isFinite(maxResults)
        ? Math.max(1, Math.min(200, Math.round(maxResults)))
        : 80;

    return {
        groupId: normalizedGroupId,
        challengeId: normalizedChallengeId,
        maxResults: normalizedLimit,
    };
};
