import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
    Activity,
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Clipboard,
    Crown,
    Dumbbell,
    Link as LinkIcon,
    Pencil,
    Plus,
    Trash2,
    UserPlus,
    Users,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import {
    deleteCoachPlan,
    getAthleteCoachLink,
    getAthleteCoachPlans,
    getCoachAthletes,
    getCoachPlansByCoach,
    getCoachVisibleWorkouts,
    linkAthleteToCoach,
    saveCoachPlan,
    setUserRole,
    unlinkAthleteCoach,
    updateCoachPlan,
} from '../lib/firestoreService';
import { getAthleteReadiness, getWeeklyReadinessTrend } from '../lib/healthCheckService';
import type {
    CoachAthleteLink,
    CoachPlanExercise,
    CoachWorkoutPlan,
    ReadinessScore,
    ReadinessTrendPoint,
    UserRole,
    WorkoutSession,
} from '../lib/types';
import { copyToClipboard, formatDurationHuman, formatRelativeTime } from '../lib/utils';
import { CoachCard, SegmentedControl, StatChip } from '../components/ui';
import { ShareCodeChip, ReadinessBadge, ReadinessTrendStrip } from '../components/coach';

interface PlanExerciseDraft {
    name: string;
    sets: number;
    reps: number;
    weight: number;
    restSeconds: number;
    cue: string;
}

type PlanDisplayState = 'completed' | 'overdue' | 'today' | 'upcoming' | 'cancelled';

const createId = (): string => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const createExerciseDraft = (): PlanExerciseDraft => ({
    name: '',
    sets: 3,
    reps: 8,
    weight: 0,
    restSeconds: 90,
    cue: '',
});

const createExerciseDraftFromPlan = (exercise: CoachPlanExercise): PlanExerciseDraft => ({
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    restSeconds: exercise.restSeconds,
    cue: exercise.cue,
});

const getTodayKey = (): string => dayjs().format('YYYY-MM-DD');

const getWeekStartMonday = (date: dayjs.Dayjs): dayjs.Dayjs =>
    date.startOf('day').subtract((date.day() + 6) % 7, 'day');

const buildMonthDays = (month: dayjs.Dayjs): Array<dayjs.Dayjs | null> => {
    const firstDay = month.startOf('month');
    const offset = (firstDay.day() + 6) % 7; // Monday-first
    const totalDays = month.daysInMonth();
    const days: Array<dayjs.Dayjs | null> = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(month.date(d));
    return days;
};

const weekDays = [
    { label: 'Mon', day: 1, offset: 0 },
    { label: 'Tue', day: 2, offset: 1 },
    { label: 'Wed', day: 3, offset: 2 },
    { label: 'Thu', day: 4, offset: 3 },
    { label: 'Fri', day: 5, offset: 4 },
    { label: 'Sat', day: 6, offset: 5 },
    { label: 'Sun', day: 0, offset: 6 },
] as const;

const formatPlanExerciseLine = (exercise: CoachPlanExercise): string => {
    const load = exercise.weight > 0 ? `@ ${exercise.weight}kg` : 'bodyweight';
    return `${exercise.sets} x ${exercise.reps} ${load} • rest ${exercise.restSeconds}s`;
};

const getPlanDisplayState = (plan: CoachWorkoutPlan, todayKey: string): PlanDisplayState => {
    if (plan.status === 'completed') return 'completed';
    if (plan.status === 'cancelled') return 'cancelled';
    if (plan.status !== 'scheduled') return 'upcoming';
    if (plan.scheduledDate < todayKey) return 'overdue';
    if (plan.scheduledDate === todayKey) return 'today';
    return 'upcoming';
};

const getPlanStatusMeta = (plan: CoachWorkoutPlan, todayKey: string): { label: string; className: string } => {
    const state = getPlanDisplayState(plan, todayKey);
    if (state === 'completed') return { label: 'Completed', className: 'text-green' };
    if (state === 'cancelled') return { label: 'Cancelled', className: 'text-text-muted' };
    if (state === 'overdue') return { label: 'Incomplete (Missed)', className: 'text-red' };
    if (state === 'today') return { label: 'Due Today', className: 'text-amber' };
    return { label: 'Scheduled', className: 'text-text-muted' };
};

const getReadinessMeta = (status: ReadinessScore['status']): { pill: string; card: string; label: string } => {
    if (status === 'excellent') {
        return { pill: 'bg-green/15 text-green', card: 'border-green/20', label: 'Ready' };
    }
    if (status === 'good') {
        return { pill: 'bg-cyan/15 text-cyan', card: 'border-cyan/20', label: 'Solid' };
    }
    if (status === 'moderate') {
        return { pill: 'bg-amber/15 text-amber', card: 'border-amber/20', label: 'Watch' };
    }
    return { pill: 'bg-red/15 text-red', card: 'border-red/20', label: 'Recovery' };
};

