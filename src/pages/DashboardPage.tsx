import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import {
    getRecentWorkouts,
    getActiveChallenges,
    getMealsByDate,
    getMyCommunityGroups,
    getOneRepMaxes,
    updateUserProfile,
} from '../lib/firestoreService';
import { formatDurationHuman, formatRelativeTime, getTodayKey, getDaysInRange } from '../lib/utils';
import { enqueueAction } from '../lib/offlineQueue';
import { calculateReadinessScore, getAthleteReadiness, getHealthCheck, saveHealthCheck } from '../lib/healthCheckService';
import type {
    WorkoutSession,
    Challenge,
    CommunityGroup,
    Meal,
    OneRepMaxes,
    HealthCheck,
    ReadinessScore,
    ReadinessStatus,
} from '../lib/types';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Dumbbell, ChevronRight, Zap, Trophy, BarChart3, TimerReset, Users, CalendarCheck, Flame, WifiOff, Droplets, PersonStanding, Activity, Footprints, Bike, Wind, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';
import { getOneRepMaxPromptStatus, getOneRepMaxSnoozeUntil } from '../lib/oneRepMaxes';
import { formatProgressionInsightTarget, getDashboardProgressionInsight } from '../lib/progressionInsights';
import { getWorkoutHeadline } from '../lib/workoutSummary';
import { buildReadinessRecoveryGuidance, summarizeDailyNutrition, type GuidanceTone } from '../lib/readinessGuidance';
import {
    buildCircleShortcutCard,
    buildDashboardGoalHero,
    buildDashboardProgressEmptyState,
    buildRecoveryAlternatives,
    buildReadinessStrip,
    buildTodayRecommendation,
} from '../lib/dashboardPresentation';
import HealthCheckForm from '../components/HealthCheckForm';
import { CardioQuickLog } from '../components/CardioQuickLog';
import type { CardioActivityType } from '../lib/types';
import { aggregateWeeklyHeartPoints } from '../lib/heartPoints';
import {
    ActionButton,
    ActivityRing,
    EmptyState,
    InsightCard,
    MetricCard,
    ProgressRing,
    ReadinessCard,
    RecoveryGuidanceCard,
    SectionHeader,
    StatChip,
    WorkoutCard,
} from '../components/ui';

const getReadinessTone = (status: ReadinessStatus): {
    badge: string;
    border: string;
    surface: string;
    label: string;
} => {
    if (status === 'excellent') {
        return {
            badge: 'bg-green/15 text-green',
            border: 'border-green/20',
            surface: 'from-green/12 via-bg-card to-bg-surface',
            label: 'Ready',
        };
    }
    if (status === 'good') {
        return {
            badge: 'bg-cyan/15 text-cyan',
            border: 'border-cyan/20',
            surface: 'from-cyan/12 via-bg-card to-bg-surface',
            label: 'Solid',
        };
    }
    if (status === 'moderate') {
        return {
            badge: 'bg-amber/15 text-amber',
            border: 'border-amber/20',
            surface: 'from-amber/12 via-bg-card to-bg-surface',
            label: 'Caution',
        };
    }
    return {
        badge: 'bg-red/15 text-red',
        border: 'border-red/20',
        surface: 'from-red/12 via-bg-card to-bg-surface',
        label: 'Recovery',
    };
};

const getGuidanceTone = (tone: GuidanceTone): {
    border: string;
    badge: string;
    surface: string;
} => {
    if (tone === 'green') {
        return {
            border: 'border-green/20',
            badge: 'bg-green/15 text-green',
            surface: 'bg-green/5',
        };
    }
    if (tone === 'cyan') {
        return {
            border: 'border-cyan/20',
            badge: 'bg-cyan/15 text-cyan',
            surface: 'bg-cyan/5',
        };
    }
    if (tone === 'amber') {
        return {
            border: 'border-amber/20',
            badge: 'bg-amber/15 text-amber',
            surface: 'bg-amber/5',
        };
    }
    return {
        border: 'border-red/20',
        badge: 'bg-red/15 text-red',
        surface: 'bg-red/5',
    };
};

