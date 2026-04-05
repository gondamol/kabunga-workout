import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { getRecentWorkouts, getActiveChallenges, getMealsByDate, getOneRepMaxes, updateUserProfile } from '../lib/firestoreService';
import { formatDurationHuman, formatRelativeTime, getTodayKey, getDaysInRange } from '../lib/utils';
import { enqueueAction } from '../lib/offlineQueue';
import { calculateReadinessScore, getAthleteReadiness, getHealthCheck, saveHealthCheck } from '../lib/healthCheckService';
import type { WorkoutSession, Challenge, Meal, OneRepMaxes, HealthCheck, ReadinessScore, ReadinessStatus } from '../lib/types';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Dumbbell, Flame, Clock, TrendingUp, ChevronRight, Zap, Trophy, Plus, BarChart3, TimerReset } from 'lucide-react';
import dayjs from 'dayjs';
import { getOneRepMaxPromptStatus, getOneRepMaxSnoozeUntil } from '../lib/oneRepMaxes';
import { formatProgressionInsightTarget, getDashboardProgressionInsight } from '../lib/progressionInsights';
import { getWorkoutHeadline } from '../lib/workoutSummary';
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

export default function DashboardPage() {
    const { user, profile } = useAuthStore();
    const { activeSession, loadRepeatWorkout } = useWorkoutStore();
    const navigate = useNavigate();
    const todayKey = getTodayKey();

    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
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
            try {
                const [w, c, m, maxes, healthCheck, readiness] = await Promise.all([
                    getRecentWorkouts(user.uid, 120),
                    getActiveChallenges(user.uid),
                    getMealsByDate(user.uid, todayKey),
                    getOneRepMaxes(user.uid),
                    getHealthCheck(user.uid, todayKey),
                    getAthleteReadiness(user.uid, todayKey),
                ]);
                setWorkouts(w);
                setChallenges(c);
                setTodayMeals(m);
                setOneRepMaxes(maxes);
                setTodayHealthCheck(healthCheck);
                setTodayReadiness(readiness);
                setShowHealthForm(!healthCheck);
            } catch (err) {
                console.warn('Failed to load dashboard data:', err);
            } finally {
                setLoadingWorkouts(false);
            }
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

    const todayCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0);

    const firstName = profile?.displayName?.split(' ')[0] || 'Champion';

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
                <p className="text-text-secondary text-sm">
                    {dayjs().format('dddd, MMM D')}
                </p>
                <h1 className="text-2xl font-bold mt-1">
                    Hey, <span className="gradient-text">{firstName}</span> 👋
                </h1>
            </div>

            {/* Active session banner */}
            {activeSession && (
                <button
                    id="resume-workout-btn"
                    onClick={() => navigate('/active-workout')}
                    className="w-full glass rounded-2xl p-4 flex items-center gap-3 animate-pulse-glow"
                >
                    <div className="w-12 h-12 rounded-xl bg-green/20 flex items-center justify-center">
                        <Zap size={24} className="text-green" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-semibold text-green">Workout in progress</p>
                        <p className="text-xs text-text-secondary">{activeSession.exercises.length} exercises — tap to resume</p>
                    </div>
                    <ChevronRight size={20} className="text-text-muted" />
                </button>
            )}

            {(showHealthForm || !todayHealthCheck || !todayReadiness) ? (
                <HealthCheckForm
                    athleteId={user?.uid || ''}
                    date={todayKey}
                    initialValue={todayHealthCheck}
                    saving={savingHealthCheck}
                    onComplete={handleSaveHealthCheck}
                    onCancel={todayHealthCheck ? () => setShowHealthForm(false) : undefined}
                />
            ) : (
                todayReadiness && readinessTone && (
                    <div className={`rounded-3xl border bg-gradient-to-br ${readinessTone.surface} ${readinessTone.border} p-5 animate-fade-in`}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Daily Readiness</p>
                                <h2 className="text-lg font-bold mt-1">Score {todayReadiness.score}/10</h2>
                                <p className="text-sm text-text-secondary mt-2">
                                    {todayReadiness.warnings.length > 0
                                        ? todayReadiness.warnings.join(' • ')
                                        : 'No recovery flags reported today.'}
                                </p>
                            </div>
                            <div className={`rounded-2xl px-3 py-2 text-sm font-semibold ${readinessTone.badge}`}>
                                {readinessTone.label}
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {todayReadiness.recommendations.slice(0, 2).map((recommendation) => (
                                <span
                                    key={recommendation}
                                    className="rounded-full border border-border bg-bg-surface px-3 py-1 text-[11px] text-text-secondary"
                                >
                                    {recommendation}
                                </span>
                            ))}
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={() => setShowHealthForm(true)}
                                className="w-full py-3 rounded-2xl border border-border text-sm font-semibold text-text-primary"
                            >
                                Edit Check-In
                            </button>
                        </div>
                    </div>
                )
            )}

            {!activeSession && latestWorkout && (
                <div className="glass rounded-3xl p-5 animate-fade-in">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">Fast Lane</p>
                            <h2 className="text-lg font-bold mt-1">Repeat Last Workout</h2>
                            <p className="text-sm text-text-secondary mt-2">{getWorkoutHeadline(latestWorkout)}</p>
                        </div>
                        <div className="rounded-2xl bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan">
                            {formatRelativeTime(latestWorkout.startedAt)}
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-bg-card p-2">
                            <p className="text-[10px] text-text-muted">Exercises</p>
                            <p className="text-sm font-semibold">{latestWorkout.exercises.length}</p>
                        </div>
                        <div className="rounded-xl bg-bg-card p-2">
                            <p className="text-[10px] text-text-muted">Duration</p>
                            <p className="text-sm font-semibold">{formatDurationHuman(latestWorkout.duration)}</p>
                        </div>
                        <div className="rounded-xl bg-bg-card p-2">
                            <p className="text-[10px] text-text-muted">Calories</p>
                            <p className="text-sm font-semibold">{Math.round(latestWorkout.caloriesEstimate)}</p>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => handleRepeatLastWorkout(false)}
                            className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-text-primary"
                        >
                            Load For Edit
                        </button>
                        <button
                            onClick={() => handleRepeatLastWorkout(true)}
                            className="flex-1 py-3 rounded-2xl gradient-primary text-white text-sm font-semibold"
                        >
                            Start Now
                        </button>
                    </div>
                </div>
            )}

            {/* Start Workout CTA */}
            {!activeSession && (
                <button
                    id="start-workout-btn"
                    onClick={() => navigate('/workout')}
                    className="w-full py-5 rounded-3xl gradient-primary text-white font-bold text-lg flex items-center justify-center gap-3 active:scale-[0.97] transition-transform shadow-xl shadow-accent/25 animate-fade-in"
                >
                    <Plus size={24} strokeWidth={3} />
                    Start Workout
                </button>
            )}

            {oneRepMaxStatus.shouldPrompt && (
                <div className="rounded-3xl border border-amber/20 bg-gradient-to-br from-amber/15 via-bg-card to-bg-surface p-5 animate-fade-in">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">Performance Check</p>
                            <h2 className="text-lg font-bold mt-1">Update your 1RM</h2>
                            <p className="text-sm text-text-secondary mt-2">{oneRepMaxStatus.reason}</p>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-amber/15 flex items-center justify-center shrink-0">
                            <BarChart3 size={20} className="text-amber" />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => navigate('/profile?focus=one-rep-maxes')}
                            className="flex-1 py-3 rounded-2xl bg-amber text-bg-primary font-semibold"
                        >
                            Update Now
                        </button>
                        <button
                            onClick={() => void handleSnoozeOneRepMaxPrompt()}
                            disabled={savingPromptState}
                            className="px-4 py-3 rounded-2xl border border-border text-sm text-text-secondary flex items-center gap-2 disabled:opacity-50"
                        >
                            <TimerReset size={15} />
                            7 days
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 animate-fade-in stagger-1">
                <StatCard
                    icon={<Dumbbell size={20} className="text-accent" />}
                    label="This Week"
                    value={`${stats.weeklyWorkouts}`}
                    sub="workouts"
                />
                <StatCard
                    icon={<Flame size={20} className="text-amber" />}
                    label="Streak"
                    value={`${stats.streak}`}
                    sub="days"
                />
                <StatCard
                    icon={<Clock size={20} className="text-cyan" />}
                    label="Total Time"
                    value={formatDurationHuman(stats.totalDuration)}
                    sub="this month"
                />
                <StatCard
                    icon={<TrendingUp size={20} className="text-green" />}
                    label="Calories"
                    value={`${Math.round(stats.totalCalories)}`}
                    sub="burned (est.)"
                />
            </div>

            {/* Weekly Chart */}
            <div className="glass rounded-2xl p-4 animate-fade-in stagger-2 min-w-0">
                <h3 className="text-sm font-semibold text-text-secondary mb-4">This Week</h3>
                <div ref={chartContainerRef} className="h-36 w-full min-w-0">
                    {isChartReady ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                            <BarChart data={chartData} barSize={28}>
                                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                                <YAxis hide allowDecimals={false} />
                                <Tooltip
                                    cursor={false}
                                    contentStyle={{
                                        background: '#1a1a3e',
                                        border: '1px solid rgba(139,92,246,0.2)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        color: '#f1f5f9',
                                    }}
                                />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Workouts">
                                    {chartData.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={entry.count > 0 ? '#8b5cf6' : 'rgba(139,92,246,0.15)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full w-full rounded-xl bg-bg-card/50" />
                    )}
                </div>
            </div>

            <div className="glass rounded-2xl p-4 animate-fade-in stagger-2">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text-secondary">Strength Trends</h3>
                    <span className="text-xs text-text-muted">{trendInsights.last7Count}/7 sessions</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-bg-card p-3">
                        <p className="text-[11px] uppercase tracking-wide text-text-muted">Volume (7d)</p>
                        <p className="text-lg font-bold mt-1">{trendInsights.lastVolume}</p>
                        <p className={`text-xs mt-1 ${trendInsights.volumeDeltaPct >= 0 ? 'text-green' : 'text-red'}`}>
                            {trendInsights.volumeDeltaPct >= 0 ? '+' : ''}{trendInsights.volumeDeltaPct}% vs prior week
                        </p>
                    </div>
                    <div className="rounded-xl bg-bg-card p-3">
                        <p className="text-[11px] uppercase tracking-wide text-text-muted">Avg Duration</p>
                        <p className="text-lg font-bold mt-1">{formatDurationHuman(trendInsights.currentAvgDuration)}</p>
                        <p className={`text-xs mt-1 ${trendInsights.durationDeltaPct >= 0 ? 'text-amber' : 'text-cyan'}`}>
                            {trendInsights.durationDeltaPct >= 0 ? '+' : ''}{trendInsights.durationDeltaPct}% vs prior week
                        </p>
                    </div>
                </div>
                <div className="rounded-xl bg-bg-card p-3 mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Top Lift (30d by volume)</p>
                    <p className="text-sm font-semibold mt-1">{trendInsights.topExerciseName}</p>
                    <p className="text-xs text-text-secondary mt-1">{trendInsights.topExerciseVolume} kg·reps</p>
                </div>
            </div>

            {progressionInsight && (
                <div className="glass rounded-2xl p-4 animate-fade-in stagger-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-cyan font-semibold">Next Progression</p>
                            <h3 className="text-base font-bold mt-1">{progressionInsight.exerciseName}</h3>
                        </div>
                        <button
                            onClick={() => navigate('/workout')}
                            className="px-3 py-2 rounded-xl border border-border text-xs text-text-secondary"
                        >
                            Open Planner
                        </button>
                    </div>
                    <p className="text-xl font-black mt-3">{formatProgressionInsightTarget(progressionInsight)}</p>
                    <p className="text-xs text-text-secondary mt-1">{progressionInsight.reason}</p>
                </div>
            )}

            {/* Challenge Progress */}
            {challenges.length > 0 && (
                <div className="animate-fade-in stagger-3">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-text-secondary">Active Challenges</h3>
                        <button onClick={() => navigate('/challenges')} className="text-xs text-accent font-medium">
                            View All
                        </button>
                    </div>
                    <div className="space-y-3">
                        {challenges.slice(0, 2).map((c) => {
                            const pct = Math.min(100, Math.round((c.currentCount / c.targetCount) * 100));
                            return (
                                <div key={c.id} className="glass rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Trophy size={16} className="text-amber" />
                                            <span className="text-sm font-medium">{c.title}</span>
                                        </div>
                                        <span className="text-xs text-text-muted">
                                            {c.currentCount}/{c.targetCount}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-bg-input rounded-full overflow-hidden">
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

            {/* Nutrition Summary */}
            <div className="glass rounded-2xl p-4 animate-fade-in stagger-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-text-secondary">Today's Nutrition</h3>
                    <button onClick={() => navigate('/nutrition')} className="text-xs text-accent font-medium">
                        Log Food
                    </button>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{todayCalories}</span>
                    <span className="text-text-muted text-sm">kcal</span>
                </div>
                <div className="flex gap-4 mt-2">
                    <MacroPill label="Protein" value={todayMeals.reduce((s, m) => s + m.protein, 0)} color="text-cyan" />
                    <MacroPill label="Carbs" value={todayMeals.reduce((s, m) => s + m.carbs, 0)} color="text-amber" />
                    <MacroPill label="Fat" value={todayMeals.reduce((s, m) => s + m.fat, 0)} color="text-red" />
                </div>
            </div>

            {/* Recent Sessions */}
            {workouts.length > 0 && (
                <div className="animate-fade-in stagger-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-text-secondary">Recent Sessions</h3>
                        <button
                            onClick={() => navigate('/history')}
                            className="text-xs text-accent font-medium"
                        >
                            Open Calendar
                        </button>
                    </div>
                    <div className="space-y-2">
                        {workouts.slice(0, 3).map((w) => (
                            <button
                                key={w.id}
                                onClick={() => navigate(`/history/${w.id}`)}
                                className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left"
                            >
                                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                                    <Dumbbell size={18} className="text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
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

            {/* Empty state */}
            {!loadingWorkouts && workouts.length === 0 && !activeSession && (
                <div className="text-center py-12 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4">
                        <Dumbbell size={32} className="text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No workouts yet</h3>
                    <p className="text-text-secondary text-sm">Start your first one and track your progress.</p>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
    return (
        <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs text-text-muted">{label}</span>
            </div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-text-muted">{sub}</p>
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
