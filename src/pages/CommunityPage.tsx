import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
    Globe,
    Lock,
    MessagesSquare,
    Plus,
    RefreshCcw,
    Send,
    Trophy,
    Users,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import {
    addMembersToCommunityGroup,
    createCommunityGroup,
    getCoachAthletes,
    getCommunityGroupChallengeEntries,
    getCommunityGroupChallenges,
    getCommunityMessages,
    getCommunityReports,
    getMyCommunityGroups,
    getPublicCommunityGroups,
    joinCommunityGroupByInviteCode,
    joinCommunityGroup,
    leaveCommunityGroup,
    regenerateCommunityGroupInviteCode,
    saveCommunityGroupChallenge,
    saveCommunityMessage,
    saveCommunityReport,
    syncCommunityGroupChallengeProgress,
    updateCommunityReportStatus,
} from '../lib/firestoreService';
import type {
    ChallengePeriod,
    CoachAthleteLink,
    CommunityGroup,
    CommunityGroupChallenge,
    CommunityGroupChallengeEntry,
    CommunityGroupKind,
    CommunityMessage,
    CommunityReport,
    CommunityReportReason,
    CommunityReportStatus,
    CommunityReportTargetType,
} from '../lib/types';
import {
    buildCommunityGroupChallenge,
    getCommunityGroupChallengeStatus,
    sortCommunityGroupChallengeEntries,
    sortCommunityGroupChallenges,
} from '../lib/communityChallenges';
import {
    COMMUNITY_REPORT_REASONS,
    buildCommunityReport,
    countOpenCommunityReports,
    getCommunityReportReasonLabel,
    sortCommunityReports,
} from '../lib/communityModeration';
import { copyToClipboard } from '../lib/utils';

const createId = (): string => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const getFriendlyError = (context: string, error: unknown): string => {
    const fallback = `${context}. Please try again.`;
    if (!error || typeof error !== 'object') return fallback;
    const candidate = error as { code?: string; message?: string };

    if (candidate.code === 'permission-denied') {
        return `${context}. Permission denied. Deploy latest Firestore rules and sign in again.`;
    }
    if (candidate.code === 'unauthenticated') {
        return `${context}. Session expired. Sign out and sign back in.`;
    }
    if (candidate.code === 'unavailable') {
        return `${context}. Network unavailable. Check your connection.`;
    }
    if (candidate.message) {
        return `${context}. ${candidate.message}`;
    }
    return fallback;
};

