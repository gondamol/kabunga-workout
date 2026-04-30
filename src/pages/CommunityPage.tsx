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
    Share2,
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
import {
    buildCommunityCreationConfig,
    buildCommunityInviteShareMessage,
    buildCommunityLandingEmptyState,
} from '../lib/communityPresentation';
import { ActionButton, InsightCard, StatChip } from '../components/ui';

const createId = (): string => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const isPermissionDenied = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const code = (error as { code?: string }).code;
    return code === 'permission-denied' || code === 'unauthenticated';
};

const getFriendlyError = (context: string, error: unknown): string => {
    const fallback = `${context}. Please try again.`;
    if (!error || typeof error !== 'object') return fallback;
    const candidate = error as { code?: string; message?: string };

    if (candidate.code === 'permission-denied') {
        return `${context}. You may need to join this circle first.`;
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
    const [groupKind, setGroupKind] = useState<CommunityGroupKind>('mixed');
    const [groupIsPublic, setGroupIsPublic] = useState(false);
    const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [groupMemberSelection, setGroupMemberSelection] = useState<string[]>([]);
    const [addingMembers, setAddingMembers] = useState(false);
    const [regeneratingInvite, setRegeneratingInvite] = useState(false);

    const role = profile?.role === 'coach' ? 'coach' : 'athlete';
    const creationConfig = useMemo(() => buildCommunityCreationConfig(role), [role]);
    const creationUnitLabel = role === 'coach' ? 'Group' : 'Circle';
    const landingEmptyState = useMemo(
        () => buildCommunityLandingEmptyState({
            hasGroups: myGroups.length > 0,
            supportMode: profile?.onboarding?.supportMode,
        }),
        [myGroups.length, profile?.onboarding?.supportMode]
    );

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
                failures.push(getFriendlyError('Could not load your circles', mineResult.reason));
            }

            const publicList = publicResult.status === 'fulfilled' ? publicResult.value : [];
            if (publicResult.status !== 'fulfilled') {
                failures.push(getFriendlyError('Could not load public circles', publicResult.reason));
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
            const message = getFriendlyError('Could not load circles', error);
            setGroupsError(message);
            toast.error(message, { id: 'community-groups-load' });
            console.warn('Failed to load circles:', error);
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
            setMessages([]);
            if (!isPermissionDenied(error)) {
                toast.error(getFriendlyError('Could not load messages', error), { id: 'community-messages-load' });
            }
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
            setGroupChallenges([]);
            setSelectedGroupChallengeId('');
            if (!isPermissionDenied(error)) {
                toast.error(getFriendlyError('Could not load group challenges', error), { id: 'community-challenges-load' });
            }
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
            setChallengeEntries([]);
            // Silently degrade on permission-denied — viewer simply isn't a member yet.
            if (!isPermissionDenied(error)) {
                toast.error(getFriendlyError('Could not load leaderboard', error), { id: 'community-challenge-entries-load' });
            }
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

    useEffect(() => {
        if (creationConfig.kindOptions.some((option) => option.value === groupKind)) return;
        setGroupKind(creationConfig.defaultKind);
    }, [creationConfig, groupKind]);

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
            toast.success('Members added to circle');
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

    const handleShareInviteCode = async () => {
        if (!selectedGroup?.inviteCode) {
            toast.error('No invite code yet');
            return;
        }

        const message = buildCommunityInviteShareMessage({
            groupName: selectedGroup.name,
            inviteCode: selectedGroup.inviteCode,
            ownerName: selectedGroup.ownerName,
        });
        const url = typeof window !== 'undefined' ? `${window.location.origin}/community` : undefined;

        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title: `${selectedGroup.name} on Kabunga Workout`,
                    text: message,
                    url,
                });
                toast.success('Invite ready to send');
                return;
            } catch (error) {
                if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
                    return;
                }
            }
        }

        const ok = await copyToClipboard(url ? `${message}\n\n${url}` : message);
        if (ok) toast.success('Invite copied to clipboard');
        else toast.error('Could not share invite');
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
            console.warn('Join circle failed:', error);
            toast.error(getFriendlyError('Could not join circle', error));
        }
    };

    const handleLeaveGroup = async (group: CommunityGroup) => {
        if (!user) return;
        if (!confirm(`Leave ${group.name} circle?`)) return;
        try {
            await leaveCommunityGroup(group.id, user.uid);
            toast.success(`Left ${group.name}`);
            await loadGroups();
            if (selectedGroupId === group.id) {
                setSelectedGroupId('');
                setMessages([]);
            }
        } catch (error) {
            console.warn('Leave circle failed:', error);
            toast.error(getFriendlyError('Could not leave circle', error));
        }
    };

    const handleCreateGroup = async () => {
        if (!user) return;
        if (groupName.trim().length < 3) {
            toast.error('Circle name should be at least 3 characters');
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
                ownerName: profile?.displayName || user.displayName || (role === 'coach' ? 'Coach' : 'Member'),
                isPublic: groupIsPublic,
                memberIds: selectedAthleteIds,
            });
            toast.success(group.inviteCode ? `Circle created. Invite: ${group.inviteCode}` : 'Circle created');
            setGroupName('');
            setGroupDescription('');
            setGroupKind(creationConfig.defaultKind);
            setGroupIsPublic(false);
            setSelectedAthleteIds([]);
            await loadGroups();
            setSelectedGroupId(group.id);
        } catch (error) {
            console.warn('Create circle failed:', error);
            toast.error(getFriendlyError('Could not create circle', error));
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
                profile?.displayName || user.displayName || 'Member',
                { existingJoinedAt: myChallengeEntry?.joinedAt }
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
            <div className="premium-card-high p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Kabunga Circle</p>
                        <h1 className="font-display text-3xl font-extrabold mt-1 text-text-primary">Circles & challenges</h1>
                        <p className="text-sm leading-6 text-text-secondary mt-2">
                            Bring your gym friends, coach group, or lifting crew into one lightweight accountability space.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <StatChip tone="secondary" label="Groups" value={myGroups.length} />
                            <StatChip tone="tertiary" label="Open reports" value={openReportCount} />
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center text-primary">
                        <MessagesSquare size={20} />
                    </div>
                </div>
            </div>

            <InsightCard
                tone="primary"
                title="Accountability without enterprise software"
                description="Use invite codes, coach groups, challenges, leaderboards, and moderation without turning the app into a heavy admin tool."
            />

            <div className="glass rounded-2xl p-4 space-y-2">
                <p className="text-sm font-semibold">Join a circle with code</p>
                <p className="text-xs text-text-secondary">
                    Got a private circle invite from your coach or crew? Paste the code and join directly.
                </p>
                <div className="flex items-center gap-2">
                    <input
                        id="community-invite-code"
                        type="text"
                        value={inviteCodeInput}
                        onChange={(event) => setInviteCodeInput(event.target.value.toUpperCase())}
                        placeholder="e.g. KBG9A7X2"
                        className="flex-1 bg-bg-input border border-border rounded-xl py-2.5 px-3 text-sm"
                    />
                    <ActionButton
                        onClick={() => void handleJoinByInviteCode()}
                        disabled={joiningByInviteCode}
                        size="sm"
                        isLoading={joiningByInviteCode}
                    >
                        Join
                    </ActionButton>
                </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Users size={16} className="text-accent" />
                        {landingEmptyState.title}
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
                    <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary space-y-3">
                        <p>{landingEmptyState.detail}</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => document.getElementById('community-create-group')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/8 px-3 py-2 text-xs font-semibold text-accent"
                            >
                                <Plus size={13} />
                                Create a circle
                            </button>
                            <button
                                type="button"
                                onClick={() => document.getElementById('community-invite-code')?.focus()}
                                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-primary"
                            >
                                Join with code
                            </button>
                        </div>
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
                        <p className="text-xs text-text-muted">Discover circles</p>
                        {discoverGroups.map((group) => (
                            <div key={group.id} className="rounded-xl border border-border bg-bg-card p-3 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold">{group.name}</p>
                                    <p className="text-xs text-text-secondary mt-1 line-clamp-1">{group.description || 'Open training circle'}</p>
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
                                {selectedGroup.isPublic ? 'Public circle' : 'Private circle'}
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
                                        onClick={() => void handleShareInviteCode()}
                                        disabled={!selectedGroup.inviteCode}
                                        className="inline-flex items-center gap-1 text-xs text-accent disabled:opacity-40"
                                    >
                                        <Share2 size={12} />
                                        Share
                                    </button>
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
                                Members can join private circles using this code. Regenerating disables the old code.
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
                                    Members sync their own workout history into a shared scoreboard. Tap Sync My Workouts inside a challenge to count your sessions.
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

                                {selectedGroupChallenge && (() => {
                                    const daysLeft = Math.max(0, dayjs(selectedGroupChallenge.endDate).diff(dayjs(), 'day'));
                                    const totalCompleted = challengeEntries.reduce((s, e) => s + e.completedWorkouts, 0);
                                    const totalTarget = challengeEntries.reduce((s, e) => s + e.targetCount, 0);
                                    const groupPct = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0;
                                    const estimatedMinutes = totalCompleted * 45;
                                    return (
                                    <>
                                        {/* Featured Challenge hero card */}
                                        <div className="rounded-3xl p-5 text-white" style={{ background: '#17452a' }}>
                                            <p className="text-[10px] font-bold tracking-widest uppercase opacity-70 mb-2">Featured Challenge</p>
                                            <h3 className="font-display text-xl font-extrabold leading-tight mb-1">{selectedGroupChallenge.title}</h3>
                                            <p className="text-sm opacity-80 leading-snug mb-1">
                                                {selectedGroupChallenge.description || 'Move daily. Build a stronger you — together.'}
                                            </p>
                                            <p className="text-[11px] opacity-60 mb-4">
                                                📅 {dayjs(selectedGroupChallenge.startDate).format('MMM D')} – {dayjs(selectedGroupChallenge.endDate).format('MMM D, YYYY')}
                                            </p>

                                            {/* Group progress */}
                                            <div className="mb-2 flex items-center justify-between text-xs">
                                                <span className="opacity-70">Together, we've got this! 🤜</span>
                                                <span className="font-bold">{groupPct}%</span>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-white/20 overflow-hidden mb-4">
                                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${groupPct}%`, background: '#9bd93c' }} />
                                            </div>

                                            {/* Stats row */}
                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                <div>
                                                    <p className="font-display text-lg font-extrabold">{challengeEntries.length}</p>
                                                    <p className="text-[10px] opacity-70">Participants</p>
                                                </div>
                                                <div>
                                                    <p className="font-display text-lg font-extrabold">{estimatedMinutes.toLocaleString()}</p>
                                                    <p className="text-[10px] opacity-70">Active Minutes</p>
                                                </div>
                                                <div>
                                                    <p className="font-display text-lg font-extrabold">{daysLeft}</p>
                                                    <p className="text-[10px] opacity-70">Days Left</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* My progress note */}
                                        {myChallengeEntry && myChallengeEntry.challengeId === selectedGroupChallenge.id && (
                                            <div className="rounded-2xl bg-primary-container px-4 py-3 text-sm text-primary font-medium">
                                                You are at {myChallengeEntry.completedWorkouts}/{myChallengeEntry.targetCount} workouts.
                                            </div>
                                        )}
                                        {!myChallengeEntry && isSelectedGroupMember && (
                                            <div className="rounded-2xl bg-bg-card px-4 py-3 text-[11px] text-text-muted">
                                                Your workouts are not on this board yet. Tap Sync My Workouts to pull them in.
                                            </div>
                                        )}

                                        {/* Top Movers leaderboard */}
                                        <div className="rounded-3xl bg-bg-card p-4">
                                            <p className="text-sm font-semibold text-text-primary mb-3">Top Movers 🏅</p>
                                            <div className="space-y-3">
                                                {loadingChallengeEntries ? (
                                                    <p className="text-xs text-text-muted">Loading leaderboard...</p>
                                                ) : challengeEntries.length === 0 ? (
                                                    <p className="text-xs text-text-secondary">No one has synced yet. Be the first!</p>
                                                ) : (
                                                    challengeEntries.slice(0, 8).map((entry, index) => {
                                                        const pct = Math.min(100, Math.round((entry.completedWorkouts / Math.max(1, entry.targetCount)) * 100));
                                                        const mine = entry.userId === user?.uid;
                                                        const initials = (entry.userName || 'U').slice(0, 2).toUpperCase();
                                                        const colors = ['#17452a', '#3468b7', '#9bd93c', '#d8871f', '#6b7280'];
                                                        const bgColor = mine ? '#9bd93c' : colors[index % colors.length];
                                                        return (
                                                            <div key={entry.id} className={`rounded-2xl p-3 ${mine ? 'border-2' : 'border border-border'} bg-bg-surface`}
                                                                style={mine ? { borderColor: '#9bd93c' } : undefined}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm font-bold text-text-muted w-5 shrink-0">{index + 1}</span>
                                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                                                        style={{ background: bgColor, color: mine ? '#17452a' : 'white' }}>
                                                                        {initials}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <p className="text-sm font-semibold truncate">{mine ? 'You' : entry.userName}</p>
                                                                            <p className="text-xs font-bold text-text-primary shrink-0">
                                                                                {entry.lastWorkoutAt ? `${dayjs(entry.lastWorkoutAt).diff(dayjs(selectedGroupChallenge.startDate), 'day')} days` : '—'}
                                                                            </p>
                                                                        </div>
                                                                        <div className="mt-1.5 h-1.5 rounded-full bg-bg-card overflow-hidden">
                                                                            <div className="h-full rounded-full transition-all duration-700"
                                                                                style={{ width: `${pct}%`, background: mine ? '#9bd93c' : '#17452a' }} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* Motivation + Send Cheer */}
                                        <div className="rounded-3xl bg-bg-card p-4 flex items-center justify-between gap-3">
                                            <p className="text-xs text-text-secondary leading-snug flex-1">
                                                We rise when we move together. Cheer, encourage, and keep each other going!
                                            </p>
                                            <button
                                                onClick={() => toast.success('Cheer sent! 🎉')}
                                                className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                                                style={{ background: '#17452a' }}
                                            >
                                                Send Cheer
                                            </button>
                                        </div>

                                        {/* Sync / Join CTA */}
                                        {isSelectedGroupMember ? (
                                            <button
                                                onClick={() => void handleSyncChallengeProgress()}
                                                disabled={syncingChallengeId === selectedGroupChallenge.id}
                                                className="w-full py-4 rounded-2xl text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                                                style={{ background: '#17452a' }}
                                            >
                                                {syncingChallengeId === selectedGroupChallenge.id ? 'Syncing Workouts...' : '→ Sync My Workouts'}
                                            </button>
                                        ) : (
                                            <p className="text-xs text-center text-text-secondary">
                                                Join this group to sync your workout count into the leaderboard.
                                            </p>
                                        )}
                                    </>
                                    );
                                })()}
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

            <div id="community-create-group" className="glass rounded-2xl p-4 space-y-3">
                <div>
                    <h3 className="text-sm font-semibold">{creationConfig.title}</h3>
                    <p className="text-xs text-text-muted mt-1">
                        {creationConfig.description}
                    </p>
                </div>

                <label className="text-xs text-text-secondary block">
                    {creationUnitLabel} Name
                    <input
                        type="text"
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value)}
                        placeholder={creationConfig.namePlaceholder}
                        className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                    />
                </label>

                <label className="text-xs text-text-secondary block">
                    Description
                    <textarea
                        value={groupDescription}
                        onChange={(event) => setGroupDescription(event.target.value)}
                        rows={2}
                        placeholder={creationConfig.descriptionPlaceholder}
                        className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                    />
                </label>

                <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-text-secondary block">
                        {creationUnitLabel} Type
                        <select
                            value={groupKind}
                            onChange={(event) => setGroupKind(event.target.value as CommunityGroupKind)}
                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                        >
                            {creationConfig.kindOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
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

                {role === 'coach' && coachAthletes.length > 0 && (
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
                    onClick={() => void handleCreateGroup()}
                    disabled={creatingGroup}
                    className="w-full py-3 rounded-xl gradient-primary text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <Plus size={14} />
                    {creatingGroup ? 'Creating...' : creationConfig.ctaLabel}
                </button>
            </div>
        </div>
    );
}