export default function CoachHubPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuthStore();
    const { loadCoachPlan, activeSession } = useWorkoutStore();

    const role: UserRole = profile?.role === 'coach' ? 'coach' : 'athlete';

    const [switchingRole, setSwitchingRole] = useState(false);

    const [coachCodeInput, setCoachCodeInput] = useState('');
    const [athleteCoachLink, setAthleteCoachLink] = useState<CoachAthleteLink | null>(null);
    const [athletePlans, setAthletePlans] = useState<CoachWorkoutPlan[]>([]);
    const [loadingAthleteData, setLoadingAthleteData] = useState(false);
    const [athleteCalendarMonth, setAthleteCalendarMonth] = useState(dayjs().startOf('month'));
    const [athleteSelectedDate, setAthleteSelectedDate] = useState(getTodayKey());

    const [coachAthletes, setCoachAthletes] = useState<CoachAthleteLink[]>([]);
    const [selectedAthleteId, setSelectedAthleteId] = useState('');
    const [coachPlans, setCoachPlans] = useState<CoachWorkoutPlan[]>([]);
    const [athleteWorkouts, setAthleteWorkouts] = useState<WorkoutSession[]>([]);
    const [athleteReadiness, setAthleteReadiness] = useState<ReadinessScore | null>(null);
    const [athleteReadinessTrend, setAthleteReadinessTrend] = useState<ReadinessTrendPoint[]>([]);
    const [loadingCoachData, setLoadingCoachData] = useState(false);

    const [savingPlan, setSavingPlan] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [planDate, setPlanDate] = useState(getTodayKey());
    const [planTitle, setPlanTitle] = useState('');
    const [planNotes, setPlanNotes] = useState('');
    const [planExercises, setPlanExercises] = useState<PlanExerciseDraft[]>([createExerciseDraft()]);
    const [weekStartDate, setWeekStartDate] = useState(getWeekStartMonday(dayjs()).format('YYYY-MM-DD'));
    const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([1, 3, 5]);

    const todayKey = getTodayKey();

    const selectedAthlete = useMemo(() => (
        coachAthletes.find((athlete) => athlete.athleteId === selectedAthleteId) ?? null
    ), [coachAthletes, selectedAthleteId]);

    const todayPlans = useMemo(() => (
        athletePlans.filter((plan) => plan.scheduledDate === todayKey)
    ), [athletePlans, todayKey]);

    const athletePlansByDate = useMemo(() => {
        return athletePlans.reduce<Record<string, CoachWorkoutPlan[]>>((acc, plan) => {
            if (!acc[plan.scheduledDate]) acc[plan.scheduledDate] = [];
            acc[plan.scheduledDate].push(plan);
            return acc;
        }, {});
    }, [athletePlans]);

    const athleteMonthDays = useMemo(() => buildMonthDays(athleteCalendarMonth), [athleteCalendarMonth]);
    const selectedDayPlans = athletePlansByDate[athleteSelectedDate] || [];
    const athletePlanCounts = useMemo(() => {
        const completed = athletePlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'completed').length;
        const overdue = athletePlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'overdue').length;
        const dueToday = athletePlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'today').length;
        const upcoming = athletePlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'upcoming').length;
        return { completed, overdue, dueToday, upcoming };
    }, [athletePlans, todayKey]);

    const coachPlanCounts = useMemo(() => {
        const completed = coachPlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'completed').length;
        const overdue = coachPlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'overdue').length;
        const dueToday = coachPlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'today').length;
        const upcoming = coachPlans.filter((plan) => getPlanDisplayState(plan, todayKey) === 'upcoming').length;
        return { completed, overdue, dueToday, upcoming };
    }, [coachPlans, todayKey]);

    const editingPlan = useMemo(() => (
        editingPlanId ? coachPlans.find((plan) => plan.id === editingPlanId) ?? null : null
    ), [coachPlans, editingPlanId]);
    const athleteReadinessMeta = athleteReadiness ? getReadinessMeta(athleteReadiness.status) : null;

    const planCalendarDays = useMemo(() => {
        return Array.from({ length: 21 }, (_, index) => {
            const date = dayjs(todayKey).add(index, 'day');
            const key = date.format('YYYY-MM-DD');
            const plans = coachPlans.filter((plan) => plan.scheduledDate === key);
            return { date, key, plans };
        });
    }, [coachPlans, todayKey]);

    const loadAthleteView = async (uid: string) => {
        setLoadingAthleteData(true);
        try {
            const [link, plans] = await Promise.all([
                getAthleteCoachLink(uid),
                getAthleteCoachPlans(uid, 30),
            ]);
            setAthleteCoachLink(link);
            setAthletePlans(plans);
        } catch (error) {
            console.warn('Could not load athlete coach data:', error);
            toast.error('Failed to load coach plans');
        } finally {
            setLoadingAthleteData(false);
        }
    };

    const loadCoachOverview = async (uid: string) => {
        setLoadingCoachData(true);
        try {
            const athletes = await getCoachAthletes(uid);
            setCoachAthletes(athletes);
            if (athletes.length === 0) {
                setSelectedAthleteId('');
                setCoachPlans([]);
                setAthleteWorkouts([]);
                setAthleteReadiness(null);
                setAthleteReadinessTrend([]);
                return;
            }
            setSelectedAthleteId((current) => (
                current && athletes.some((athlete) => athlete.athleteId === current)
                    ? current
                    : athletes[0].athleteId
            ));
        } catch (error) {
            console.warn('Could not load coach athletes:', error);
            toast.error('Failed to load athletes');
        } finally {
            setLoadingCoachData(false);
        }
    };

    const loadCoachAthleteDetails = async (coachId: string, athleteId: string, silent = false) => {
        if (!athleteId) {
            setCoachPlans([]);
            setAthleteWorkouts([]);
            setAthleteReadiness(null);
            setAthleteReadinessTrend([]);
            return;
        }
        if (!silent) setLoadingCoachData(true);
        try {
            const [plans, workouts, readiness, readinessTrend] = await Promise.all([
                getCoachPlansByCoach(coachId, athleteId),
                getCoachVisibleWorkouts(coachId, athleteId, 30),
                getAthleteReadiness(athleteId, todayKey),
                getWeeklyReadinessTrend(athleteId, dayjs(todayKey).subtract(6, 'day').format('YYYY-MM-DD')),
            ]);
            setCoachPlans(plans);
            setAthleteWorkouts(workouts);
            setAthleteReadiness(readiness);
            setAthleteReadinessTrend(readinessTrend);
        } catch (error) {
            console.warn('Could not load athlete details:', error);
            toast.error('Failed to load athlete details');
        } finally {
            if (!silent) setLoadingCoachData(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        if (role === 'coach') {
            void loadCoachOverview(user.uid);
            return;
        }
        void loadAthleteView(user.uid);
    }, [user, role]);

    useEffect(() => {
        if (!user || role !== 'coach') return;
        if (!selectedAthleteId) {
            setCoachPlans([]);
            setAthleteWorkouts([]);
            setAthleteReadiness(null);
            setAthleteReadinessTrend([]);
            return;
        }
        void loadCoachAthleteDetails(user.uid, selectedAthleteId);
    }, [user, role, selectedAthleteId]);

    useEffect(() => {
        if (!user || role !== 'coach' || !selectedAthleteId) return;
        const interval = window.setInterval(() => {
            void loadCoachAthleteDetails(user.uid, selectedAthleteId, true);
        }, 12000);
        return () => window.clearInterval(interval);
    }, [user, role, selectedAthleteId]);

    useEffect(() => {
        setEditingPlanId(null);
        setPlanTitle('');
        setPlanNotes('');
        setPlanExercises([createExerciseDraft()]);
    }, [selectedAthleteId]);

    const applyRole = async (nextRole: UserRole) => {
        if (!user) return;
        if (nextRole === role) return;
        setSwitchingRole(true);
        try {
            const result = await setUserRole(user.uid, nextRole, {
                displayName: profile?.displayName || user.displayName || 'Coach',
                email: user.email || '',
                existingCoachCode: profile?.coachCode || null,
            });

            useAuthStore.setState((state) => {
                if (!state.profile) return {};
                return {
                    profile: {
                        ...state.profile,
                        role: result.role,
                        coachCode: result.coachCode,
                        updatedAt: Date.now(),
                    },
                };
            });

            toast.success(nextRole === 'coach' ? 'Coach mode enabled' : 'Athlete mode enabled');
        } catch (error) {
            console.warn('Role update failed:', error);
            toast.error(error instanceof Error ? `Could not switch role: ${error.message}` : 'Could not switch role');
        } finally {
            setSwitchingRole(false);
        }
    };

    const handleCopyCoachCode = async () => {
        if (!profile?.coachCode) return;
        const ok = await copyToClipboard(profile.coachCode);
        if (ok) toast.success('Coach code copied');
        else toast.error('Could not copy code');
    };

    const handleConnectCoach = async () => {
        if (!user) return;
        const code = coachCodeInput.trim();
        if (!code) {
            toast.error('Enter a coach code');
            return;
        }

        try {
            const link = await linkAthleteToCoach({
                athleteId: user.uid,
                athleteName: profile?.displayName || user.displayName || 'Athlete',
                athleteEmail: user.email || '',
                coachCode: code,
            });
            setAthleteCoachLink(link);
            setCoachCodeInput('');
            toast.success(`Connected to Coach ${link.coachName}`);
            const plans = await getAthleteCoachPlans(user.uid, 30);
            setAthletePlans(plans);
        } catch (error) {
            console.warn('Coach link failed:', error);
            toast.error(error instanceof Error ? error.message : 'Could not connect to coach');
        }
    };

    const handleDisconnectCoach = async () => {
        if (!user || !athleteCoachLink) return;
        if (!confirm('Disconnect from your current coach?')) return;

        try {
            await unlinkAthleteCoach(user.uid);
            setAthleteCoachLink(null);
            setAthletePlans([]);
            toast.success('Coach disconnected');
        } catch (error) {
            console.warn('Could not disconnect coach:', error);
            toast.error('Failed to disconnect coach');
        }
    };

    const handleLoadAthletePlan = (plan: CoachWorkoutPlan) => {
        if (!user) return;
        if (activeSession && !confirm('Replace your current planned workout with this coach plan?')) return;

        loadCoachPlan(user.uid, plan.id, plan.title, plan.notes, plan.exercises);
        toast.success('Coach plan loaded with sets/reps/weights and notes.');
        navigate('/workout');
    };

    const handleExerciseChange = (
        index: number,
        key: keyof PlanExerciseDraft,
        value: string | number
    ) => {
        setPlanExercises((current) => current.map((item, itemIndex) => {
            if (itemIndex !== index) return item;
            return {
                ...item,
                [key]: value,
            };
        }));
    };

    const handleAddExercise = () => {
        setPlanExercises((current) => [...current, createExerciseDraft()]);
    };

    const handleRemoveExercise = (index: number) => {
        setPlanExercises((current) => (
            current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current
        ));
    };

    const buildNormalizedExercises = (): CoachPlanExercise[] => {
        return planExercises
            .map((exercise) => ({
                name: exercise.name.trim(),
                sets: Math.max(1, Number(exercise.sets) || 1),
                reps: Math.max(0, Number(exercise.reps) || 0),
                weight: Math.max(0, Number(exercise.weight) || 0),
                restSeconds: Math.max(0, Number(exercise.restSeconds) || 0),
                cue: exercise.cue.trim(),
            }))
            .filter((exercise) => exercise.name.length > 0);
    };

    const toggleWeekDay = (day: number) => {
        setSelectedWeekDays((current) => (
            current.includes(day)
                ? current.filter((value) => value !== day)
                : [...current, day].sort((a, b) => weekDays.findIndex((d) => d.day === a) - weekDays.findIndex((d) => d.day === b))
        ));
    };

    const resetPlanComposer = () => {
        setEditingPlanId(null);
        setPlanTitle('');
        setPlanNotes('');
        setPlanExercises([createExerciseDraft()]);
    };

    const handleEditPlan = (plan: CoachWorkoutPlan) => {
        if (plan.status === 'completed') {
            toast.error('Completed plans cannot be edited');
            return;
        }
        setEditingPlanId(plan.id);
        setPlanDate(plan.scheduledDate);
        setPlanTitle(plan.title);
        setPlanNotes(plan.notes || '');
        setPlanExercises(
            plan.exercises.length > 0
                ? plan.exercises.map((exercise) => createExerciseDraftFromPlan(exercise))
                : [createExerciseDraft()]
        );
        toast.success('Plan loaded for editing');
    };

    const handleCancelEdit = () => {
        resetPlanComposer();
    };

    const handleSavePlan = async () => {
        if (!user || !selectedAthlete) return;

        const normalizedExercises = buildNormalizedExercises();

        if (normalizedExercises.length === 0) {
            toast.error('Add at least one exercise name');
            return;
        }

        const normalizedTitle = planTitle.trim() || `${selectedAthlete.athleteName} Session`;
        const normalizedNotes = planNotes.trim();

        setSavingPlan(true);
        try {
            if (editingPlanId) {
                const existing = coachPlans.find((plan) => plan.id === editingPlanId);
                if (!existing) {
                    toast.error('Plan no longer exists. Refresh and try again.');
                    setEditingPlanId(null);
                    return;
                }
                if (existing.status === 'completed') {
                    toast.error('Completed plans cannot be edited');
                    return;
                }

                await updateCoachPlan(existing.id, {
                    title: normalizedTitle,
                    scheduledDate: planDate,
                    notes: normalizedNotes,
                    exercises: normalizedExercises,
                    status: existing.status === 'cancelled' ? 'scheduled' : existing.status,
                });
                toast.success('Plan updated');
            } else {
                const now = Date.now();
                const payload: CoachWorkoutPlan = {
                    id: createId(),
                    coachId: user.uid,
                    coachName: profile?.displayName || user.displayName || 'Coach',
                    athleteId: selectedAthlete.athleteId,
                    athleteName: selectedAthlete.athleteName,
                    title: normalizedTitle,
                    scheduledDate: planDate,
                    notes: normalizedNotes,
                    exercises: normalizedExercises,
                    status: 'scheduled',
                    createdAt: now,
                    updatedAt: now,
                };

                await saveCoachPlan(payload);
                toast.success('Plan assigned');
            }

            resetPlanComposer();
            await loadCoachAthleteDetails(user.uid, selectedAthlete.athleteId);
        } catch (error) {
            console.warn('Could not save/update plan:', error);
            toast.error(editingPlanId ? 'Failed to update plan' : 'Failed to assign plan');
        } finally {
            setSavingPlan(false);
        }
    };

    const handleAssignWeekPlans = async () => {
        if (!user || !selectedAthlete) return;
        if (editingPlanId) {
            toast.error('Finish editing or cancel edit before assigning week plans');
            return;
        }
        if (selectedWeekDays.length === 0) {
            toast.error('Select at least one weekday');
            return;
        }

        const normalizedExercises = buildNormalizedExercises();
        if (normalizedExercises.length === 0) {
            toast.error('Add at least one exercise before assigning week plans');
            return;
        }

        const monday = getWeekStartMonday(dayjs(weekStartDate));
        if (!monday.isValid()) {
            toast.error('Choose a valid week start date');
            return;
        }

        const baseTitle = planTitle.trim() || `${selectedAthlete.athleteName} Session`;
        const notes = planNotes.trim();
        const now = Date.now();
        const payloads: CoachWorkoutPlan[] = selectedWeekDays.map((day) => {
            const weekDay = weekDays.find((item) => item.day === day)!;
            const scheduledDate = monday.add(weekDay.offset, 'day').format('YYYY-MM-DD');
            return {
                id: createId(),
                coachId: user.uid,
                coachName: profile?.displayName || user.displayName || 'Coach',
                athleteId: selectedAthlete.athleteId,
                athleteName: selectedAthlete.athleteName,
                title: `${baseTitle} (${weekDay.label})`,
                scheduledDate,
                notes,
                exercises: normalizedExercises,
                status: 'scheduled',
                createdAt: now,
                updatedAt: now,
            };
        });

        setSavingPlan(true);
        try {
            await Promise.all(payloads.map((payload) => saveCoachPlan(payload)));
            toast.success(`Assigned ${payloads.length} sessions for the week`);
            await loadCoachAthleteDetails(user.uid, selectedAthlete.athleteId);
        } catch (error) {
            console.warn('Could not assign week plans:', error);
            toast.error('Failed to assign week plans');
        } finally {
            setSavingPlan(false);
        }
    };

    const handleDeletePlan = async (plan: CoachWorkoutPlan) => {
        if (!confirm(`Delete plan "${plan.title}"?`)) return;

        try {
            await deleteCoachPlan(plan.id);
            toast.success('Plan deleted');
            if (user && selectedAthlete) {
                await loadCoachAthleteDetails(user.uid, selectedAthlete.athleteId);
            }
        } catch (error) {
            console.warn('Could not delete plan:', error);
            toast.error('Failed to delete plan');
        }
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
            <div className="premium-card-high p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-tertiary">Coach Hub</p>
                        <h1 className="font-display text-3xl font-extrabold mt-1 text-text-primary">Remote coaching</h1>
                        <p className="text-sm leading-6 text-text-secondary mt-2">
                            {role === 'coach'
                                ? 'Assign plans and monitor athlete progress without exposing private body metrics or raw pain notes.'
                                : 'Connect with a coach, receive daily plans, and keep sensitive readiness details private.'}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-tertiary-container flex items-center justify-center text-tertiary">
                        {role === 'coach' ? <Crown size={20} /> : <Users size={20} />}
                    </div>
                </div>

                <SegmentedControl
                    className="mt-4"
                    ariaLabel="Coach hub role"
                    value={role}
                    onChange={(value) => { void applyRole(value); }}
                    options={[
                        { value: 'athlete', label: 'Athlete', icon: <Users size={16} /> },
                        { value: 'coach', label: 'Coach', icon: <Crown size={16} /> },
                    ]}
                />
                {switchingRole && <p className="mt-2 text-xs font-semibold text-text-muted">Updating role...</p>}
            </div>

            <CoachCard
                title="Coach-safe privacy"
                description="Kabunga shares plan progress, workout completion, and readiness summaries. Private body metrics and raw pain notes stay out of coach views."
                badge={role === 'coach' ? 'Coach view' : 'Athlete control'}
                privacyNote="Summaries help coaching decisions without turning health notes into surveillance."
            />

            {role === 'athlete' ? (
                <>
                    <div className="glass rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <LinkIcon size={16} className="text-accent" />
                            Coach Connection
                        </div>

                        {athleteCoachLink ? (
                            <div className="rounded-xl bg-bg-card p-3 space-y-2">
                                <p className="text-sm font-semibold">Connected to {athleteCoachLink.coachName}</p>
                                <p className="text-xs text-text-secondary">{athleteCoachLink.coachEmail}</p>
                                <p className="text-xs text-text-muted">Code: {athleteCoachLink.coachCode}</p>
                                <button
                                    onClick={() => void handleDisconnectCoach()}
                                    className="mt-1 text-xs text-red"
                                >
                                    Disconnect coach
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-text-secondary">
                                    Ask your coach for their code, then connect once.
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={coachCodeInput}
                                        onChange={(e) => setCoachCodeInput(e.target.value.toUpperCase())}
                                        placeholder="Enter coach code"
                                        className="flex-1 bg-bg-input border border-border rounded-xl py-2.5 px-3 text-sm"
                                    />
                                    <button
                                        onClick={() => void handleConnectCoach()}
                                        className="px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold"
                                    >
                                        <UserPlus size={14} className="inline mr-1" />
                                        Connect
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="glass rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Calendar size={16} className="text-accent" />
                                Assigned Plans
                            </h3>
                            <span className="text-xs text-text-muted">Today: {todayPlans.length}</span>
                        </div>

                        {loadingAthleteData ? (
                            <p className="text-xs text-text-muted">Loading plans...</p>
                        ) : athletePlans.length === 0 ? (
                            <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                                No coach plans scheduled yet.
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Completed</p>
                                        <p className="text-sm font-semibold text-green">{athletePlanCounts.completed}</p>
                                    </div>
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Incomplete</p>
                                        <p className="text-sm font-semibold text-red">{athletePlanCounts.overdue}</p>
                                    </div>
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Due Today</p>
                                        <p className="text-sm font-semibold text-amber">{athletePlanCounts.dueToday}</p>
                                    </div>
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Upcoming</p>
                                        <p className="text-sm font-semibold text-cyan">{athletePlanCounts.upcoming}</p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-border bg-bg-card p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <button
                                            onClick={() => setAthleteCalendarMonth((current) => current.subtract(1, 'month'))}
                                            className="w-8 h-8 rounded-lg bg-bg-surface border border-border flex items-center justify-center"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <p className="text-xs font-semibold">{athleteCalendarMonth.format('MMMM YYYY')}</p>
                                        <button
                                            onClick={() => setAthleteCalendarMonth((current) => current.add(1, 'month'))}
                                            className="w-8 h-8 rounded-lg bg-bg-surface border border-border flex items-center justify-center"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-[10px] text-text-muted mb-1">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                            <p key={day} className="text-center">{day}</p>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {athleteMonthDays.map((date, index) => {
                                            if (!date) return <div key={`empty-${index}`} className="aspect-square" />;
                                            const key = date.format('YYYY-MM-DD');
                                            const isSelected = key === athleteSelectedDate;
                                            const isToday = key === todayKey;
                                            const plans = athletePlansByDate[key] || [];
                                            const hasOverdue = plans.some((plan) => getPlanDisplayState(plan, todayKey) === 'overdue');
                                            const hasToday = plans.some((plan) => getPlanDisplayState(plan, todayKey) === 'today');
                                            const hasCompleted = plans.some((plan) => getPlanDisplayState(plan, todayKey) === 'completed');
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setAthleteSelectedDate(key)}
                                                    className={`aspect-square rounded-lg border relative text-xs ${isSelected ? 'border-accent bg-accent/10' : isToday ? 'border-amber/60 bg-bg-surface' : 'border-border bg-bg-surface'}`}
                                                >
                                                    <span>{date.date()}</span>
                                                    {plans.length > 0 && (
                                                        <span
                                                            className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-1.5 h-1.5 rounded-full ${hasOverdue
                                                                ? 'bg-red'
                                                                : hasToday
                                                                    ? 'bg-amber'
                                                                    : hasCompleted
                                                                        ? 'bg-green'
                                                                        : 'bg-cyan'
                                                                }`}
                                                        />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-text-muted mt-2">
                                        Select any day to review assigned sessions and prepare in advance.
                                    </p>
                                </div>

                                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                    <p className="text-xs text-text-muted">
                                        {dayjs(athleteSelectedDate).format('ddd, MMM D')} • {selectedDayPlans.length} plan{selectedDayPlans.length === 1 ? '' : 's'}
                                    </p>
                                    {selectedDayPlans.length === 0 ? (
                                        <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                                            No plans for this day.
                                        </div>
                                    ) : (
                                        selectedDayPlans.map((plan) => {
                                            const statusMeta = getPlanStatusMeta(plan, todayKey);
                                            const displayState = getPlanDisplayState(plan, todayKey);
                                            const isLocked = displayState === 'completed' || displayState === 'cancelled';
                                            const buttonLabel = displayState === 'completed'
                                                ? 'Completed'
                                                : displayState === 'cancelled'
                                                    ? 'Cancelled'
                                                    : 'Load In Workout Planner';
                                            return (
                                                <div key={plan.id} className="rounded-xl border border-border bg-bg-card p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-sm font-semibold">{plan.title}</p>
                                                        <span className="text-[11px] text-text-muted">{dayjs(plan.scheduledDate).format('ddd, MMM D')}</span>
                                                    </div>
                                                    <p className="text-xs text-text-secondary mt-1">{plan.exercises.length} exercises</p>
                                                    <p className={`text-[11px] mt-1 font-medium ${statusMeta.className}`}>{statusMeta.label}</p>
                                                    {plan.athleteInSession && (
                                                        <p className="text-[11px] text-green mt-1">
                                                            In progress now{plan.progressCurrentExercise ? ` • ${plan.progressCurrentExercise}` : ''}
                                                        </p>
                                                    )}
                                                    {plan.notes && (
                                                        <div className="mt-2 rounded-lg border border-accent/20 bg-accent/10 p-2">
                                                            <p className="text-[10px] uppercase tracking-wide text-accent mb-1">Coach Notes</p>
                                                            <p className="text-xs text-text-secondary whitespace-pre-wrap">{plan.notes}</p>
                                                        </div>
                                                    )}
                                                    <div className="mt-2 space-y-1">
                                                        {plan.exercises.slice(0, 3).map((exercise, index) => (
                                                            <p key={`${plan.id}-ex-${index}`} className="text-xs text-text-secondary">
                                                                <span className="font-medium text-text-primary">{exercise.name}:</span> {formatPlanExerciseLine(exercise)}
                                                            </p>
                                                        ))}
                                                        {plan.exercises.length > 3 && (
                                                            <p className="text-xs text-text-muted">+{plan.exercises.length - 3} more exercises</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleLoadAthletePlan(plan)}
                                                        disabled={isLocked}
                                                        className="mt-2 w-full py-2 rounded-lg border border-accent/40 text-accent text-xs font-semibold disabled:opacity-40"
                                                    >
                                                        {buttonLabel}
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <ShareCodeChip
                        code={profile?.coachCode}
                        label="Your coach code"
                        helper="Share this code with athletes so they can connect to you."
                    />

                    <div className="glass rounded-2xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Users size={16} className="text-accent" />
                            Athletes
                        </h3>

                        {coachAthletes.length === 0 ? (
                            <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                                No athletes connected yet.
                            </div>
                        ) : (
                            <select
                                value={selectedAthleteId}
                                onChange={(e) => setSelectedAthleteId(e.target.value)}
                                className="w-full bg-bg-input border border-border rounded-xl py-2.5 px-3 text-sm"
                            >
                                {coachAthletes.map((athlete) => (
                                    <option key={athlete.athleteId} value={athlete.athleteId}>
                                        {athlete.athleteName} ({athlete.athleteEmail})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {selectedAthlete && (
                        <>
                            <div className={`glass rounded-2xl p-4 space-y-3 ${athleteReadinessMeta ? `border ${athleteReadinessMeta.card}` : ''}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            <Activity size={16} className="text-accent" />
                                            Athlete Readiness
                                        </h3>
                                        <p className="text-xs text-text-muted mt-1">
                                            Coach-safe recovery summary for {selectedAthlete.athleteName}.
                                        </p>
                                    </div>
                                    {athleteReadiness && (
                                        <ReadinessBadge status={athleteReadiness.status} score={athleteReadiness.score} />
                                    )}
                                </div>

                                {athleteReadiness ? (
                                    <>
                                        <div className="rounded-xl bg-bg-card p-3">
                                            <p className="text-xs text-text-muted">Today</p>
                                            <p className="text-sm text-text-secondary mt-1">
                                                {athleteReadiness.warnings.length > 0
                                                    ? athleteReadiness.warnings.join(' • ')
                                                    : 'No recovery flags reported today.'}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {athleteReadiness.recommendations.slice(0, 2).map((recommendation) => (
                                                    <span
                                                        key={recommendation}
                                                        className="rounded-full border border-border bg-bg-surface px-3 py-1 text-[11px] text-text-secondary"
                                                    >
                                                        {recommendation}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <ReadinessTrendStrip points={athleteReadinessTrend} helper="Missing days stay blank" />
                                    </>
                                ) : (
                                    <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                                        No health check submitted for today yet.
                                    </div>
                                )}
                            </div>

                            <div className="glass rounded-2xl p-4 space-y-3">
                                <div>
                                    <h3 className="text-sm font-semibold">
                                        {editingPlan ? 'Edit Workout Plan' : 'Assign Workout Plan'}
                                    </h3>
                                    <p className="text-xs text-text-muted mt-1">
                                        {editingPlan
                                            ? 'Update targets, notes, and date, then save changes.'
                                            : 'Enter each exercise with clear target sets, reps, weight, and rest.'}
                                    </p>
                                </div>
                                {editingPlan && (
                                    <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
                                        <p className="text-xs text-accent">
                                            Editing: <span className="font-semibold">{editingPlan.title}</span>
                                        </p>
                                        <p className="text-[11px] text-text-secondary mt-1">
                                            Scheduled for {dayjs(editingPlan.scheduledDate).format('ddd, MMM D')}
                                        </p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="text-xs text-text-secondary">
                                        Date
                                        <input
                                            type="date"
                                            value={planDate}
                                            onChange={(e) => setPlanDate(e.target.value)}
                                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                        />
                                    </label>
                                    <label className="text-xs text-text-secondary">
                                        Title
                                        <input
                                            type="text"
                                            value={planTitle}
                                            onChange={(e) => setPlanTitle(e.target.value)}
                                            placeholder="Leg Day A"
                                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                        />
                                    </label>
                                </div>

                                <div className="rounded-xl border border-border bg-bg-card p-3">
                                    <p className="text-xs font-semibold text-text-secondary mb-2">Planning Calendar (next 21 days)</p>
                                    <div className="grid grid-cols-7 gap-1">
                                        {planCalendarDays.map(({ date, key, plans }) => {
                                            const isSelected = planDate === key;
                                            const hasOverdue = plans.some((plan) => getPlanDisplayState(plan, todayKey) === 'overdue');
                                            const hasToday = plans.some((plan) => getPlanDisplayState(plan, todayKey) === 'today');
                                            const hasCompleted = plans.some((plan) => getPlanDisplayState(plan, todayKey) === 'completed');
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setPlanDate(key)}
                                                    className={`rounded-lg border px-1 py-1.5 text-center ${isSelected ? 'border-accent bg-accent/10' : 'border-border bg-bg-surface'}`}
                                                    title={date.format('ddd, MMM D')}
                                                >
                                                    <p className="text-[10px] text-text-muted">{date.format('dd')}</p>
                                                    <p className="text-xs font-semibold">{date.format('D')}</p>
                                                    <p
                                                        className={`mt-1 mx-auto w-1.5 h-1.5 rounded-full ${hasOverdue
                                                            ? 'bg-red'
                                                            : hasToday
                                                                ? 'bg-amber'
                                                                : hasCompleted
                                                                    ? 'bg-green'
                                                                    : plans.length > 0
                                                                        ? 'bg-cyan'
                                                                        : 'bg-bg-input'
                                                            }`}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-text-muted mt-2">
                                        Dot colors: red missed, amber due today, green completed, cyan upcoming.
                                    </p>
                                </div>

                                <label className="text-xs text-text-secondary block">
                                    Coach Notes
                                    <textarea
                                        value={planNotes}
                                        onChange={(e) => setPlanNotes(e.target.value)}
                                        rows={2}
                                        placeholder="Focus on depth and keep 2 reps in reserve on first sets."
                                        className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3"
                                    />
                                </label>

                                {editingPlan ? (
                                    <div className="rounded-xl border border-border bg-bg-card p-3">
                                        <p className="text-xs text-text-secondary">
                                            Week planner is disabled while editing an existing plan. Save or cancel edit to assign a full week.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border bg-bg-card p-3 space-y-2">
                                        <p className="text-xs font-semibold text-text-secondary">Week Planner</p>
                                        <label className="text-[11px] text-text-secondary block">
                                            Week Start (Monday)
                                            <input
                                                type="date"
                                                value={weekStartDate}
                                                onChange={(e) => setWeekStartDate(e.target.value)}
                                                className="mt-1 w-full bg-bg-input border border-border rounded-lg py-2 px-3 text-xs"
                                            />
                                        </label>
                                        <div className="grid grid-cols-7 gap-1">
                                            {weekDays.map((item) => {
                                                const active = selectedWeekDays.includes(item.day);
                                                return (
                                                    <button
                                                        key={item.label}
                                                        onClick={() => toggleWeekDay(item.day)}
                                                        className={`py-1.5 rounded-lg text-[11px] border ${active
                                                            ? 'bg-accent/15 border-accent text-accent'
                                                            : 'bg-bg-surface border-border text-text-muted'
                                                            }`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => void handleAssignWeekPlans()}
                                            disabled={savingPlan}
                                            className="w-full py-2 rounded-lg border border-cyan/40 text-cyan text-xs font-semibold disabled:opacity-50"
                                        >
                                            Assign Selected Week Days
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {planExercises.map((exercise, index) => (
                                        <div key={`draft-${index}`} className="rounded-xl border border-border bg-bg-card p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div>
                                                    <p className="text-xs font-semibold text-text-muted">Exercise {index + 1}</p>
                                                    <p className="text-[11px] text-text-secondary mt-0.5">
                                                        {exercise.name.trim()
                                                            ? `${exercise.sets} x ${exercise.reps} ${exercise.weight > 0 ? `@ ${exercise.weight}kg` : 'bodyweight'} • rest ${exercise.restSeconds}s`
                                                            : 'Set targets below'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveExercise(index)}
                                                    className="text-red disabled:opacity-40"
                                                    disabled={planExercises.length === 1}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <label className="block text-[11px] text-text-secondary">
                                                Exercise Name
                                                <input
                                                    type="text"
                                                    value={exercise.name}
                                                    onChange={(e) => handleExerciseChange(index, 'name', e.target.value)}
                                                    placeholder="e.g. Back Squat"
                                                    className="mt-1 w-full bg-bg-input border border-border rounded-lg py-2 px-3 text-xs"
                                                />
                                            </label>

                                            <div className="grid grid-cols-2 gap-2">
                                                <label className="text-[11px] text-text-secondary">
                                                    Sets
                                                    <input
                                                        type="number"
                                                        value={exercise.sets}
                                                        min={1}
                                                        onChange={(e) => handleExerciseChange(index, 'sets', Number(e.target.value))}
                                                        className="mt-1 w-full bg-bg-input border border-border rounded-lg py-2 px-3 text-xs"
                                                    />
                                                </label>
                                                <label className="text-[11px] text-text-secondary">
                                                    Reps (per set)
                                                    <input
                                                        type="number"
                                                        value={exercise.reps}
                                                        min={0}
                                                        onChange={(e) => handleExerciseChange(index, 'reps', Number(e.target.value))}
                                                        className="mt-1 w-full bg-bg-input border border-border rounded-lg py-2 px-3 text-xs"
                                                    />
                                                </label>
                                                <label className="text-[11px] text-text-secondary">
                                                    Weight (kg) - 0 for bodyweight
                                                    <input
                                                        type="number"
                                                        value={exercise.weight}
                                                        min={0}
                                                        onChange={(e) => handleExerciseChange(index, 'weight', Number(e.target.value))}
                                                        className="mt-1 w-full bg-bg-input border border-border rounded-lg py-2 px-3 text-xs"
                                                    />
                                                </label>
                                                <label className="text-[11px] text-text-secondary">
                                                    Rest (seconds)
                                                    <input
                                                        type="number"
                                                        value={exercise.restSeconds}
                                                        min={0}
                                                        onChange={(e) => handleExerciseChange(index, 'restSeconds', Number(e.target.value))}
                                                        className="mt-1 w-full bg-bg-input border border-border rounded-lg py-2 px-3 text-xs"
                                                    />
                                                </label>
                                            </div>

                                            <label className="block text-[11px] text-text-secondary">
                                                Cue (optional)
                                                <input
                                                    type="text"
                                                    value={exercise.cue}
                                                    onChange={(e) => handleExerciseChange(index, 'cue', e.target.value)}
                                                    placeholder="e.g. Brace hard, control the eccentric"
                                                    className="mt-1 w-full bg-bg-input border border-border rounded-lg py-2 px-3 text-xs"
                                                />
                                            </label>

                                            {exercise.name.trim() && (
                                                <div className="rounded-lg border border-border/70 bg-bg-surface p-2">
                                                    <p className="text-[11px] text-text-secondary">
                                                        <span className="font-semibold text-text-primary">{exercise.name}</span>: {exercise.sets} sets × {exercise.reps} reps {exercise.weight > 0 ? `@ ${exercise.weight}kg` : '(bodyweight)'} • rest {exercise.restSeconds}s
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleAddExercise}
                                    className="w-full py-2 rounded-xl border border-border text-xs text-text-secondary flex items-center justify-center gap-1"
                                >
                                    <Plus size={14} />
                                    Add Exercise
                                </button>

                                {editingPlan && (
                                    <button
                                        onClick={handleCancelEdit}
                                        disabled={savingPlan}
                                        className="w-full py-2 rounded-xl border border-border text-xs text-text-secondary disabled:opacity-50"
                                    >
                                        Cancel Edit
                                    </button>
                                )}

                                <button
                                    onClick={() => void handleSavePlan()}
                                    disabled={savingPlan}
                                    className="w-full py-3 rounded-xl gradient-primary text-white font-semibold disabled:opacity-50"
                                >
                                    {savingPlan
                                        ? (editingPlan ? 'Updating...' : 'Saving...')
                                        : (editingPlan ? 'Update Plan' : `Assign Plan to ${selectedAthlete.athleteName}`)}
                                </button>
                            </div>

                            <div className="glass rounded-2xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold">Planned Sessions</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Completed</p>
                                        <p className="text-sm font-semibold text-green">{coachPlanCounts.completed}</p>
                                    </div>
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Incomplete</p>
                                        <p className="text-sm font-semibold text-red">{coachPlanCounts.overdue}</p>
                                    </div>
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Due Today</p>
                                        <p className="text-sm font-semibold text-amber">{coachPlanCounts.dueToday}</p>
                                    </div>
                                    <div className="rounded-lg bg-bg-card p-2 text-center">
                                        <p className="text-[10px] text-text-muted">Upcoming</p>
                                        <p className="text-sm font-semibold text-cyan">{coachPlanCounts.upcoming}</p>
                                    </div>
                                </div>
                                {loadingCoachData ? (
                                    <p className="text-xs text-text-muted">Loading sessions...</p>
                                ) : coachPlans.length === 0 ? (
                                    <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                                        No plans yet for this athlete.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                        {coachPlans.map((plan) => (
                                            <div
                                                key={plan.id}
                                                className={`rounded-xl border bg-bg-card p-3 ${editingPlanId === plan.id ? 'border-accent/50 bg-accent/5' : 'border-border'}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold">{plan.title}</p>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleEditPlan(plan)}
                                                            disabled={plan.status === 'completed'}
                                                            className="text-text-secondary disabled:opacity-30"
                                                            title={plan.status === 'completed' ? 'Completed plans cannot be edited' : 'Edit plan'}
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => void handleDeletePlan(plan)}
                                                            className="text-red"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-text-secondary mt-1">
                                                    {dayjs(plan.scheduledDate).format('ddd, MMM D')} • {plan.exercises.length} exercises
                                                </p>
                                                {(() => {
                                                    const statusMeta = getPlanStatusMeta(plan, todayKey);
                                                    return (
                                                        <p className={`text-xs mt-1 font-medium ${statusMeta.className}`}>
                                                            {statusMeta.label}
                                                            {plan.status === 'completed' && plan.completedAt
                                                                ? ` • ${formatRelativeTime(plan.completedAt)}`
                                                                : ''}
                                                        </p>
                                                    );
                                                })()}
                                                {plan.athleteInSession && (
                                                    <div className="mt-2 rounded-lg border border-green/30 bg-green/10 p-2">
                                                        <p className="text-[11px] text-green flex items-center gap-1">
                                                            <Activity size={12} />
                                                            Athlete is training
                                                            {plan.progressCurrentExercise ? ` • ${plan.progressCurrentExercise}` : ''}
                                                        </p>
                                                    </div>
                                                )}
                                                {typeof plan.progressTotalSets === 'number' && plan.progressTotalSets > 0 && (
                                                    <div className="mt-2">
                                                        <div className="w-full h-1.5 rounded-full bg-bg-input overflow-hidden">
                                                            <div
                                                                className="h-full bg-accent rounded-full"
                                                                style={{
                                                                    width: `${Math.min(
                                                                        100,
                                                                        Math.round(((plan.progressCompletedSets || 0) / plan.progressTotalSets) * 100)
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <p className="text-[11px] text-text-muted mt-1">
                                                            Progress: {plan.progressCompletedSets || 0}/{plan.progressTotalSets} sets
                                                        </p>
                                                    </div>
                                                )}
                                                {plan.notes && (
                                                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                                                        Coach notes: {plan.notes}
                                                    </p>
                                                )}
                                                {plan.exercises[0] && (
                                                    <p className="text-xs text-text-muted mt-1 line-clamp-1">
                                                        First exercise: {plan.exercises[0].name} ({formatPlanExerciseLine(plan.exercises[0])})
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="glass rounded-2xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold">Recent Athlete Workouts</h3>
                                {loadingCoachData ? (
                                    <p className="text-xs text-text-muted">Loading workouts...</p>
                                ) : athleteWorkouts.length === 0 ? (
                                    <div className="rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                                        No completed workouts available yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                        {athleteWorkouts.map((workout) => (
                                            <div key={workout.id} className="rounded-xl border border-border bg-bg-card p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold">
                                                        {dayjs(workout.startedAt).format('ddd, MMM D • h:mm A')}
                                                    </p>
                                                    <span className="text-xs text-text-muted">
                                                        {formatDurationHuman(workout.duration)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-text-secondary mt-1">
                                                    {workout.exercises.length} exercises • {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} sets
                                                </p>
                                                <p className="text-xs text-text-muted mt-1 line-clamp-1">
                                                    {workout.exercises.slice(0, 4).map((exercise) => exercise.name).join(', ') || 'No exercises'}
                                                </p>
                                                {workout.notes?.trim() && (
                                                    <p className="text-xs text-text-muted mt-1 line-clamp-2">{workout.notes}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            <button
                onClick={() => navigate('/history')}
                className="w-full py-3 rounded-xl border border-border text-sm text-text-secondary flex items-center justify-center gap-2"
            >
                <Dumbbell size={16} />
                Open Workout History
            </button>

            {role === 'coach' && loadingCoachData && (
                <p className="text-xs text-text-muted text-center">Refreshing coach data...</p>
            )}
            {role === 'athlete' && loadingAthleteData && (
                <p className="text-xs text-text-muted text-center">Refreshing athlete data...</p>
            )}

            {role === 'athlete' && athleteCoachLink && todayPlans.length > 0 && (
                <div className="rounded-xl bg-green/10 border border-green/30 p-3 flex items-start gap-2">
                    <Check size={14} className="text-green mt-0.5" />
                    <p className="text-xs text-text-secondary">
                        Coach {athleteCoachLink.coachName} assigned {todayPlans.length} plan{todayPlans.length > 1 ? 's' : ''} for today.
                    </p>
                </div>
            )}
        </div>
    );
}