export default function DashboardPage() {
    const { user, profile } = useAuthStore();
    const { activeSession, loadRepeatWorkout } = useWorkoutStore();
    const navigate = useNavigate();
    const todayKey = getTodayKey();

    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [myGroups, setMyGroups] = useState<CommunityGroup[]>([]);
    const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
    const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxes | null>(null);
    const [todayHealthCheck, setTodayHealthCheck] = useState<HealthCheck | null>(null);
    const [todayReadiness, setTodayReadiness] = useState<ReadinessScore | null>(null);
    const [showHealthForm, setShowHealthForm] = useState(false);
    const [loadingWorkouts, setLoadingWorkouts] = useState(true);
    const [savingPromptState, setSavingPromptState] = useState(false);
    const [savingHealthCheck, setSavingHealthCheck] = useState(false);
    const [cardioOpen, setCardioOpen] = useState<{ open: boolean; activity: CardioActivityType }>({ open: false, activity: 'run' });
    const openCardio = (activity: CardioActivityType) => setCardioOpen({ open: true, activity });
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [isChartReady, setIsChartReady] = useState(false);
    const latestWorkout = workouts[0] ?? null;
    const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            const [
                workoutsResult,
                challengesResult,
                groupsResult,
                mealsResult,
                maxesResult,
                healthCheckResult,
                readinessResult,
            ] = await Promise.allSettled([
                getRecentWorkouts(user.uid, 120),
                getActiveChallenges(user.uid),
                getMyCommunityGroups(user.uid),
                getMealsByDate(user.uid, todayKey),
                getOneRepMaxes(user.uid),
                getHealthCheck(user.uid, todayKey),
                getAthleteReadiness(user.uid, todayKey),
            ]);

            if (workoutsResult.status === 'fulfilled') {
                setWorkouts(workoutsResult.value);
            } else {
                console.warn('Failed to load workouts for dashboard:', workoutsResult.reason);
            }

            if (challengesResult.status === 'fulfilled') {
                setChallenges(challengesResult.value);
            } else {
                console.warn('Failed to load challenges for dashboard:', challengesResult.reason);
            }

            if (groupsResult.status === 'fulfilled') {
                setMyGroups(groupsResult.value);
            } else {
                console.warn('Failed to load circles for dashboard:', groupsResult.reason);
            }

            if (mealsResult.status === 'fulfilled') {
                setTodayMeals(mealsResult.value);
            } else {
                console.warn('Failed to load meals for dashboard:', mealsResult.reason);
            }

            if (maxesResult.status === 'fulfilled') {
                setOneRepMaxes(maxesResult.value);
            } else {
                console.warn('Failed to load 1RM data for dashboard:', maxesResult.reason);
            }

            if (healthCheckResult.status === 'fulfilled') {
                setTodayHealthCheck(healthCheckResult.value);
            } else {
                console.warn('Failed to load health check for dashboard:', healthCheckResult.reason);
            }

            if (readinessResult.status === 'fulfilled') {
                setTodayReadiness(readinessResult.value);
            } else {
                console.warn('Failed to load readiness for dashboard:', readinessResult.reason);
            }

            setShowHealthForm(false);
            setLoadingWorkouts(false);
        };
        void load();
    }, [todayKey, user]);

    useEffect(() => {
        const el = chartContainerRef.current;
        if (!el) return;

        const updateReady = () => {
            const { width, height } = el.getBoundingClientRect();
            setIsChartReady(width > 0 && height > 0);
        };

        updateReady();
        const raf = requestAnimationFrame(updateReady);
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateReady) : null;
        observer?.observe(el);

        return () => {
            cancelAnimationFrame(raf);
            observer?.disconnect();
        };
    }, []);

    const stats = useMemo(() => {
        const monthStart = dayjs().startOf('month').valueOf();
        const monthWorkouts = workouts.filter((workout) => workout.startedAt >= monthStart);
        const totalDuration = monthWorkouts.reduce((sum, w) => sum + w.duration, 0);
        const totalCalories = monthWorkouts.reduce((sum, w) => sum + w.caloriesEstimate, 0);

        const weekStart = dayjs().startOf('week').valueOf();
        const weeklyWorkouts = workouts.filter((w) => w.startedAt >= weekStart).length;

        // Calculate streak
        let streak = 0;
        const daySet = new Set(workouts.map((w) => dayjs(w.startedAt).format('YYYY-MM-DD')));
        let checkDay = dayjs();
        while (daySet.has(checkDay.format('YYYY-MM-DD'))) {
            streak++;
            checkDay = checkDay.subtract(1, 'day');
        }

        return { totalWorkouts: workouts.length, totalDuration, totalCalories, weeklyWorkouts, streak };
    }, [workouts]);

    const oneRepMaxStatus = useMemo(() => {
        return getOneRepMaxPromptStatus(oneRepMaxes, workouts, profile);
    }, [oneRepMaxes, profile, workouts]);
    const progressionInsight = useMemo(() => getDashboardProgressionInsight(workouts), [workouts]);

    useEffect(() => {
        if (!user || !profile || !oneRepMaxStatus.shouldPrompt) return;
        const lastShownAt = profile.oneRepMaxPromptLastShownAt || 0;
        if (Date.now() - lastShownAt < 6 * 60 * 60 * 1000) return;

        const nextShownAt = Date.now();
        useAuthStore.setState((state) => {
            if (!state.profile) return state;
            return {
                ...state,
                profile: {
                    ...state.profile,
                    oneRepMaxPromptLastShownAt: nextShownAt,
                },
            };
        });

        void updateUserProfile(user.uid, {
            oneRepMaxPromptLastShownAt: nextShownAt,
        }).catch((error) => {
            console.warn('Failed to record 1RM prompt impression:', error);
        });
    }, [oneRepMaxStatus.shouldPrompt, profile, user]);

    const handleSnoozeOneRepMaxPrompt = async () => {
        if (!user) return;

        setSavingPromptState(true);
        const snoozeUntil = getOneRepMaxSnoozeUntil();
        useAuthStore.setState((state) => {
            if (!state.profile) return state;
            return {
                ...state,
                profile: {
                    ...state.profile,
                    oneRepMaxPromptSnoozeUntil: snoozeUntil,
                    oneRepMaxPromptLastShownAt: Date.now(),
                },
            };
        });

        try {
            await updateUserProfile(user.uid, {
                oneRepMaxPromptSnoozeUntil: snoozeUntil,
                oneRepMaxPromptLastShownAt: Date.now(),
            });
        } catch (error) {
            console.warn('Failed to snooze 1RM prompt:', error);
        } finally {
            setSavingPromptState(false);
        }
    };

    const trendInsights = useMemo(() => {
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const monthMs = 30 * 24 * 60 * 60 * 1000;
        const calcSessionVolume = (session: WorkoutSession): number => {
            return session.exercises.reduce((exerciseSum, exercise) => {
                return exerciseSum + exercise.sets.reduce((setSum, setItem) => setSum + setItem.weight * setItem.reps, 0);
            }, 0);
        };
        const calcVolume = (sessions: WorkoutSession[]): number => sessions.reduce((sum, session) => sum + calcSessionVolume(session), 0);
        const averageDuration = (sessions: WorkoutSession[]): number => {
            if (sessions.length === 0) return 0;
            return Math.round(sessions.reduce((sum, session) => sum + session.duration, 0) / sessions.length);
        };

        const last7 = workouts.filter((session) => session.startedAt >= now - weekMs);
        const previous7 = workouts.filter(
            (session) => session.startedAt < now - weekMs && session.startedAt >= now - (2 * weekMs)
        );

        const recent30 = workouts.filter((session) => session.startedAt >= now - monthMs);
        const exerciseVolume = new Map<string, number>();
        for (const session of recent30) {
            for (const exercise of session.exercises) {
                const key = exercise.name.trim() || 'Unnamed';
                const volume = exercise.sets.reduce((sum, setItem) => sum + setItem.weight * setItem.reps, 0);
                exerciseVolume.set(key, (exerciseVolume.get(key) || 0) + volume);
            }
        }
        const topExerciseEntry = Array.from(exerciseVolume.entries()).sort((a, b) => b[1] - a[1])[0];
        const topExerciseName = topExerciseEntry?.[0] || 'No lift data yet';
        const topExerciseVolume = Math.round(topExerciseEntry?.[1] || 0);

        const lastVolume = calcVolume(last7);
        const prevVolume = calcVolume(previous7);
        const volumeDeltaPct = prevVolume > 0
            ? Math.round(((lastVolume - prevVolume) / prevVolume) * 100)
            : (lastVolume > 0 ? 100 : 0);

        const currentAvgDuration = averageDuration(last7);
        const previousAvgDuration = averageDuration(previous7);
        const durationDeltaPct = previousAvgDuration > 0
            ? Math.round(((currentAvgDuration - previousAvgDuration) / previousAvgDuration) * 100)
            : (currentAvgDuration > 0 ? 100 : 0);

        return {
            last7Count: last7.length,
            lastVolume: Math.round(lastVolume),
            volumeDeltaPct,
            currentAvgDuration,
            durationDeltaPct,
            topExerciseName,
            topExerciseVolume,
        };
    }, [workouts]);

    const readinessTone = useMemo(
        () => (todayReadiness ? getReadinessTone(todayReadiness.status) : null),
        [todayReadiness]
    );

    const handleSaveHealthCheck = async (check: HealthCheck) => {
        if (!user) return;

        const now = Date.now();
        const payload: HealthCheck = {
            ...check,
            athleteId: user.uid,
            date: todayKey,
            createdAt: todayHealthCheck?.createdAt ?? check.createdAt ?? now,
            updatedAt: now,
        };
        const readiness = calculateReadinessScore({
            athleteId: payload.athleteId,
            date: payload.date,
            sleepQuality: payload.sleepQuality,
            soreness: payload.soreness,
            mood: payload.mood,
            painNotes: payload.painNotes,
            updatedAt: payload.updatedAt,
        });

        setSavingHealthCheck(true);
        try {
            await saveHealthCheck(payload);
            setTodayHealthCheck(payload);
            setTodayReadiness(readiness);
            setShowHealthForm(false);
            toast.success('Readiness check saved');
        } catch (error) {
            setTodayHealthCheck(payload);
            setTodayReadiness(readiness);
            setShowHealthForm(false);
            await enqueueAction({
                type: 'healthCheck',
                action: todayHealthCheck ? 'update' : 'create',
                data: payload,
            });
            toast('Saved offline - will sync when online', { icon: '📴' });
            console.warn('Failed to save readiness check:', error);
        } finally {
            setSavingHealthCheck(false);
        }
    };

    const handleRepeatLastWorkout = (startImmediately = false) => {
        if (!user || !latestWorkout) return;

        loadRepeatWorkout(user.uid, latestWorkout, { startImmediately });
        if (startImmediately) {
            toast.success('Last workout loaded and started.');
            navigate('/active-workout');
            return;
        }

        toast.success('Last workout loaded. Review it before starting.');
        navigate('/workout');
    };

    const chartData = useMemo(() => {
        const days = getDaysInRange(7);
        return days.map((day) => {
            const count = workouts.filter((w) => dayjs(w.startedAt).format('YYYY-MM-DD') === day).length;
            return { day: dayjs(day).format('ddd'), count, date: day };
        });
    }, [workouts]);
    const todayNutrition = useMemo(() => summarizeDailyNutrition(todayMeals), [todayMeals]);
    const todayRecoveryGuidance = useMemo(
        () => (todayReadiness ? buildReadinessRecoveryGuidance(todayReadiness, todayNutrition) : null),
        [todayReadiness, todayNutrition]
    );

    const todayCalories = todayNutrition.calories;
    const goalHero = useMemo(
        () => buildDashboardGoalHero({ profile, activeSession, latestWorkout }),
        [profile, activeSession, latestWorkout]
    );
    const progressEmptyState = useMemo(
        () => buildDashboardProgressEmptyState({ profile, workoutCount: workouts.length }),
        [profile, workouts.length]
    );
    const circleShortcut = useMemo(
        () => buildCircleShortcutCard({ profile, hasCircle: myGroups.length > 0 }),
        [profile, myGroups.length]
    );
    const readinessStrip = useMemo(
        () => buildReadinessStrip({ readiness: todayReadiness, healthCheck: todayHealthCheck }),
        [todayHealthCheck, todayReadiness]
    );
    const weeklyGoal = profile?.onboarding?.trainingDaysPerWeek || 3;
    const weeklyProgress = Math.min(stats.weeklyWorkouts, weeklyGoal);
    const weeklyProgressPct = weeklyGoal > 0 ? Math.round((weeklyProgress / weeklyGoal) * 100) : 0;
    const todayRecommendation = useMemo(
        () => buildTodayRecommendation({
            activeSession,
            latestWorkout,
            readiness: todayReadiness,
            hasCoachPlan: profile?.onboarding?.supportMode === 'with_coach' && !latestWorkout,
            isOnline,
        }),
        [activeSession, isOnline, latestWorkout, profile?.onboarding?.supportMode, todayReadiness]
    );
    const recoveryAlternatives = useMemo(
        () => buildRecoveryAlternatives({ readiness: todayReadiness }),
        [todayReadiness]
    );
    const readinessStripBadgeClass = readinessStrip.tone === 'empty'
        ? 'bg-bg-input text-text-secondary'
        : readinessTone?.badge ?? 'bg-bg-input text-text-secondary';
    const readinessStripDotClass = readinessStrip.tone === 'empty'
        ? 'bg-border-light'
        : readinessStrip.tone === 'excellent'
            ? 'bg-green'
            : readinessStrip.tone === 'good'
                ? 'bg-cyan'
                : readinessStrip.tone === 'moderate'
                    ? 'bg-amber'
                    : 'bg-red';
    const handlePrimaryAction = () => {
        if (activeSession) {
            navigate('/active-workout');
            return;
        }
        navigate('/workout');
    };

    const handleTodayRecommendation = () => {
        if (todayRecommendation.tone === 'repeat' && latestWorkout) {
            handleRepeatLastWorkout(false);
            return;
        }
        navigate(todayRecommendation.route);
    };

    const firstName = profile?.displayName?.split(' ')[0] || 'Athlete';
    const hasWorkoutHistory = workouts.length > 0;

    const hourNow = dayjs().hour();
    const greetingWord = hourNow < 12 ? 'Good morning' : hourNow < 18 ? 'Good afternoon' : 'Good evening';

    // Activity Points: fun metric based on weekly workouts + streak
    const activityPoints = stats.weeklyWorkouts * 80 + stats.streak * 30 + (todayReadiness?.score ?? 0) * 20;
    const activityPointsGoal = 1000;
    const activityPointsPct = Math.min(100, Math.round((activityPoints / activityPointsGoal) * 100));

    // Derive Move/Exercise/Stand ring values from weekly data
    const moveCalories = stats.totalCalories;
    const moveGoal = 700;
    const exerciseMinutes = Math.round(stats.totalDuration / 60);
    const exerciseGoal = 150;
    const standDays = Math.min(7, stats.weeklyWorkouts + Math.floor(stats.streak / 2));
    const standGoal = 7;

    const weeklyHeartPoints = useMemo(() => aggregateWeeklyHeartPoints(workouts), [workouts]);

    // Weekly day strip (Mon-Sun, ISO week)
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekDaySet = new Set(workouts.map((w) => dayjs(w.startedAt).format('YYYY-MM-DD')));
    const mondayOffset = (dayjs().day() + 6) % 7; // 0=Mon
    const weekDayDates = Array.from({ length: 7 }, (_, i) => {
        const d = dayjs().subtract(mondayOffset - i, 'day');
        return { label: weekDays[i], date: d.format('YYYY-MM-DD'), isToday: d.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD') };
    });

    return (
        <div className="shell-page space-y-5 pb-6 pt-5">

            {/* ── Header Greeting ── */}
            <header className="animate-fade-in px-1">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h1 className="font-display text-[1.7rem] font-extrabold leading-tight text-text-primary">
                            {greetingWord}, {firstName}! <span className="inline-block">👋</span>
                        </h1>
                        <p className="mt-1 text-sm text-text-muted">Today is {dayjs().format('MMMM D, YYYY')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!isOnline && (
                            <span className="flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-1 text-[10px] font-bold text-amber">
                                <WifiOff size={11} />
                                Offline
                            </span>
                        )}
                        <button
                            onClick={() => setShowHealthForm((c) => !c)}
                            className="flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1.5 text-[11px] font-bold text-primary"
                        >
                            <ShieldCheck size={12} />
                            Check-in
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Health Check Form (inline) ── */}
            {showHealthForm && (
                <HealthCheckForm
                    athleteId={user?.uid || ''}
                    date={todayKey}
                    initialValue={todayHealthCheck}
                    saving={savingHealthCheck}
                    onComplete={handleSaveHealthCheck}
                    onCancel={() => setShowHealthForm(false)}
                />
            )}

            {/* ── Your Activity ── */}
            <section className="bg-bg-card rounded-3xl p-5 shadow-card animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Your Activity</p>
                        <p className="text-[11px] text-text-muted">This week</p>
                    </div>
                    <button onClick={() => navigate('/progress')} className="text-xs font-bold text-primary">
                        View week →
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <ActivityRing
                        size={108}
                        centerValue={String(activityPoints)}
                        centerLabel="pts"
                        rings={[
                            { value: Math.min(moveCalories, moveGoal), max: moveGoal, label: 'Move', tone: 'accent' },
                            { value: Math.min(exerciseMinutes, exerciseGoal), max: exerciseGoal, label: 'Exercise', tone: 'secondary' },
                            { value: standDays, max: standGoal, label: 'Stand', tone: 'tertiary' },
                        ]}
                    />
                    <div className="flex-1 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber shrink-0" />
                                <span className="text-xs font-semibold text-text-primary">Move</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-text-primary">{moveCalories.toLocaleString()} Cal</span>
                                <span className="text-[10px] text-text-muted ml-1">{Math.round(Math.min(moveCalories / moveGoal, 1) * 100)}%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-secondary shrink-0" />
                                <span className="text-xs font-semibold text-text-primary">Exercise</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-text-primary">{exerciseMinutes} / 150 min</span>
                                <span className="text-[10px] text-text-muted ml-1">{Math.round(Math.min(exerciseMinutes / exerciseGoal, 1) * 100)}%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-tertiary shrink-0" />
                                <span className="text-xs font-semibold text-text-primary">Stand</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-text-primary">{standDays} / 7 hr</span>
                                <span className="text-[10px] text-text-muted ml-1">{Math.round((standDays / standGoal) * 100)}%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-red/10 flex items-center justify-center" aria-hidden="true">
                                    <span className="text-red text-[11px]">♥</span>
                                </span>
                                <span className="text-xs font-bold text-text-primary">Heart pts</span>
                            </div>
                            <span className="text-xs font-extrabold text-red">{weeklyHeartPoints}</span>
                        </div>
                    </div>
                </div>

                {/* Day strip */}
                <div className="mt-4 flex justify-between">
                    {weekDayDates.map(({ label, date, isToday }) => {
                        const done = weekDaySet.has(date);
                        return (
                            <div key={date} className="flex flex-col items-center gap-1">
                                <span className={`text-[10px] font-semibold ${isToday ? 'text-primary' : 'text-text-muted'}`}>{label}</span>
                                <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center"
                                    style={{
                                        background: done ? '#2f7d32' : isToday ? '#dcefd8' : '#edf4e8',
                                        border: isToday && !done ? '2px solid #9bd93c' : '2px solid transparent',
                                    }}
                                >
                                    {done && <span className="text-white text-[10px] font-bold">✓</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Readiness + Streak row ── */}
            <div className="grid grid-cols-2 gap-3 animate-fade-in stagger-1">
                {/* Readiness */}
                <div
                    className={`rounded-3xl p-4 shadow-card border ${readinessTone?.border ?? 'border-border'}`}
                    style={{ background: todayReadiness ? undefined : '#fff' }}
                >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Readiness</p>
                    <div className="mt-1 flex items-end gap-1">
                        <span className="font-display text-4xl font-extrabold text-text-primary leading-none">
                            {todayReadiness ? Math.round(todayReadiness.score * 10) : '--'}
                        </span>
                        <span className="text-sm text-text-muted mb-0.5">/100</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-text-secondary">
                        {readinessStrip.tone === 'empty'
                            ? 'Log a check-in to see readiness'
                            : readinessStrip.detail.slice(0, 50)}
                    </p>
                    <button
                        onClick={() => setShowHealthForm((c) => !c)}
                        className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-bold w-full ${readinessTone?.badge ?? 'bg-bg-input text-text-secondary'}`}
                    >
                        {readinessStrip.ctaLabel}
                    </button>
                </div>

                {/* Streak */}
                <div className="rounded-3xl p-4 shadow-card bg-bg-card border border-amber/20">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Streak 🔥</p>
                    <div className="mt-1 flex items-end gap-1">
                        <span className="font-display text-4xl font-extrabold text-amber leading-none">
                            {stats.streak}
                        </span>
                        <span className="text-sm text-text-muted mb-0.5">days</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-text-secondary">
                        {stats.streak > 0 ? "Keep it up! You're building a strong habit." : 'Start your streak today!'}
                    </p>
                    <div className="mt-3 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-amber/15 border-2 border-amber flex items-center justify-center">
                            <span className="text-sm font-extrabold text-amber">{stats.streak}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Recommended Workout ── */}
            <section className="bg-bg-card rounded-3xl p-5 shadow-card animate-fade-in stagger-1">
                <span className="inline-block rounded-full bg-secondary-container px-2.5 py-1 text-[10px] font-bold text-primary uppercase tracking-[0.1em]">
                    Recommended for you
                </span>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-text-primary leading-tight">
                    {todayRecommendation.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                    {profile?.onboarding?.timeAvailableMinutes && (
                        <span className="flex items-center gap-1">
                            <TimerReset size={12} className="text-text-muted" />
                            {profile.onboarding.timeAvailableMinutes} min
                        </span>
                    )}
                    <span className="text-text-muted">·</span>
                    <span className="flex items-center gap-1">
                        <BarChart3 size={12} className="text-text-muted" />
                        {goalHero.eyebrow}
                    </span>
                    {profile?.onboarding?.trainingEnvironment && (
                        <>
                            <span className="text-text-muted">·</span>
                            <span className="text-text-secondary capitalize">{profile.onboarding.trainingEnvironment.replace(/_/g, ' ')}</span>
                        </>
                    )}
                </div>
                <p className="mt-2.5 text-sm leading-6 text-text-secondary">
                    {todayRecommendation.detail}
                </p>

                <button
                    type="button"
                    onClick={handleTodayRecommendation}
                    className="mt-4 w-full py-4 rounded-2xl bg-primary text-text-inverse font-bold text-base flex items-center justify-center gap-2"
                >
                    {todayRecommendation.ctaLabel}
                    <ChevronRight size={18} strokeWidth={2.5} />
                </button>

                {!activeSession && latestWorkout && (
                    <button
                        type="button"
                        onClick={() => handleRepeatLastWorkout(false)}
                        className="mt-2 w-full py-3 rounded-2xl border border-border bg-bg-surface text-sm text-text-secondary font-semibold flex items-center justify-center gap-2"
                    >
                        Repeat: {getWorkoutHeadline(latestWorkout)}
                    </button>
                )}
            </section>

            {/* ── Quick Actions ── */}
            <section className="animate-fade-in stagger-2">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {[
                        { icon: Footprints, label: 'Go for a Run', color: 'text-secondary', bg: 'bg-secondary-container', onClick: () => openCardio('run') },
                        { icon: Dumbbell, label: 'Strength', color: 'text-amber', bg: 'bg-amber/15', onClick: () => navigate('/workout') },
                        { icon: PersonStanding, label: 'Mobility', color: 'text-primary', bg: 'bg-primary-container', onClick: () => navigate('/workout') },
                        { icon: Wind, label: 'Outdoor Walk', color: 'text-tertiary', bg: 'bg-tertiary-container', onClick: () => openCardio('walk') },
                    ].map(({ icon: Icon, label, color, bg, onClick }) => (
                        <button
                            key={label}
                            onClick={onClick}
                            className={`shrink-0 flex items-center gap-2 rounded-2xl ${bg} px-3.5 py-3 min-w-[110px]`}
                        >
                            <Icon size={20} className={color} strokeWidth={2.4} />
                            <span className={`text-[12px] font-bold ${color} text-left leading-tight`}>{label}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* ── Hydrate & Recover ── */}
            <div className="bg-bg-card rounded-3xl p-4 shadow-card border border-tertiary/15 animate-fade-in stagger-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-tertiary/10 flex items-center justify-center shrink-0">
                        <Droplets size={20} className="text-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary">Hydrate &amp; recover</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                            {todayCalories > 0
                                ? `You've hit ${todayCalories} kcal today. Drink water and eat protein to recover.`
                                : 'Log your meals and drink water. Nutrition is half the protocol.'}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/nutrition')}
                        className="shrink-0 rounded-xl bg-tertiary/10 px-3 py-2 text-xs font-bold text-tertiary"
                    >
                        Log Water
                    </button>
                </div>
            </div>

            {/* ── 1RM Prompt ── */}
            {oneRepMaxStatus.shouldPrompt && (
                <div className="bg-bg-card rounded-3xl p-5 shadow-card border border-amber/20 animate-fade-in">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">Strength profile</p>
                            <h2 className="mt-1 text-base font-bold text-text-primary">Update your 1RM</h2>
                            <p className="mt-1.5 text-sm text-text-secondary">{oneRepMaxStatus.reason}</p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-amber/10 flex items-center justify-center shrink-0">
                            <BarChart3 size={18} className="text-amber" />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => navigate('/profile?focus=one-rep-maxes')}
                            className="flex-1 rounded-2xl bg-amber px-4 py-3 font-bold text-white text-sm"
                        >
                            Update in Profile
                        </button>
                        <button
                            onClick={() => void handleSnoozeOneRepMaxPrompt()}
                            disabled={savingPromptState}
                            className="flex items-center gap-2 rounded-2xl border border-border bg-bg-surface px-4 py-3 text-sm text-text-secondary disabled:opacity-50"
                        >
                            <TimerReset size={14} />
                            7 days
                        </button>
                    </div>
                </div>
            )}

            {/* ── Progress section ── */}
            {!loadingWorkouts && !hasWorkoutHistory ? (
                <EmptyState
                    className="animate-fade-in stagger-2"
                    icon={<Dumbbell size={24} />}
                    title={progressEmptyState.title}
                    description={progressEmptyState.detail}
                    actionLabel={progressEmptyState.ctaLabel}
                    onAction={handlePrimaryAction}
                    secondaryAction={
                        <ActionButton variant="secondary" onClick={() => navigate('/community')}>
                            Circle
                        </ActionButton>
                    }
                />
            ) : (
                <>
                    {/* Bar chart */}
                    <div className="bg-bg-card rounded-3xl p-4 shadow-card animate-fade-in stagger-2 min-w-0">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-text-primary">Weekly sessions</h3>
                            <span className="text-xs text-text-muted">{trendInsights.last7Count} this week</span>
                        </div>
                        <div ref={chartContainerRef} className="h-32 w-full min-w-0">
                            {isChartReady ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                                    <BarChart data={chartData} barSize={24}>
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#748177' }} />
                                        <YAxis hide allowDecimals={false} />
                                        <Tooltip
                                            cursor={false}
                                            contentStyle={{
                                                background: '#ffffff',
                                                border: '1px solid #dce8d5',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                color: '#142117',
                                                boxShadow: '0 8px 24px rgba(20,33,23,0.08)',
                                            }}
                                        />
                                        <Bar dataKey="count" radius={[8, 8, 4, 4]} name="Workouts">
                                            {chartData.map((entry, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={entry.count > 0 ? '#17452a' : '#dcefd8'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full w-full rounded-2xl bg-bg-surface" />
                            )}
                        </div>
                    </div>

                    {/* Strength trends */}
                    <div className="bg-bg-card rounded-3xl p-4 shadow-card animate-fade-in stagger-2">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-text-primary">Strength trends</h3>
                            <button onClick={() => navigate('/progress')} className="text-xs font-medium text-primary">
                                See progress →
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-bg-surface p-3">
                                <p className="text-[11px] uppercase tracking-wide text-text-muted">Volume</p>
                                <p className="mt-1 text-lg font-extrabold text-text-primary">{trendInsights.lastVolume.toLocaleString()}</p>
                                <p className={`mt-0.5 text-xs font-semibold ${trendInsights.volumeDeltaPct >= 0 ? 'text-green' : 'text-red'}`}>
                                    {trendInsights.volumeDeltaPct >= 0 ? '+' : ''}{trendInsights.volumeDeltaPct}% vs last week
                                </p>
                            </div>
                            <div className="rounded-2xl bg-bg-surface p-3">
                                <p className="text-[11px] uppercase tracking-wide text-text-muted">Avg duration</p>
                                <p className="mt-1 text-lg font-extrabold text-text-primary">{formatDurationHuman(trendInsights.currentAvgDuration)}</p>
                                <p className={`mt-0.5 text-xs font-semibold ${trendInsights.durationDeltaPct >= 0 ? 'text-amber' : 'text-cyan'}`}>
                                    {trendInsights.durationDeltaPct >= 0 ? '+' : ''}{trendInsights.durationDeltaPct}% vs last week
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 rounded-2xl bg-bg-surface p-3">
                            <p className="text-[11px] uppercase tracking-wide text-text-muted">Top lift · 30 days</p>
                            <p className="mt-1 text-sm font-bold text-text-primary">{trendInsights.topExerciseName}</p>
                            <p className="text-xs text-text-secondary">{trendInsights.topExerciseVolume.toLocaleString()} kg·reps</p>
                        </div>
                    </div>
                </>
            )}

            {progressionInsight && (
                <div className="bg-bg-card rounded-3xl p-4 shadow-card animate-fade-in stagger-3 border border-tertiary/20">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-tertiary font-bold">Next progression</p>
                            <h3 className="mt-1 text-base font-bold text-text-primary">{progressionInsight.exerciseName}</h3>
                        </div>
                        <button
                            onClick={() => navigate('/workout')}
                            className="rounded-xl border border-border bg-bg-surface px-3 py-2 text-xs font-semibold text-text-secondary"
                        >
                            Open planner
                        </button>
                    </div>
                    <p className="mt-2 text-xl font-black text-text-primary">{formatProgressionInsightTarget(progressionInsight)}</p>
                    <p className="mt-1 text-xs text-text-secondary">{progressionInsight.reason}</p>
                </div>
            )}

            {challenges.length > 0 && (
                <div className="animate-fade-in stagger-3">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-primary">Active challenges</h3>
                        <button onClick={() => navigate('/challenges')} className="text-xs font-bold text-primary">
                            View all →
                        </button>
                    </div>
                    <div className="space-y-3">
                        {challenges.slice(0, 2).map((c) => {
                            const pct = Math.min(100, Math.round((c.currentCount / c.targetCount) * 100));
                            return (
                                <div key={c.id} className="bg-bg-card rounded-3xl p-4 shadow-card">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Trophy size={16} className="text-amber" />
                                            <span className="text-sm font-semibold text-text-primary">{c.title}</span>
                                        </div>
                                        <span className="text-xs text-text-muted font-semibold">{c.currentCount}/{c.targetCount}</span>
                                    </div>
                                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-input">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-[11px] text-text-muted">{pct}% complete</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Food today ── */}
            <div className="bg-bg-card rounded-3xl p-4 shadow-card animate-fade-in stagger-4">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary">Food today</h3>
                    <button onClick={() => navigate('/nutrition')} className="text-xs font-bold text-primary">
                        Log food
                    </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-text-primary">{todayCalories}</span>
                    <span className="text-sm text-text-muted">kcal</span>
                </div>
                <div className="mt-2 flex gap-4">
                    <MacroPill label="Protein" value={todayNutrition.protein} color="text-cyan" />
                    <MacroPill label="Carbs" value={todayNutrition.carbs} color="text-amber" />
                    <MacroPill label="Fat" value={todayNutrition.fat} color="text-red" />
                </div>
            </div>

            {/* ── Recent sessions ── */}
            {workouts.length > 0 && (
                <div className="animate-fade-in stagger-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-primary">Recent sessions</h3>
                        <button
                            onClick={() => navigate('/history')}
                            className="text-xs font-bold text-primary"
                        >
                            Open calendar
                        </button>
                    </div>
                    <div className="space-y-2">
                        {workouts.slice(0, 3).map((w) => (
                            <button
                                key={w.id}
                                onClick={() => navigate(`/history/${w.id}`)}
                                className="bg-bg-card flex w-full items-center gap-3 rounded-3xl p-4 text-left shadow-card"
                            >
                                <div className="w-11 h-11 rounded-2xl bg-primary-container flex items-center justify-center shrink-0">
                                    <Dumbbell size={18} className="text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-text-primary">
                                        {getWorkoutHeadline(w)}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        {formatDurationHuman(w.duration)} · {formatRelativeTime(w.startedAt)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs text-text-muted">{w.exercises.length} ex</span>
                                    <ChevronRight size={15} className="text-text-muted" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <CardioQuickLog
                open={cardioOpen.open}
                initialActivity={cardioOpen.activity}
                onClose={() => setCardioOpen({ open: false, activity: cardioOpen.activity })}
                onSaved={(session) => setWorkouts((prev) => [session, ...prev])}
            />

            {/* ── Recovery guidance ── */}
            {todayReadiness && todayRecoveryGuidance && (
                <div className="space-y-3 animate-fade-in">
                    <RecoveryGuidanceCard
                        title={todayRecoveryGuidance.headline}
                        description={todayRecoveryGuidance.summary}
                        options={recoveryAlternatives.options.slice(0, 4)}
                        actionLabel="Open recovery"
                        onAction={() => navigate('/nutrition')}
                    />
                </div>
            )}
        </div>
    );
}

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold ${color}`}>{Math.round(value)}g</span>
            <span className="text-xs text-text-muted">{label}</span>
        </div>
    );
}
