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
    Users,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import {
    addMembersToCommunityGroup,
    createCommunityGroup,
    getCoachAthletes,
    getCommunityMessages,
    getMyCommunityGroups,
    getPublicCommunityGroups,
    joinCommunityGroupByInviteCode,
    joinCommunityGroup,
    leaveCommunityGroup,
    regenerateCommunityGroupInviteCode,
    saveCommunityMessage,
} from '../lib/firestoreService';
import type {
    CoachAthleteLink,
    CommunityGroup,
    CommunityGroupKind,
    CommunityMessage,
} from '../lib/types';
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
    const [messages, setMessages] = useState<CommunityMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [groupsError, setGroupsError] = useState('');
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [joiningByInviteCode, setJoiningByInviteCode] = useState(false);

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

    useEffect(() => {
        if (!user?.uid) return;
        void loadGroups();
    }, [user?.uid, role]);

    useEffect(() => {
        if (!selectedGroupId) return;
        void loadMessages(selectedGroupId);
    }, [selectedGroupId]);

    useEffect(() => {
        if (!selectedGroupId) return;
        const interval = window.setInterval(() => {
            void loadMessages(selectedGroupId);
        }, 9000);
        return () => window.clearInterval(interval);
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
                        {user && selectedGroup.ownerId !== user.uid && selectedGroup.memberIds.includes(user.uid) && (
                            <button
                                onClick={() => void handleLeaveGroup(selectedGroup)}
                                className="text-xs text-red"
                            >
                                Leave
                            </button>
                        )}
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
                                        <p className="text-[11px] text-text-muted">{message.userName}</p>
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
