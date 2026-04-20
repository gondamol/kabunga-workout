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
import { Dumbbell, ChevronRight, Zap, Trophy, Plus, BarChart3, TimerReset, Users } from 'lucide-react';
import dayjs from 'dayjs';
import { getOneRepMaxPromptStatus, getOneRepMaxSnoozeUntil } from '../lib/oneRepMaxes';
import { formatProgressionInsightTarget, getDashboardProgressionInsight } from '../lib/progressionInsights';
import { getWorkoutHeadline } from '../lib/workoutSummary';
import { buildReadinessRecoveryGuidance, summarizeDailyNutrition, type GuidanceTone } from '../lib/readinessGuidance';
import {
    buildCircleShortcutCard,
    buildDashboardGoalHero,
    buildDashboardProgressEmptyState,
    buildReadinessStrip,
} from '../lib/dashboardPresentation';
import HealthCheckForm from '../components/HealthCheckForm';

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
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [isChartReady, setIsChartReady] = useState(false);
    const latestWorkout = workouts[0] ?? null;

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

    const firstName = profile?.displayName?.split(' ')[0] || 'Athlete';
    const heroIconClass = activeSession ? 'bg-cyan/12 text-cyan' : latestWorkout ? 'bg-green/12 text-green' : 'bg-accent/12 text-accent';
    const proofTopLiftLabel = workouts.length > 0 ? trendInsights.topExerciseName : 'First lift ahead';
    const proofTopLiftValue = workouts.length > 0 ? `${trendInsights.topExerciseVolume} kg·reps` : 'Log a session';
    const hasWorkoutHistory = workouts.length > 0;

    return (
        <div className="shell-page pt-6 pb-6 space-y-5">
            <header className="animate-fade-in">
                <p className="text-sm text-text-secondary">{dayjs().format('dddd, MMM D')}</p>
                <h1 className="mt-1 font-display text-[2rem] font-bold tracking-tight text-text-primary">
                    Ready, {firstName}?
                </h1>
                <p className="mt-2 max-w-sm text-sm text-text-secondary">
                    Keep today simple: see the plan, check your readiness, and move into the session.
                </p>
            </header>

            <section className="premium-hero-card p-5 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="eyebrow-chip">{goalHero.eyebrow}</p>
                        <h2 className="mt-2 font-display text-[1.75rem] font-bold tracking-tight text-text-primary">
                            {goalHero.title}
                        </h2>
                        <p className="mt-2 text-sm text-text-secondary">{goalHero.detail}</p>
                        <p className="floating-stat-chip mt-4 text-xs font-semibold text-text-primary">
                            {profile?.onboarding?.trainingDaysPerWeek
                                ? `${profile.onboarding.trainingDaysPerWeek} training days per week`
                                : 'Built from your setup'}
                        </p>
                    </div>
                    <div className={`soft-panel flex h-12 w-12 items-center justify-center ${heroIconClass}`}>
                        {activeSession ? (
                            <Zap size={22} className="text-cyan" />
                        ) : latestWorkout ? (
                            <Dumbbell size={22} className="text-green" />
                        ) : (
                            <Plus size={22} className="text-accent" />
                        )}
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <button
                        id="start-workout-btn"
                        onClick={handlePrimaryAction}
                        className="flex-1 rounded-2xl gradient-primary px-4 py-4 text-base font-semibold text-white shadow-lg shadow-accent/20 transition-transform active:scale-[0.98]"
                    >
                        {goalHero.ctaLabel}
                    </button>
                    {!activeSession && latestWorkout && (
                        <button
                            onClick={() => handleRepeatLastWorkout(false)}
                            className="rounded-2xl border border-border bg-white px-4 py-4 text-sm font-semibold text-text-primary transition-transform active:scale-[0.98]"
                        >
                            Repeat last
                        </button>
                    )}
                </div>
            </section>

            <section className="grid grid-cols-3 gap-3 animate-fade-in stagger-1">
                <div className="soft-panel px-3 py-4">
                    <p className="text-[10px] uppercase tracking-wide text-text-muted">Streak</p>
                    <p className="mt-2 text-lg font-bold text-text-primary">{stats.streak}</p>
                    <p className="text-xs text-text-secondary">days moving</p>
                </div>
                <div className="soft-panel px-3 py-4">
                    <p className="text-[10px] uppercase tracking-wide text-text-muted">This week</p>
                    <p className="mt-2 text-lg font-bold text-text-primary">{stats.weeklyWorkouts}</p>
                    <p className="text-xs text-text-secondary">sessions</p>
                </div>
                <div className="soft-panel px-3 py-4">
                    <p className="text-[10px] uppercase tracking-wide text-text-muted">Top lift</p>
                    <p className="mt-2 line-clamp-1 text-sm font-bold text-text-primary">{proofTopLiftLabel}</p>
                    <p className="text-xs text-text-secondary">{proofTopLiftValue}</p>
                </div>
            </section>

            <button
                type="button"
                onClick={() => navigate('/community')}
                className="soft-panel w-full p-4 text-left animate-fade-in stagger-1"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="eyebrow-chip">Circle</p>
                        <p className="mt-2 text-base font-bold text-text-primary">{circleShortcut.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">{circleShortcut.detail}</p>
                        <span className="mt-3 inline-flex rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-text-primary">
                            {circleShortcut.ctaLabel}
                        </span>
                    </div>
                    <div className="soft-panel flex h-11 w-11 shrink-0 items-center justify-center text-cyan">
                        <Users size={20} />
                    </div>
                </div>
            </button>

            <button
                type="button"
                onClick={() => setShowHealthForm((current) => !current)}
                className="glass w-full rounded-[24px] p-4 text-left animate-fade-in"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className={`h-3 w-3 rounded-full ${readinessStripDotClass}`} />
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">
                                {readinessStrip.label}
                            </p>
                            <p className="mt-1 text-base font-bold text-text-primary">{readinessStrip.value}</p>
                            <p className="mt-1 text-sm text-text-secondary">{readinessStrip.detail}</p>
                        </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${readinessStripBadgeClass}`}>
                        {readinessStrip.ctaLabel}
                    </span>
                </div>
            </button>

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

            {todayReadiness && todayRecoveryGuidance && (
                <div className="glass rounded-[28px] p-5 animate-fade-in">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">Recovery support</p>
                            <h2 className="mt-1 text-lg font-bold text-text-primary">{todayRecoveryGuidance.headline}</h2>
                            <p className="mt-2 text-sm text-text-secondary">{todayRecoveryGuidance.summary}</p>
                        </div>
                        <button
                            onClick={() => navigate('/nutrition')}
                            className="rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-primary"
                        >
                            Food today
                        </button>
                    </div>
                    <div className="mt-4 space-y-2">
                        {todayRecoveryGuidance.items.map((item) => {
                            const tone = getGuidanceTone(item.tone);
                            return (
                                <div
                                    key={item.id}
                                    className={`rounded-2xl border ${tone.border} ${tone.surface} p-3`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold">{item.title}</p>
                                            <p className="mt-1 text-xs text-text-secondary">{item.detail}</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tone.badge}`}>
                                            {item.tone}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {oneRepMaxStatus.shouldPrompt && (
                <div className="glass rounded-[28px] p-5 animate-fade-in">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">Strength profile</p>
                            <h2 className="mt-1 text-lg font-bold text-text-primary">Update your 1RM</h2>
                            <p className="mt-2 text-sm text-text-secondary">{oneRepMaxStatus.reason}</p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber/12 shrink-0">
                            <BarChart3 size={20} className="text-amber" />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => navigate('/profile?focus=one-rep-maxes')}
                            className="flex-1 rounded-2xl bg-amber px-4 py-3 font-semibold text-white"
                        >
                            Update now
                        </button>
                        <button
                            onClick={() => void handleSnoozeOneRepMaxPrompt()}
                            disabled={savingPromptState}
                            className="flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-secondary disabled:opacity-50"
                        >
                            <TimerReset size={15} />
                            7 days
                        </button>
                    </div>
                </div>
            )}

            {!loadingWorkouts && !hasWorkoutHistory ? (
                <div className="glass rounded-[28px] p-5 animate-fade-in stagger-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Progress</p>
                    <h2 className="mt-2 text-xl font-bold text-text-primary">{progressEmptyState.title}</h2>
                    <p className="mt-2 text-sm text-text-secondary">{progressEmptyState.detail}</p>
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={handlePrimaryAction}
                            className="flex-1 rounded-2xl gradient-primary px-4 py-3 text-sm font-semibold text-white"
                        >
                            {progressEmptyState.ctaLabel}
                        </button>
                        <button
                            onClick={() => navigate('/community')}
                            className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary"
                        >
                            Circle
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="glass rounded-[28px] p-4 animate-fade-in stagger-2 min-w-0">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-text-primary">Weekly progress</h3>
                            <span className="text-xs text-text-muted">{trendInsights.last7Count}/7 sessions</span>
                        </div>
                        <div ref={chartContainerRef} className="h-36 w-full min-w-0">
                            {isChartReady ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                                    <BarChart data={chartData} barSize={26}>
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} />
                                        <YAxis hide allowDecimals={false} />
                                        <Tooltip
                                            cursor={false}
                                            contentStyle={{
                                                background: '#ffffff',
                                                border: '1px solid #dfe8d8',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                color: '#172119',
                                                boxShadow: '0 12px 32px rgba(23,33,25,0.08)',
                                            }}
                                        />
                                        <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Workouts">
                                            {chartData.map((entry, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={entry.count > 0 ? '#2563eb' : 'rgba(37,99,235,0.14)'}
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

                    <div className="glass rounded-[28px] p-4 animate-fade-in stagger-2">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-text-primary">Strength trends</h3>
                            <span className="text-xs text-text-muted">{trendInsights.last7Count}/7 sessions</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-bg-surface p-3">
                                <p className="text-[11px] uppercase tracking-wide text-text-muted">Volume</p>
                                <p className="mt-1 text-lg font-bold">{trendInsights.lastVolume}</p>
                                <p className={`mt-1 text-xs ${trendInsights.volumeDeltaPct >= 0 ? 'text-green' : 'text-red'}`}>
                                    {trendInsights.volumeDeltaPct >= 0 ? '+' : ''}{trendInsights.volumeDeltaPct}% vs last week
                                </p>
                            </div>
                            <div className="rounded-2xl bg-bg-surface p-3">
                                <p className="text-[11px] uppercase tracking-wide text-text-muted">Avg duration</p>
                                <p className="mt-1 text-lg font-bold">{formatDurationHuman(trendInsights.currentAvgDuration)}</p>
                                <p className={`mt-1 text-xs ${trendInsights.durationDeltaPct >= 0 ? 'text-amber' : 'text-cyan'}`}>
                                    {trendInsights.durationDeltaPct >= 0 ? '+' : ''}{trendInsights.durationDeltaPct}% vs last week
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 rounded-2xl bg-bg-surface p-3">
                            <p className="text-[11px] uppercase tracking-wide text-text-muted">Top lift in the last 30 days</p>
                            <p className="mt-1 text-sm font-semibold">{trendInsights.topExerciseName}</p>
                            <p className="mt-1 text-xs text-text-secondary">{trendInsights.topExerciseVolume} kg·reps</p>
                        </div>
                    </div>
                </>
            )}

            {progressionInsight && (
                <div className="glass rounded-[28px] p-4 animate-fade-in stagger-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-cyan font-semibold">Next progression</p>
                            <h3 className="mt-1 text-base font-bold">{progressionInsight.exerciseName}</h3>
                        </div>
                        <button
                            onClick={() => navigate('/workout')}
                            className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-text-secondary"
                        >
                            Open planner
                        </button>
                    </div>
                    <p className="mt-3 text-xl font-black">{formatProgressionInsightTarget(progressionInsight)}</p>
                    <p className="mt-1 text-xs text-text-secondary">{progressionInsight.reason}</p>
                </div>
            )}

            {challenges.length > 0 && (
                <div className="animate-fade-in stagger-3">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-text-primary">Active challenges</h3>
                        <button onClick={() => navigate('/challenges')} className="text-xs font-medium text-accent">
                            View all
                        </button>
                    </div>
                    <div className="space-y-3">
                        {challenges.slice(0, 2).map((c) => {
                            const pct = Math.min(100, Math.round((c.currentCount / c.targetCount) * 100));
                            return (
                                <div key={c.id} className="glass rounded-[24px] p-4">
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Trophy size={16} className="text-amber" />
                                            <span className="text-sm font-medium">{c.title}</span>
                                        </div>
                                        <span className="text-xs text-text-muted">
                                            {c.currentCount}/{c.targetCount}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-input">
                                        <div
                                            className="h-full rounded-full gradient-primary transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="glass rounded-[28px] p-4 animate-fade-in stagger-4">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary">Food today</h3>
                    <button onClick={() => navigate('/nutrition')} className="text-xs font-medium text-accent">
                        Log food
                    </button>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{todayCalories}</span>
                    <span className="text-sm text-text-muted">kcal</span>
                </div>
                <div className="mt-2 flex gap-4">
                    <MacroPill label="Protein" value={todayNutrition.protein} color="text-cyan" />
                    <MacroPill label="Carbs" value={todayNutrition.carbs} color="text-amber" />
                    <MacroPill label="Fat" value={todayNutrition.fat} color="text-red" />
                </div>
            </div>

            {workouts.length > 0 && (
                <div className="animate-fade-in stagger-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-text-primary">Recent sessions</h3>
                        <button
                            onClick={() => navigate('/history')}
                            className="text-xs font-medium text-accent"
                        >
                            Open calendar
                        </button>
                    </div>
                    <div className="space-y-2">
                        {workouts.slice(0, 3).map((w) => (
                            <button
                                key={w.id}
                                onClick={() => navigate(`/history/${w.id}`)}
                                className="glass flex w-full items-center gap-3 rounded-[24px] p-4 text-left"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10">
                                    <Dumbbell size={18} className="text-accent" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {getWorkoutHeadline(w)}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        {formatDurationHuman(w.duration)} • {formatRelativeTime(w.startedAt)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-text-muted">{w.exercises.length} ex</span>
                                    <ChevronRight size={16} className="text-text-muted" />
                                </div>
                            </button>
                        ))}
                    </div>
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