export default function CommunityPage() {
    const { user, profile } = useAuthStore();

    const [myGroups, setMyGroups] = useState<CommunityGroup[]>([]);
    const [publicGroups, setPublicGroups] = useState<CommunityGroup[]>([]);
    const [coachAthletes, setCoachAthletes] = useState<CoachAthleteLink[]>([]);

    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [groupChallenges, setGroupChallenges] = useState<CommunityGroupChallenge[]>([]);
    const [selectedGroupChallengeId, setSelectedGroupChallengeId] = useState('');
    const [challengeEntries, setChallengeEntries] = useState<CommunityGroupChallengeEntry[]>([]);
    const [messages, setMessages] = useState<CommunityMessage[]>([]);
    const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
    const [messageText, setMessageText] = useState('');
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingChallenges, setLoadingChallenges] = useState(false);
    const [loadingChallengeEntries, setLoadingChallengeEntries] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadingReports, setLoadingReports] = useState(false);
    const [sending, setSending] = useState(false);
    const [groupsError, setGroupsError] = useState('');
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [joiningByInviteCode, setJoiningByInviteCode] = useState(false);
    const [selectedReportTarget, setSelectedReportTarget] = useState<{
        targetType: CommunityReportTargetType;
        targetId: string;
        targetPreview: string;
    } | null>(null);
    const [showGroupChallengeComposer, setShowGroupChallengeComposer] = useState(false);
    const [groupChallengeTitle, setGroupChallengeTitle] = useState('');
    const [groupChallengeDescription, setGroupChallengeDescription] = useState('');
    const [groupChallengePeriod, setGroupChallengePeriod] = useState<ChallengePeriod>('weekly');
    const [groupChallengeTarget, setGroupChallengeTarget] = useState(4);
    const [reportReason, setReportReason] = useState<CommunityReportReason>('spam');
    const [reportDetails, setReportDetails] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);
    const [updatingReportId, setUpdatingReportId] = useState('');
    const [creatingGroupChallenge, setCreatingGroupChallenge] = useState(false);
    const [syncingChallengeId, setSyncingChallengeId] = useState('');

    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [groupKind, setGroupKind] = useState<CommunityGroupKind>('coach');
    const [groupIsPublic, setGroupIsPublic] = useState(false);
    const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [groupMemberSelection, setGroupMemberSelection] = useState<string[]>([]);
    const [addingMembers, setAddingMembers] = useState(false);
    const [regeneratingInvite, setRegeneratingInvite] = useState(false);

    const role = profile?.role === 'coach' ? 'coach' : 'athlete';

    const groupMap = useMemo(() => {
        const map = new Map<string, CommunityGroup>();
        for (const group of [...publicGroups, ...myGroups]) {
            map.set(group.id, group);
        }
        return map;
    }, [myGroups, publicGroups]);

    const selectedGroup = selectedGroupId ? groupMap.get(selectedGroupId) || null : null;
    const selectedGroupChallenge = selectedGroupChallengeId
        ? groupChallenges.find((challenge) => challenge.id === selectedGroupChallengeId) ?? null
        : null;
    const isSelectedGroupMember = !!(selectedGroup && user && selectedGroup.memberIds.includes(user.uid));
    const isSelectedGroupOwner = !!(selectedGroup && user && selectedGroup.ownerId === user.uid);
    const availableAthletesForSelectedGroup = useMemo(() => {
        if (!selectedGroup) return [];
        return coachAthletes.filter((athlete) => !selectedGroup.memberIds.includes(athlete.athleteId));
    }, [coachAthletes, selectedGroup]);

    const discoverGroups = useMemo(() => {
        const myIds = new Set(myGroups.map((group) => group.id));
        return publicGroups.filter((group) => !myIds.has(group.id));
    }, [myGroups, publicGroups]);
    const openReportCount = useMemo(
        () => countOpenCommunityReports(communityReports),
        [communityReports]
    );
    const myChallengeEntry = useMemo(
        () => challengeEntries.find((entry) => entry.userId === user?.uid) ?? null,
        [challengeEntries, user?.uid]
    );

    const loadGroups = async () => {
        if (!user) return;
        setLoadingGroups(true);
        setGroupsError('');
        try {
            const coachAthletesPromise = role === 'coach'
                ? getCoachAthletes(user.uid)
                : Promise.resolve([]);
            const [mineResult, publicResult, coachAthletesResult] = await Promise.allSettled([
                getMyCommunityGroups(user.uid),
                getPublicCommunityGroups(),
                coachAthletesPromise,
            ]);

            const failures: string[] = [];
            const mine = mineResult.status === 'fulfilled' ? mineResult.value : [];
            if (mineResult.status !== 'fulfilled') {
                failures.push(getFriendlyError('Could not load your groups', mineResult.reason));
            }

            const publicList = publicResult.status === 'fulfilled' ? publicResult.value : [];
            if (publicResult.status !== 'fulfilled') {
                failures.push(getFriendlyError('Could not load public groups', publicResult.reason));
            }

            const athletes = coachAthletesResult.status === 'fulfilled' ? coachAthletesResult.value : [];
            if (coachAthletesResult.status !== 'fulfilled') {
                failures.push(getFriendlyError('Could not load coach athlete roster', coachAthletesResult.reason));
            }

            setMyGroups(mine);
            setPublicGroups(publicList);
            setCoachAthletes(athletes);
            setSelectedGroupId((current) => {
                if (current && (mine.some((group) => group.id === current) || publicList.some((group) => group.id === current))) {
                    return current;
                }
                return mine[0]?.id || publicList[0]?.id || '';
            });

            if (failures.length > 0) {
                const message = failures[0];
                setGroupsError(message);
                toast.error(message, { id: 'community-groups-load' });
                console.warn('Community load failures:', failures);
            }
        } catch (error) {
            const message = getFriendlyError('Could not load community groups', error);
            setGroupsError(message);
            toast.error(message, { id: 'community-groups-load' });
            console.warn('Failed to load community groups:', error);
        } finally {
            setLoadingGroups(false);
        }
    };

    const loadMessages = async (groupId: string) => {
        if (!groupId) {
            setMessages([]);
            return;
        }
        setLoadingMessages(true);
        try {
            const list = await getCommunityMessages(groupId, 180);
            setMessages(list);
        } catch (error) {
            console.warn('Failed to load messages:', error);
            toast.error(getFriendlyError('Could not load messages', error), { id: 'community-messages-load' });
        } finally {
            setLoadingMessages(false);
        }
    };

    const loadGroupChallenges = async (groupId: string) => {
        setLoadingChallenges(true);
        try {
            const challenges = await getCommunityGroupChallenges(groupId, 12);
            const sorted = sortCommunityGroupChallenges(challenges);
            setGroupChallenges(sorted);
            setSelectedGroupChallengeId((current) => {
                if (current && sorted.some((challenge) => challenge.id === current)) {
                    return current;
                }
                return sorted[0]?.id || '';
            });
        } catch (error) {
            console.warn('Failed to load community challenges:', error);
            toast.error(getFriendlyError('Could not load group challenges', error), { id: 'community-challenges-load' });
        } finally {
            setLoadingChallenges(false);
        }
    };

    const loadChallengeEntries = async (challengeId: string) => {
        if (!challengeId) {
            setChallengeEntries([]);
            return;
        }
        setLoadingChallengeEntries(true);
        try {
            const entries = await getCommunityGroupChallengeEntries(challengeId, 80);
            setChallengeEntries(sortCommunityGroupChallengeEntries(entries));
        } catch (error) {
            console.warn('Failed to load community challenge entries:', error);
            toast.error(getFriendlyError('Could not load leaderboard', error), { id: 'community-challenge-entries-load' });
        } finally {
            setLoadingChallengeEntries(false);
        }
    };

    const loadReports = async (groupId: string, ownerId: string) => {
        setLoadingReports(true);
        try {
            const reports = await getCommunityReports(groupId, ownerId, 60);
            setCommunityReports(sortCommunityReports(reports));
        } catch (error) {
            console.warn('Failed to load community reports:', error);
            toast.error(getFriendlyError('Could not load moderation reports', error), { id: 'community-reports-load' });
        } finally {
            setLoadingReports(false);
        }
    };

    useEffect(() => {
        if (!user?.uid) return;
        void loadGroups();
    }, [user?.uid, role]);

    useEffect(() => {
        if (!selectedGroupId) return;
        void loadMessages(selectedGroupId);
    }, [selectedGroupId]);

    useEffect(() => {
        if (!selectedGroupId) {
            setGroupChallenges([]);
            setSelectedGroupChallengeId('');
            setChallengeEntries([]);
            return;
        }
        void loadGroupChallenges(selectedGroupId);
    }, [selectedGroupId]);

    useEffect(() => {
        if (!selectedGroupId) return;
        const interval = window.setInterval(() => {
            void loadMessages(selectedGroupId);
        }, 9000);
        return () => window.clearInterval(interval);
    }, [selectedGroupId]);

    useEffect(() => {
        if (!selectedGroup || !user || !isSelectedGroupOwner) {
            setCommunityReports([]);
            return;
        }
        void loadReports(selectedGroup.id, user.uid);
    }, [selectedGroup, isSelectedGroupOwner, user]);

    useEffect(() => {
        void loadChallengeEntries(selectedGroupChallengeId);
    }, [selectedGroupChallengeId]);

    useEffect(() => {
        setSelectedReportTarget(null);
        setReportReason('spam');
        setReportDetails('');
        setShowGroupChallengeComposer(false);
        setGroupChallengeTitle('');
        setGroupChallengeDescription('');
        setGroupChallengePeriod('weekly');
        setGroupChallengeTarget(4);
    }, [selectedGroupId]);

    useEffect(() => {
        if (!selectedGroup) {
            setGroupMemberSelection([]);
            return;
        }
        const available = new Set(availableAthletesForSelectedGroup.map((athlete) => athlete.athleteId));
        setGroupMemberSelection((current) => current.filter((athleteId) => available.has(athleteId)));
    }, [selectedGroup, availableAthletesForSelectedGroup]);

    const toggleAthlete = (athleteId: string) => {
        setSelectedAthleteIds((current) => (
            current.includes(athleteId)
                ? current.filter((id) => id !== athleteId)
                : [...current, athleteId]
        ));
    };

    const toggleGroupMemberSelection = (athleteId: string) => {
        setGroupMemberSelection((current) => (
            current.includes(athleteId)
                ? current.filter((id) => id !== athleteId)
                : [...current, athleteId]
        ));
    };

    const handleJoinByInviteCode = async () => {
        if (!user) return;
        const code = inviteCodeInput.trim();
        if (!code) {
            toast.error('Enter an invite code');
            return;
        }

        setJoiningByInviteCode(true);
        try {
            const group = await joinCommunityGroupByInviteCode(code, user.uid);
            toast.success(`Joined ${group.name}`);
            setInviteCodeInput('');
            await loadGroups();
            setSelectedGroupId(group.id);
        } catch (error) {
            console.warn('Join by invite code failed:', error);
            toast.error(getFriendlyError('Could not join with invite code', error));
        } finally {
            setJoiningByInviteCode(false);
        }
    };

    const handleAddMembersToGroup = async () => {
        if (!selectedGroup || !isSelectedGroupOwner) return;
        if (groupMemberSelection.length === 0) {
            toast.error('Select at least one athlete');
            return;
        }
        setAddingMembers(true);
        try {
            await addMembersToCommunityGroup(selectedGroup.id, groupMemberSelection);
            toast.success('Members added to group');
            setGroupMemberSelection([]);
            await loadGroups();
            setSelectedGroupId(selectedGroup.id);
        } catch (error) {
            console.warn('Add members failed:', error);
            toast.error(getFriendlyError('Could not add members', error));
        } finally {
            setAddingMembers(false);
        }
    };

    const handleCopyInviteCode = async () => {
        if (!selectedGroup?.inviteCode) {
            toast.error('No invite code yet');
            return;
        }
        const ok = await copyToClipboard(selectedGroup.inviteCode);
        if (ok) toast.success('Invite code copied');
        else toast.error('Could not copy invite code');
    };

    const handleRegenerateInviteCode = async () => {
        if (!selectedGroup || !user || !isSelectedGroupOwner) return;
        if (!confirm('Regenerate invite code? Old code will stop working.')) return;

        setRegeneratingInvite(true);
        try {
            const nextCode = await regenerateCommunityGroupInviteCode(selectedGroup.id, user.uid);
            toast.success(`New invite code: ${nextCode}`);
            await loadGroups();
            setSelectedGroupId(selectedGroup.id);
        } catch (error) {
            console.warn('Invite code regeneration failed:', error);
            toast.error(getFriendlyError('Could not regenerate invite code', error));
        } finally {
            setRegeneratingInvite(false);
        }
    };

    const handleJoinGroup = async (group: CommunityGroup) => {
        if (!user) return;
        try {
            await joinCommunityGroup(group.id, user.uid);
            toast.success(`Joined ${group.name}`);
            await loadGroups();
            setSelectedGroupId(group.id);
        } catch (error) {
            console.warn('Join group failed:', error);
            toast.error(getFriendlyError('Could not join group', error));
        }
    };

    const handleLeaveGroup = async (group: CommunityGroup) => {
        if (!user) return;
        if (!confirm(`Leave ${group.name}?`)) return;
        try {
            await leaveCommunityGroup(group.id, user.uid);
            toast.success(`Left ${group.name}`);
            await loadGroups();
            if (selectedGroupId === group.id) {
                setSelectedGroupId('');
                setMessages([]);
            }
        } catch (error) {
            console.warn('Leave group failed:', error);
            toast.error(getFriendlyError('Could not leave group', error));
        }
    };

    const handleCreateCoachGroup = async () => {
        if (!user) return;
        if (groupName.trim().length < 3) {
            toast.error('Group name should be at least 3 characters');
            return;
        }

        setCreatingGroup(true);
        try {
            const group = await createCommunityGroup({
                id: createId(),
                name: groupName.trim(),
                description: groupDescription.trim(),
                kind: groupKind,
                ownerId: user.uid,
                ownerName: profile?.displayName || user.displayName || 'Coach',
                isPublic: groupIsPublic,
                memberIds: selectedAthleteIds,
            });
            toast.success(group.inviteCode ? `Community group created. Invite: ${group.inviteCode}` : 'Community group created');
            setGroupName('');
            setGroupDescription('');
            setGroupKind('coach');
            setGroupIsPublic(false);
            setSelectedAthleteIds([]);
            await loadGroups();
            setSelectedGroupId(group.id);
        } catch (error) {
            console.warn('Create group failed:', error);
            toast.error(getFriendlyError('Could not create group', error));
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleCreateGroupChallenge = async () => {
        if (!user || !selectedGroup || !isSelectedGroupOwner) return;
        if (groupChallengeTitle.trim().length < 3) {
            toast.error('Challenge title should be at least 3 characters');
            return;
        }

        setCreatingGroupChallenge(true);
        try {
            const challenge = buildCommunityGroupChallenge({
                id: createId(),
                groupId: selectedGroup.id,
                ownerId: selectedGroup.ownerId,
                createdById: user.uid,
                createdByName: profile?.displayName || user.displayName || 'Coach',
                title: groupChallengeTitle,
                description: groupChallengeDescription,
                period: groupChallengePeriod,
                targetCount: groupChallengeTarget,
            });
            await saveCommunityGroupChallenge(challenge);
            setGroupChallenges((current) => sortCommunityGroupChallenges([challenge, ...current]));
            setSelectedGroupChallengeId(challenge.id);
            setShowGroupChallengeComposer(false);
            setGroupChallengeTitle('');
            setGroupChallengeDescription('');
            setGroupChallengePeriod('weekly');
            setGroupChallengeTarget(4);
            toast.success('Group challenge created');
        } catch (error) {
            console.warn('Create group challenge failed:', error);
            toast.error(getFriendlyError('Could not create group challenge', error));
        } finally {
            setCreatingGroupChallenge(false);
        }
    };

    const handleSyncChallengeProgress = async () => {
        if (!user || !selectedGroupChallenge || !isSelectedGroupMember) return;
        setSyncingChallengeId(selectedGroupChallenge.id);
        try {
            const entry = await syncCommunityGroupChallengeProgress(
                selectedGroupChallenge,
                user.uid,
                profile?.displayName || user.displayName || 'Member'
            );
            setChallengeEntries((current) => sortCommunityGroupChallengeEntries([
                entry,
                ...current.filter((item) => item.id !== entry.id),
            ]));
            toast.success('Leaderboard synced from your workout history');
        } catch (error) {
            console.warn('Sync group challenge progress failed:', error);
            toast.error(getFriendlyError('Could not sync your progress', error));
        } finally {
            setSyncingChallengeId('');
        }
    };

    const openReportComposer = (
        targetType: CommunityReportTargetType,
        targetId: string,
        targetPreview: string
    ) => {
        setSelectedReportTarget({
            targetType,
            targetId,
            targetPreview,
        });
        setReportReason('spam');
        setReportDetails('');
    };

    const closeReportComposer = () => {
        setSelectedReportTarget(null);
        setReportReason('spam');
        setReportDetails('');
    };

    const handleSubmitReport = async () => {
        if (!user || !selectedGroup || !selectedReportTarget) return;

        const payload = buildCommunityReport({
            id: createId(),
            groupId: selectedGroup.id,
            ownerId: selectedGroup.ownerId,
            reporterId: user.uid,
            reporterName: profile?.displayName || user.displayName || 'Member',
            targetType: selectedReportTarget.targetType,
            targetId: selectedReportTarget.targetId,
            targetPreview: selectedReportTarget.targetPreview,
            reason: reportReason,
            details: reportDetails,
        });

        setSubmittingReport(true);
        try {
            await saveCommunityReport(payload);
            toast.success('Report sent to the group moderator');
            closeReportComposer();
        } catch (error) {
            console.warn('Submit report failed:', error);
            toast.error(getFriendlyError('Could not submit report', error));
        } finally {
            setSubmittingReport(false);
        }
    };

    const handleUpdateReportStatus = async (
        reportId: string,
        status: CommunityReportStatus
    ) => {
        if (!isSelectedGroupOwner) return;
        setUpdatingReportId(reportId);
        try {
            await updateCommunityReportStatus(reportId, status);
            setCommunityReports((current) => sortCommunityReports(current.map((report) => (
                report.id === reportId
                    ? { ...report, status, updatedAt: Date.now() }
                    : report
            ))));
            toast.success(status === 'resolved' ? 'Report resolved' : 'Report marked reviewed');
        } catch (error) {
            console.warn('Update report status failed:', error);
            toast.error(getFriendlyError('Could not update report status', error));
        } finally {
            setUpdatingReportId('');
        }
    };

    const handleSendMessage = async () => {
        if (!user || !selectedGroup) return;
        const text = messageText.trim();
        if (!text) return;

        const payload: CommunityMessage = {
            id: createId(),
            groupId: selectedGroup.id,
            userId: user.uid,
            userName: profile?.displayName || user.displayName || 'Member',
            text,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        setSending(true);
        try {
            await saveCommunityMessage(payload);
            setMessageText('');
            setMessages((current) => [...current, payload]);
        } catch (error) {
            console.warn('Send message failed:', error);
            toast.error(getFriendlyError('Could not send message', error));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
            <div className="glass rounded-3xl p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-text-muted">Kabunga Community</p>
                        <h1 className="text-2xl font-black mt-1">Groups & Chat</h1>
                        <p className="text-xs text-text-secondary mt-1">
                            Connect, learn, and stay accountable with your training circle.
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                        <MessagesSquare size={20} />
                    </div>
                </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-2">
                <p className="text-sm font-semibold">Join With Invite Code</p>
                <p className="text-xs text-text-secondary">
                    Got a private group invite from your coach? Paste the code and join directly.
                </p>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={inviteCodeInput}
                        onChange={(event) => setInviteCodeInput(event.target.value.toUpperCase())}
                        placeholder="e.g. KBG9A7X2"
                        className="flex-1 bg-bg-input border border-border rounded-xl py-2.5 px-3 text-sm"
                    />
                    <button
                        onClick={() => void handleJoinByInviteCode()}
                        disabled={joiningByInviteCode}
                        className="px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-50"
                    >
                        {joiningByInviteCode ? 'Joining...' : 'Join'}
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Users size={16} className="text-accent" />
                        My Groups
                    </h3>
                    <div className="flex items-center gap-2">
                        {loadingGroups && <span className="text-xs text-text-muted">Refreshing...</span>}
                        <button
                            onClick={() => void loadGroups()}
                            className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1"
                        >
                            <RefreshCcw size={12} />
                            Refresh
                        </button>
                    </div>
                </div>

                {groupsError && (
                    <div className="rounded-xl border border-red/30 bg-red/10 p-3 space-y-2">
                        <p className="text-xs text-red">{groupsError}</p>
                        <button
                            onClick={() => void loadGroups()}
                            className="text-xs text-red underline"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {myGroups.length === 0 ? (
                    <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                        You are not in any group yet. Join a public group below.
                    </div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {myGroups.map((group) => {
                            const active = selectedGroupId === group.id;
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border ${active
                                        ? 'bg-accent/15 border-accent text-accent'
                                        : 'bg-bg-card border-border text-text-secondary'
                                        }`}
                                >
                                    {group.name}
                                </button>
                            );
                        })}
                    </div>
                )}

                {discoverGroups.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-text-muted">Discover Public Groups</p>
                        {discoverGroups.map((group) => (
                            <div key={group.id} className="rounded-xl border border-border bg-bg-card p-3 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold">{group.name}</p>
                                    <p className="text-xs text-text-secondary mt-1 line-clamp-1">{group.description || 'Open community group'}</p>
                                </div>
                                <button
                                    onClick={() => void handleJoinGroup(group)}
                                    className="px-3 py-1.5 rounded-lg border border-accent/40 text-accent text-xs font-semibold"
                                >
                                    Join
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedGroup && (
                <div className="glass rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold">{selectedGroup.name}</p>
                            <p className="text-xs text-text-secondary mt-1">{selectedGroup.description || 'No description yet.'}</p>
                            <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                                {selectedGroup.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                                {selectedGroup.isPublic ? 'Public group' : 'Private group'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {user && selectedGroup.ownerId !== user.uid && (
                                <button
                                    onClick={() => openReportComposer(
                                        'group',
                                        selectedGroup.id,
                                        `${selectedGroup.name} ${selectedGroup.description}`.trim()
                                    )}
                                    className="text-xs text-amber"
                                >
                                    Report
                                </button>
                            )}
                            {user && selectedGroup.ownerId !== user.uid && selectedGroup.memberIds.includes(user.uid) && (
                                <button
                                    onClick={() => void handleLeaveGroup(selectedGroup)}
                                    className="text-xs text-red"
                                >
                                    Leave
                                </button>
                            )}
                        </div>
                    </div>

                    {isSelectedGroupOwner && (
                        <div className="rounded-xl border border-border bg-bg-card p-3 space-y-2">
                            <p className="text-xs font-semibold text-text-secondary">Invite Management</p>
                            <div className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-accent">Invite Code</p>
                                    <p className="text-sm font-semibold text-text-primary">
                                        {selectedGroup.inviteCode || 'Not generated'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => void handleCopyInviteCode()}
                                        disabled={!selectedGroup.inviteCode}
                                        className="text-xs text-accent disabled:opacity-40"
                                    >
                                        Copy
                                    </button>
                                    <button
                                        onClick={() => void handleRegenerateInviteCode()}
                                        disabled={regeneratingInvite}
                                        className="text-xs text-amber disabled:opacity-50"
                                    >
                                        {regeneratingInvite ? 'Updating...' : 'Regenerate'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[11px] text-text-muted">
                                Members can join private groups using this code. Regenerating disables the old code.
                            </p>
                        </div>
                    )}

                    {isSelectedGroupOwner && role === 'coach' && availableAthletesForSelectedGroup.length > 0 && (
                        <div className="rounded-xl border border-border bg-bg-card p-3 space-y-2">
                            <p className="text-xs font-semibold text-text-secondary">Add Existing Athletes</p>
                            <div className="space-y-1 max-h-36 overflow-y-auto">
                                {availableAthletesForSelectedGroup.map((athlete) => {
                                    const selected = groupMemberSelection.includes(athlete.athleteId);
                                    return (
                                        <button
                                            key={`${selectedGroup.id}-member-${athlete.athleteId}`}
                                            onClick={() => toggleGroupMemberSelection(athlete.athleteId)}
                                            className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${selected ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg-surface text-text-secondary'}`}
                                        >
                                            {athlete.athleteName} ({athlete.athleteEmail})
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => void handleAddMembersToGroup()}
                                disabled={addingMembers || groupMemberSelection.length === 0}
                                className="w-full py-2 rounded-lg border border-accent/40 text-accent text-xs font-semibold disabled:opacity-40"
                            >
                                {addingMembers ? 'Adding...' : `Add Selected (${groupMemberSelection.length})`}
                            </button>
                        </div>
                    )}

                    <div className="rounded-xl border border-border bg-bg-card p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-text-secondary flex items-center gap-2">
                                    <Trophy size={14} className="text-amber" />
                                    Group Challenge Leaderboard
                                </p>
                                <p className="text-[11px] text-text-muted mt-1">
                                    Members sync their own workout history into a shared scoreboard.
                                </p>
                            </div>
                            {isSelectedGroupOwner && (
                                <button
                                    onClick={() => setShowGroupChallengeComposer((current) => !current)}
                                    className="text-xs text-accent"
                                >
                                    {showGroupChallengeComposer ? 'Close' : 'New'}
                                </button>
                            )}
                        </div>

                        {showGroupChallengeComposer && isSelectedGroupOwner && (
                            <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-3">
                                <label className="text-xs text-text-secondary block">
                                    Challenge Title
                                    <input
                                        type="text"
                                        value={groupChallengeTitle}
                                        onChange={(event) => setGroupChallengeTitle(event.target.value)}
                                        placeholder="April consistency race"
                                        className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                    />
                                </label>
                                <label className="text-xs text-text-secondary block">
                                    Description
                                    <textarea
                                        value={groupChallengeDescription}
                                        onChange={(event) => setGroupChallengeDescription(event.target.value)}
                                        rows={2}
                                        placeholder="First athlete to hit the target leads the board."
                                        className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                    />
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="text-xs text-text-secondary block">
                                        Window
                                        <select
                                            value={groupChallengePeriod}
                                            onChange={(event) => setGroupChallengePeriod(event.target.value as ChallengePeriod)}
                                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                        >
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="yearly">Yearly</option>
                                        </select>
                                    </label>
                                    <label className="text-xs text-text-secondary block">
                                        Target Workouts
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={groupChallengeTarget}
                                            min={1}
                                            onChange={(event) => setGroupChallengeTarget(parseInt(event.target.value, 10) || 1)}
                                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                        />
                                    </label>
                                </div>
                                <button
                                    onClick={() => void handleCreateGroupChallenge()}
                                    disabled={creatingGroupChallenge}
                                    className="w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    {creatingGroupChallenge ? 'Creating...' : 'Create Group Challenge'}
                                </button>
                            </div>
                        )}

                        {loadingChallenges ? (
                            <p className="text-xs text-text-muted">Loading group challenges...</p>
                        ) : groupChallenges.length === 0 ? (
                            <p className="text-xs text-text-secondary">
                                No group challenge yet. {isSelectedGroupOwner ? 'Create the first one for this group.' : 'Ask the group owner to start one.'}
                            </p>
                        ) : (
                            <>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {groupChallenges.map((challenge) => {
                                        const active = selectedGroupChallengeId === challenge.id;
                                        const status = getCommunityGroupChallengeStatus(challenge);
                                        return (
                                            <button
                                                key={challenge.id}
                                                onClick={() => setSelectedGroupChallengeId(challenge.id)}
                                                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border ${
                                                    active
                                                        ? 'bg-amber/15 border-amber text-amber'
                                                        : 'bg-bg-surface border-border text-text-secondary'
                                                }`}
                                            >
                                                {challenge.title} · {status}
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedGroupChallenge && (
                                    <>
                                        <div className="rounded-xl border border-border bg-bg-surface p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">{selectedGroupChallenge.title}</p>
                                                    <p className="text-xs text-text-secondary mt-1">
                                                        {selectedGroupChallenge.description || 'Workout count challenge for this group.'}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                    getCommunityGroupChallengeStatus(selectedGroupChallenge) === 'completed'
                                                        ? 'bg-green/15 text-green'
                                                        : 'bg-amber/15 text-amber'
                                                }`}>
                                                    {getCommunityGroupChallengeStatus(selectedGroupChallenge)}
                                                </span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                                <div className="rounded-lg bg-bg-card p-2">
                                                    <p className="text-[10px] text-text-muted">Window</p>
                                                    <p className="text-xs font-semibold capitalize">{selectedGroupChallenge.period}</p>
                                                </div>
                                                <div className="rounded-lg bg-bg-card p-2">
                                                    <p className="text-[10px] text-text-muted">Target</p>
                                                    <p className="text-xs font-semibold">{selectedGroupChallenge.targetCount} workouts</p>
                                                </div>
                                                <div className="rounded-lg bg-bg-card p-2">
                                                    <p className="text-[10px] text-text-muted">Ends</p>
                                                    <p className="text-xs font-semibold">{dayjs(selectedGroupChallenge.endDate).format('MMM D')}</p>
                                                </div>
                                            </div>
                                            {myChallengeEntry && myChallengeEntry.challengeId === selectedGroupChallenge.id && (
                                                <p className="text-[11px] text-text-muted mt-3">
                                                    You are at {myChallengeEntry.completedWorkouts}/{myChallengeEntry.targetCount} workouts.
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {loadingChallengeEntries ? (
                                                <p className="text-xs text-text-muted">Loading leaderboard...</p>
                                            ) : challengeEntries.length === 0 ? (
                                                <p className="text-xs text-text-secondary">No one has synced yet. Be the first to put a score on the board.</p>
                                            ) : (
                                                challengeEntries.slice(0, 8).map((entry, index) => {
                                                    const pct = Math.min(100, Math.round((entry.completedWorkouts / Math.max(1, entry.targetCount)) * 100));
                                                    const mine = entry.userId === user?.uid;
                                                    return (
                                                        <div
                                                            key={entry.id}
                                                            className={`rounded-xl border p-3 ${mine ? 'border-accent bg-accent/10' : 'border-border bg-bg-surface'}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${index === 0 ? 'bg-amber/20 text-amber' : 'bg-bg-card text-text-secondary'}`}>
                                                                        #{index + 1}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-semibold truncate">{entry.userName}</p>
                                                                        <p className="text-[11px] text-text-muted">
                                                                            {entry.lastWorkoutAt ? `Last workout ${dayjs(entry.lastWorkoutAt).format('MMM D')}` : 'No workout synced yet'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-sm font-bold">{entry.completedWorkouts}/{entry.targetCount}</p>
                                                                    <p className="text-[11px] text-text-muted">workouts</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 h-2 rounded-full bg-bg-card overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${mine ? 'bg-accent' : 'bg-amber'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {isSelectedGroupMember ? (
                                            <button
                                                onClick={() => void handleSyncChallengeProgress()}
                                                disabled={syncingChallengeId === selectedGroupChallenge.id}
                                                className="w-full py-2.5 rounded-xl border border-amber/40 text-amber text-sm font-semibold disabled:opacity-40"
                                            >
                                                {syncingChallengeId === selectedGroupChallenge.id ? 'Syncing...' : 'Sync My Progress'}
                                            </button>
                                        ) : (
                                            <p className="text-xs text-text-secondary">
                                                Join this group to sync your workout count into the leaderboard.
                                            </p>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {isSelectedGroupOwner && (
                        <div className="rounded-xl border border-border bg-bg-card p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold text-text-secondary">Moderation Inbox</p>
                                    <p className="text-[11px] text-text-muted mt-1">
                                        {openReportCount} open report{openReportCount === 1 ? '' : 's'}
                                    </p>
                                </div>
                                {loadingReports && <span className="text-[11px] text-text-muted">Refreshing...</span>}
                            </div>

                            {communityReports.length === 0 ? (
                                <p className="text-xs text-text-secondary">No reports yet. This group is clean so far.</p>
                            ) : (
                                <div className="space-y-2">
                                    {communityReports.slice(0, 6).map((report) => (
                                        <div key={report.id} className="rounded-xl border border-border bg-bg-surface p-3 space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">
                                                        {report.targetType === 'group' ? 'Group report' : 'Message report'}
                                                    </p>
                                                    <p className="text-[11px] text-text-muted mt-1">
                                                        {report.reporterName} • {getCommunityReportReasonLabel(report.reason)} • {dayjs(report.createdAt).format('MMM D, h:mm A')}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                    report.status === 'open'
                                                        ? 'bg-red/15 text-red'
                                                        : report.status === 'reviewed'
                                                            ? 'bg-amber/15 text-amber'
                                                            : 'bg-green/15 text-green'
                                                }`}>
                                                    {report.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-text-secondary whitespace-pre-wrap">{report.targetPreview}</p>
                                            {report.details && (
                                                <p className="text-xs text-text-secondary border-t border-border pt-2 whitespace-pre-wrap">
                                                    {report.details}
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                {report.status !== 'reviewed' && (
                                                    <button
                                                        onClick={() => void handleUpdateReportStatus(report.id, 'reviewed')}
                                                        disabled={updatingReportId === report.id}
                                                        className="px-3 py-1.5 rounded-lg border border-amber/40 text-amber text-[11px] font-semibold disabled:opacity-40"
                                                    >
                                                        {updatingReportId === report.id ? 'Updating...' : 'Mark Reviewed'}
                                                    </button>
                                                )}
                                                {report.status !== 'resolved' && (
                                                    <button
                                                        onClick={() => void handleUpdateReportStatus(report.id, 'resolved')}
                                                        disabled={updatingReportId === report.id}
                                                        className="px-3 py-1.5 rounded-lg border border-green/40 text-green text-[11px] font-semibold disabled:opacity-40"
                                                    >
                                                        {updatingReportId === report.id ? 'Updating...' : 'Resolve'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedReportTarget && (
                        <div className="rounded-xl border border-amber/30 bg-amber/10 p-3 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber">Report Content</p>
                                    <p className="text-sm font-semibold mt-1">
                                        {selectedReportTarget.targetType === 'group' ? 'Report this group' : 'Report this message'}
                                    </p>
                                    <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">
                                        {selectedReportTarget.targetPreview}
                                    </p>
                                </div>
                                <button
                                    onClick={closeReportComposer}
                                    className="text-xs text-text-secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                            <label className="text-xs text-text-secondary block">
                                Reason
                                <select
                                    value={reportReason}
                                    onChange={(event) => setReportReason(event.target.value as CommunityReportReason)}
                                    className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                >
                                    {COMMUNITY_REPORT_REASONS.map((reason) => (
                                        <option key={reason} value={reason}>
                                            {getCommunityReportReasonLabel(reason)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-xs text-text-secondary block">
                                Details (optional)
                                <textarea
                                    value={reportDetails}
                                    onChange={(event) => setReportDetails(event.target.value)}
                                    rows={3}
                                    placeholder="Add context for the moderator"
                                    className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                />
                            </label>
                            <button
                                onClick={() => void handleSubmitReport()}
                                disabled={submittingReport}
                                className="w-full py-2.5 rounded-xl bg-amber text-bg-primary text-sm font-semibold disabled:opacity-50"
                            >
                                {submittingReport ? 'Sending Report...' : 'Send Report'}
                            </button>
                        </div>
                    )}

                    <div className="rounded-xl bg-bg-card border border-border p-3 h-[280px] overflow-y-auto space-y-2">
                        {loadingMessages ? (
                            <p className="text-xs text-text-muted">Loading messages...</p>
                        ) : messages.length === 0 ? (
                            <p className="text-xs text-text-secondary">No messages yet. Start the conversation.</p>
                        ) : (
                            messages.map((message) => {
                                const mine = user?.uid === message.userId;
                                return (
                                    <div key={message.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${mine ? 'ml-auto bg-accent/15 border border-accent/20' : 'bg-bg-surface border border-border'}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-[11px] text-text-muted">{message.userName}</p>
                                            {!mine && (
                                                <button
                                                    onClick={() => openReportComposer(
                                                        'message',
                                                        message.id,
                                                        `${message.userName}: ${message.text}`
                                                    )}
                                                    className="shrink-0 text-[10px] text-amber"
                                                >
                                                    Report
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm text-text-primary mt-0.5 whitespace-pre-wrap">{message.text}</p>
                                        <p className="text-[10px] text-text-muted mt-1">{dayjs(message.createdAt).format('MMM D, h:mm A')}</p>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {!isSelectedGroupMember ? (
                        <button
                            onClick={() => void handleJoinGroup(selectedGroup)}
                            className="w-full py-2.5 rounded-xl border border-accent/40 text-accent text-sm font-semibold"
                        >
                            Join Group To Participate
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={messageText}
                                onChange={(event) => setMessageText(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void handleSendMessage();
                                    }
                                }}
                                placeholder="Write a message..."
                                className="flex-1 bg-bg-input border border-border rounded-xl py-2.5 px-3 text-sm"
                            />
                            <button
                                onClick={() => void handleSendMessage()}
                                disabled={sending || messageText.trim().length === 0}
                                className="px-3 py-2.5 rounded-xl gradient-primary text-white disabled:opacity-40"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {role === 'coach' && (
                <div className="glass rounded-2xl p-4 space-y-3">
                    <div>
                        <h3 className="text-sm font-semibold">Create Coach Group</h3>
                        <p className="text-xs text-text-muted mt-1">
                            Build a private group for selected athletes, or make it public for wider community.
                        </p>
                    </div>

                    <label className="text-xs text-text-secondary block">
                        Group Name
                        <input
                            type="text"
                            value={groupName}
                            onChange={(event) => setGroupName(event.target.value)}
                            placeholder="Amollo Strength Circle"
                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                        />
                    </label>

                    <label className="text-xs text-text-secondary block">
                        Description
                        <textarea
                            value={groupDescription}
                            onChange={(event) => setGroupDescription(event.target.value)}
                            rows={2}
                            placeholder="Weekly check-ins, accountability, and session prep"
                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-text-secondary block">
                            Group Type
                            <select
                                value={groupKind}
                                onChange={(event) => setGroupKind(event.target.value as CommunityGroupKind)}
                                className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                            >
                                <option value="coach">Coach Group</option>
                                <option value="women">Women</option>
                                <option value="men">Men</option>
                                <option value="mixed">Mixed</option>
                            </select>
                        </label>
                        <label className="text-xs text-text-secondary block">
                            Visibility
                            <select
                                value={groupIsPublic ? 'public' : 'private'}
                                onChange={(event) => setGroupIsPublic(event.target.value === 'public')}
                                className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                            >
                                <option value="private">Private</option>
                                <option value="public">Public</option>
                            </select>
                        </label>
                    </div>

                    {coachAthletes.length > 0 && (
                        <div className="rounded-xl border border-border bg-bg-card p-3 space-y-2">
                            <p className="text-xs font-semibold text-text-secondary">Add Athletes</p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {coachAthletes.map((athlete) => {
                                    const selected = selectedAthleteIds.includes(athlete.athleteId);
                                    return (
                                        <button
                                            key={athlete.athleteId}
                                            onClick={() => toggleAthlete(athlete.athleteId)}
                                            className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${selected ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg-surface text-text-secondary'}`}
                                        >
                                            {athlete.athleteName} ({athlete.athleteEmail})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => void handleCreateCoachGroup()}
                        disabled={creatingGroup}
                        className="w-full py-3 rounded-xl gradient-primary text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Plus size={14} />
                        {creatingGroup ? 'Creating...' : 'Create Group'}
                    </button>
                </div>
            )}
        </div>
    );
}
