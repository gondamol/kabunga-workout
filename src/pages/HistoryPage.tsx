import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, ChevronLeft, ChevronRight, Flame, Trash2,
    Trophy, TrendingUp, Clock, Dumbbell, BarChart2,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { deleteWorkout, getUserWorkouts } from '../lib/firestoreService';
import { getWeeklyReadinessTrend } from '../lib/healthCheckService';
import type { Exercise, WorkoutSession, ReadinessTrendPoint } from '../lib/types';
import { formatDurationHuman } from '../lib/utils';
import { getWorkoutHeadline, shareWorkoutPeriodImage } from '../lib/workoutSummary';
import { formatEffortValue, formatSetPerformance } from '../lib/exerciseRules';
import toast from 'react-hot-toast';

const weekHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getWeekStart = (date: Dayjs): Dayjs => {
    return date.startOf('day').subtract((date.day() + 6) % 7, 'day');
};

const getDateKey = (date: Dayjs): string => date.format('YYYY-MM-DD');

const isPrimaryDay = (date: Dayjs): boolean => {
    const day = date.day();
    return day === 1 || day === 3 || day === 5;
};

const isTrainingDay = (date: Dayjs): boolean => date.day() !== 0;

const buildCalendarDays = (month: Dayjs): Array<Dayjs | null> => {
    const firstDay = month.startOf('month');
    const offset = (firstDay.day() + 6) % 7;
    const totalDays = month.daysInMonth();
    const days: Array<Dayjs | null> = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(month.date(d));
    return days;
};

const getSessionSetCount = (session: WorkoutSession): number =>
    session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

const getExerciseVolume = (exercise: Exercise): number =>
    exercise.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

const getSessionVolume = (session: WorkoutSession): number =>
    session.exercises.reduce((sum, ex) => sum + getExerciseVolume(ex), 0);

// SVG donut chart helper
function DonutChart({ value, max, label, color = '#17452a', track = '#dcefd8' }: {
    value: number; max: number; label: string; color?: string; track?: string;
}) {
    const r = 54;
    const circ = 2 * Math.PI * r;
    const pct = max > 0 ? Math.min(value / max, 1) : 0;
    const dash = pct * circ;
    return (
        <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r={r} fill="none" stroke={track} strokeWidth="12" />
            <circle
                cx="60" cy="60" r={r} fill="none"
                stroke={color} strokeWidth="12"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
            />
            <text x="60" y="55" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#0f1f14" fontFamily="Outfit, sans-serif">{value}</text>
            <text x="60" y="72" textAnchor="middle" fontSize="9" fill="#4a6358" fontFamily="Manrope, sans-serif">{label}</text>
        </svg>
    );
}

// SVG mini line chart
function TrendChart({ points, color = '#17452a' }: { points: (number | null)[]; color?: string }) {
    const h = 60;
    const w = 180;
    const valid = points.filter((p): p is number => p !== null);
    const minV = valid.length ? Math.min(...valid) : 0;
    const maxV = valid.length ? Math.max(...valid) : 100;
    const range = Math.max(maxV - minV, 20);

    const toY = (v: number) => h - ((v - minV) / range) * (h - 10) - 5;
    const toX = (i: number) => (i / (points.length - 1)) * w;

    const pathParts: string[] = [];
    let started = false;
    for (let i = 0; i < points.length; i++) {
        if (points[i] === null) { started = false; continue; }
        const x = toX(i);
        const y = toY(points[i] as number);
        pathParts.push(started ? `L ${x} ${y}` : `M ${x} ${y}`);
        started = true;
    }
    const d = pathParts.join(' ');

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }}>
            {d && <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((p, i) => p !== null && (
                <circle key={i} cx={toX(i)} cy={toY(p)} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />
            ))}
        </svg>
    );
}

export default function HistoryPage() {
    const { user, profile } = useAuthStore();
    const navigate = useNavigate();
    const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
    const [month, setMonth] = useState(dayjs().startOf('month'));
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [readinessTrend, setReadinessTrend] = useState<ReadinessTrendPoint[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const [sharingPeriod, setSharingPeriod] = useState<'week' | 'month' | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);

    useEffect(() => {
        if (!user) return undefined;
        let cancelled = false;
        setLoadingHistory(true);
        getUserWorkouts(user.uid, 120)
            .then((sessions) => { if (!cancelled) setWorkouts(sessions); })
            .catch(() => { if (!cancelled) toast.error('Could not load workout history'); })
            .finally(() => { if (!cancelled) setLoadingHistory(false); });
        return () => { cancelled = true; };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const weekStart = getWeekStart(dayjs()).format('YYYY-MM-DD');
        getWeeklyReadinessTrend(user.uid, weekStart)
            .then(setReadinessTrend)
            .catch(() => { /* silently ignore */ });
    }, [user]);

    const workoutsByDate = useMemo(() => {
        const grouped = workouts.reduce<Record<string, WorkoutSession[]>>((acc, workout) => {
            const key = dayjs(workout.startedAt).format('YYYY-MM-DD');
            if (!acc[key]) acc[key] = [];
            acc[key].push(workout);
            return acc;
        }, {});
        Object.values(grouped).forEach((sessions) => sessions.sort((a, b) => b.startedAt - a.startedAt));
        return grouped;
    }, [workouts]);

    const currentTrainingStreak = useMemo(() => {
        let streak = 0;
        let cursor = dayjs().startOf('day');
        while (true) {
            if (!isTrainingDay(cursor)) { cursor = cursor.subtract(1, 'day'); continue; }
            if (!(workoutsByDate[getDateKey(cursor)] || []).length) break;
            streak++;
            cursor = cursor.subtract(1, 'day');
        }
        return streak;
    }, [workoutsByDate]);

    const currentWeekWindow = useMemo(() => {
        const start = getWeekStart(dayjs());
        return { start, end: start.add(6, 'day').endOf('day') };
    }, []);

    const weekWorkouts = useMemo(() =>
        workouts.filter((w) => w.startedAt >= currentWeekWindow.start.valueOf() && w.startedAt <= currentWeekWindow.end.valueOf()),
        [currentWeekWindow, workouts]);

    const monthWorkouts = useMemo(() => {
        const ms = month.startOf('month').valueOf();
        const me = month.endOf('month').valueOf();
        return workouts.filter((w) => w.startedAt >= ms && w.startedAt <= me);
    }, [month, workouts]);

    const periodWorkouts = period === 'weekly' ? weekWorkouts : monthWorkouts;

    const totalMinutes = Math.round(periodWorkouts.reduce((s, w) => s + w.duration, 0) / 60);
    const activityPoints = periodWorkouts.length * 80 + currentTrainingStreak * 30;

    const weekConsistencyDots = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const day = currentWeekWindow.start.add(i, 'day');
            const key = getDateKey(day);
            const hasWorkout = (workoutsByDate[key] || []).length > 0;
            return { day, hasWorkout, isToday: day.isSame(dayjs(), 'day') };
        });
    }, [currentWeekWindow, workoutsByDate]);

    const weeklyCompletedCount = weekConsistencyDots.filter((d) => d.hasWorkout).length;
    const weeklyConsistencyPct = Math.round((weeklyCompletedCount / 6) * 100);

    const topExercises = useMemo(() => {
        const map: Record<string, number> = {};
        for (const session of workouts) {
            for (const ex of session.exercises) {
                map[ex.name] = (map[ex.name] || 0) + Math.round(ex.sets.reduce((s, set) => s + set.reps, 0));
            }
        }
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
    }, [workouts]);

    const achievements = useMemo(() => {
        const list: { icon: string; title: string; desc: string }[] = [];
        if (currentTrainingStreak >= 3) {
            list.push({ icon: '🔥', title: `${currentTrainingStreak} Day Streak`, desc: 'Keep it up! Consistency is building unstoppable momentum.' });
        }
        if (monthWorkouts.length >= 4) {
            list.push({ icon: '🏋️', title: 'Workout Warrior', desc: `Completed ${monthWorkouts.length} workouts this month. Incredible!` });
        }
        if (currentTrainingStreak >= 7) {
            list.push({ icon: '⭐', title: 'Week Champion', desc: 'Trained every single day for a week. Elite dedication.' });
        }
        if (workouts.length >= 10) {
            list.push({ icon: '🏆', title: 'Milestone: 10 Workouts', desc: 'You have completed 10 workouts. The journey continues!' });
        }
        return list.slice(0, 2);
    }, [currentTrainingStreak, monthWorkouts.length, workouts.length]);

    const personalBests = useMemo(() => {
        const maxMonthlyWorkouts = (() => {
            const countByMonth: Record<string, number> = {};
            for (const w of workouts) {
                const key = dayjs(w.startedAt).format('YYYY-MM');
                countByMonth[key] = (countByMonth[key] || 0) + 1;
            }
            return Math.max(0, ...Object.values(countByMonth));
        })();
        const maxWeeklyMinutes = (() => {
            const groups: Record<string, number> = {};
            for (const w of workouts) {
                const key = getWeekStart(dayjs(w.startedAt)).format('YYYY-MM-DD');
                groups[key] = (groups[key] || 0) + w.duration;
            }
            return Math.round(Math.max(0, ...Object.values(groups)) / 60);
        })();
        return { maxMonthlyWorkouts, maxWeeklyMinutes };
    }, [workouts]);

    const readinessTrendPoints = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => readinessTrend[i]?.score ?? null),
        [readinessTrend]);

    const avgReadiness = useMemo(() => {
        const valid = readinessTrendPoints.filter((p): p is number => p !== null);
        return valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null;
    }, [readinessTrendPoints]);

    const days = useMemo(() => buildCalendarDays(month), [month]);

    const selectedSessions = selectedDate ? (workoutsByDate[selectedDate] || []) : [];
    const selectedSession = useMemo(() => {
        if (!selectedSessions.length) return null;
        if (!selectedSessionId) return selectedSessions[0];
        return selectedSessions.find((s) => s.id === selectedSessionId) ?? selectedSessions[0];
    }, [selectedSessions, selectedSessionId]);

    const selectedSessionEffort = useMemo(() => {
        if (!selectedSession) return null;
        const totalReps = selectedSession.exercises.reduce(
            (sum, ex) => sum + ex.sets.reduce((ss, s) => ss + (s.reps || 0), 0), 0);
        return formatEffortValue(Math.round(getSessionVolume(selectedSession)), totalReps);
    }, [selectedSession]);

    useEffect(() => {
        if (!selectedDate || !selectedSessions.length) { setSelectedSessionId(null); return; }
        if (!selectedSessionId || !selectedSessions.some((s) => s.id === selectedSessionId)) {
            setSelectedSessionId(selectedSessions[0].id);
        }
    }, [selectedDate, selectedSessions, selectedSessionId]);

    const oldestLoadedWorkoutDay = useMemo(() => {
        if (!workouts.length) return null;
        const oldest = workouts.reduce((min, w) => Math.min(min, w.startedAt), workouts[0].startedAt);
        return dayjs(oldest).startOf('day');
    }, [workouts]);

    const handleSharePeriod = async (p: 'week' | 'month') => {
        const data = p === 'week' ? weekWorkouts : monthWorkouts;
        if (!data.length) { toast.error(p === 'week' ? 'No workouts to share this week' : 'No workouts to share this month'); return; }
        setSharingPeriod(p);
        try {
            const result = await shareWorkoutPeriodImage(data, {
                athleteName: profile?.displayName,
                periodLabel: p === 'week' ? 'This Week' : month.format('MMMM'),
                title: p === 'week' ? 'Weekly Training Recap' : `${month.format('MMMM')} Training Recap`,
                subtitle: p === 'week'
                    ? `${currentWeekWindow.start.format('MMM D')} - ${currentWeekWindow.end.format('MMM D, YYYY')}`
                    : month.format('MMMM YYYY'),
                filenameLabel: p === 'week' ? 'weekly-recap' : `${month.format('YYYY-MM')}-recap`,
            });
            toast.success(result === 'shared' ? 'Period share card ready' : 'Period share card downloaded');
        } catch (error) {
            if ((error as Error)?.name !== 'AbortError') toast.error('Could not export period recap');
        } finally { setSharingPeriod(null); }
    };

    const handleDeleteWorkout = async (session: WorkoutSession) => {
        if (!user || !confirm('Delete this workout from history? This cannot be undone.')) return;
        setDeletingSessionId(session.id);
        try {
            await deleteWorkout(session.id, user.uid);
            setWorkouts((curr) => curr.filter((w) => w.id !== session.id));
            toast.success('Workout deleted');
        } catch {
            toast.error('Failed to delete workout');
        } finally { setDeletingSessionId(null); }
    };

    const getDotClass = (date: Dayjs): string => {
        const key = getDateKey(date);
        const hasWorkout = (workoutsByDate[key] || []).length > 0;
        if (hasWorkout && isTrainingDay(date)) return isPrimaryDay(date) ? 'bg-green' : 'bg-cyan';
        if (date.isBefore(dayjs(), 'day') && isPrimaryDay(date) && (!oldestLoadedWorkoutDay || !date.isBefore(oldestLoadedWorkoutDay, 'day')))
            return 'bg-red';
        return '';
    };

    const dateRangeLabel = period === 'weekly'
        ? `${currentWeekWindow.start.format('MMM D')} – ${currentWeekWindow.end.format('MMM D, YYYY')}`
        : month.format('MMMM YYYY');

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">

            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#17452a' }}>
                        <Dumbbell size={14} color="white" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-text-muted">Kabunga Workout</span>
                </div>
                <h1 className="font-display text-3xl font-extrabold text-text-primary leading-tight">Your Progress</h1>
                <p className="text-sm text-text-secondary mt-1">Track your journey and celebrate wins.</p>

                {/* Period toggle + date range */}
                <div className="flex items-center justify-between mt-4">
                    <div className="flex rounded-xl overflow-hidden border border-border">
                        <button
                            onClick={() => setPeriod('weekly')}
                            className="px-4 py-1.5 text-sm font-semibold transition-colors"
                            style={{ background: period === 'weekly' ? '#17452a' : 'transparent', color: period === 'weekly' ? 'white' : undefined }}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setPeriod('monthly')}
                            className="px-4 py-1.5 text-sm font-semibold transition-colors"
                            style={{ background: period === 'monthly' ? '#17452a' : 'transparent', color: period === 'monthly' ? 'white' : undefined }}
                        >
                            Monthly
                        </button>
                    </div>
                    <span className="text-xs text-text-secondary font-medium">{dateRangeLabel}</span>
                </div>
            </div>

            {/* 4 Metric cards */}
            <div className="grid grid-cols-4 gap-2">
                {[
                    { label: 'Workouts', value: periodWorkouts.length, sub: period === 'weekly' ? 'this week' : 'this month', icon: <Dumbbell size={14} /> },
                    { label: 'Minutes', value: totalMinutes, sub: 'active', icon: <Clock size={14} /> },
                    { label: 'Day Streak', value: currentTrainingStreak, sub: 'days', icon: <Flame size={14} /> },
                    { label: 'Points', value: activityPoints, sub: 'activity', icon: <Trophy size={14} /> },
                ].map((m) => (
                    <div key={m.label} className="rounded-2xl bg-bg-card p-3 flex flex-col gap-1.5">
                        <div className="text-primary/70">{m.icon}</div>
                        <p className="font-display text-lg font-extrabold text-text-primary leading-none">{m.value}</p>
                        <p className="text-[10px] text-text-muted leading-tight">{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Volume + Readiness row */}
            <div className="grid grid-cols-2 gap-3">
                {/* Workout Volume donut */}
                <div className="rounded-3xl bg-bg-card p-4">
                    <p className="text-xs font-semibold text-text-secondary mb-2">Workout Volume</p>
                    <p className="text-[10px] text-text-muted mb-2">This {period === 'weekly' ? 'week' : 'month'}</p>
                    <div className="w-28 h-28 mx-auto">
                        <DonutChart
                            value={totalMinutes}
                            max={Math.max(totalMinutes, period === 'weekly' ? 300 : 1200)}
                            label="min"
                            color="#17452a"
                            track="#dcefd8"
                        />
                    </div>
                    <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px]">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#17452a' }} />
                            <span className="text-text-secondary">Strength: {Math.round(totalMinutes * 0.83)} min</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#9bd93c' }} />
                            <span className="text-text-secondary">Mobility: {Math.round(totalMinutes * 0.17)} min</span>
                        </div>
                    </div>
                </div>

                {/* Readiness Trend */}
                <div className="rounded-3xl bg-bg-card p-4">
                    <p className="text-xs font-semibold text-text-secondary mb-1">Readiness Trend</p>
                    <p className="text-[10px] text-text-muted mb-2">This week</p>
                    {avgReadiness !== null ? (
                        <p className="font-display text-3xl font-extrabold text-text-primary leading-none mb-1">{avgReadiness}</p>
                    ) : (
                        <p className="font-display text-3xl font-extrabold text-text-muted leading-none mb-1">—</p>
                    )}
                    <p className="text-[10px] text-text-muted mb-3">Average Readiness</p>
                    <TrendChart points={readinessTrendPoints} color="#17452a" />
                    <div className="flex justify-between mt-1">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                            <span key={i} className="text-[9px] text-text-muted">{d}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Weekly Consistency */}
            <div className="rounded-3xl bg-bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm font-semibold text-text-primary">Weekly Consistency</p>
                        <p className="text-[11px] text-text-muted">Workouts completed</p>
                    </div>
                    <div className="text-right">
                        <p className="font-display text-xl font-extrabold text-text-primary">{weeklyConsistencyPct}%</p>
                        <p className="text-[10px] text-text-muted">{weeklyCompletedCount} of 6 days</p>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {weekConsistencyDots.map(({ day, hasWorkout, isToday }, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-text-muted">{weekHeaders[i]}</span>
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={{
                                    background: hasWorkout ? '#17452a' : isToday ? '#e8f5e9' : '#f0f4f0',
                                    border: isToday ? '2px solid #9bd93c' : 'none',
                                }}
                            >
                                {hasWorkout && <span className="text-white text-[10px]">✓</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Achievements + Top Exercises */}
            <div className="grid grid-cols-2 gap-3">
                {/* Recent Achievements */}
                <div className="rounded-3xl bg-bg-card p-4">
                    <p className="text-xs font-semibold text-text-secondary mb-3">Recent Achievements</p>
                    <div className="space-y-3">
                        {achievements.length === 0 ? (
                            <p className="text-[11px] text-text-muted">Complete more workouts to unlock achievements!</p>
                        ) : achievements.map((ach, i) => (
                            <div key={i} className="flex gap-2">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: '#e8f5e9' }}>
                                    {ach.icon}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-text-primary">{ach.title}</p>
                                    <p className="text-[10px] text-text-muted leading-snug line-clamp-2">{ach.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="mt-3 text-[11px] font-semibold text-primary">View all achievements</button>
                </div>

                {/* Top Exercises */}
                <div className="rounded-3xl bg-bg-card p-4">
                    <p className="text-xs font-semibold text-text-secondary mb-3">Top Exercises</p>
                    <div className="space-y-3">
                        {topExercises.length === 0 ? (
                            <p className="text-[11px] text-text-muted">Log workouts to see your top exercises.</p>
                        ) : topExercises.map(([name, reps], i) => (
                            <div key={name} className="flex items-center gap-2">
                                <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                    style={{ background: '#17452a' }}
                                >
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-text-primary truncate">{name}</p>
                                    <p className="text-[10px] text-text-muted">{reps} reps</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="mt-3 text-[11px] font-semibold text-primary">View all exercises</button>
                </div>
            </div>

            {/* Personal Bests */}
            <div>
                <p className="text-sm font-semibold text-text-primary mb-3">Personal Bests</p>
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { label: 'Monthly\nWorkouts', value: personalBests.maxMonthlyWorkouts, unit: '' },
                        { label: 'Weekly\nMinutes', value: personalBests.maxWeeklyMinutes, unit: 'min' },
                        { label: 'Activity\nPoints', value: activityPoints, unit: '' },
                        { label: 'Longest\nStreak', value: currentTrainingStreak, unit: 'days' },
                    ].map((pb) => (
                        <div key={pb.label} className="rounded-2xl bg-bg-card p-3 text-center">
                            <p className="font-display text-lg font-extrabold text-text-primary">{pb.value}</p>
                            {pb.unit && <p className="text-[9px] text-text-muted">{pb.unit}</p>}
                            <p className="text-[9px] text-text-muted leading-tight whitespace-pre-line">{pb.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Calendar toggle */}
            <button
                onClick={() => setShowCalendar((v) => !v)}
                className="w-full rounded-2xl bg-bg-card border border-border py-3 flex items-center justify-center gap-2 text-sm font-semibold text-text-secondary"
            >
                <Calendar size={16} />
                {showCalendar ? 'Hide' : 'View'} Training Calendar
            </button>

            {showCalendar && (
                <div className="rounded-3xl bg-bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <button onClick={() => setMonth((prev) => prev.subtract(1, 'month'))} className="w-9 h-9 rounded-xl bg-bg-surface flex items-center justify-center">
                            <ChevronLeft size={16} />
                        </button>
                        <h2 className="font-semibold text-sm">{month.format('MMMM YYYY')}</h2>
                        <button onClick={() => setMonth((prev) => prev.add(1, 'month'))} className="w-9 h-9 rounded-xl bg-bg-surface flex items-center justify-center">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-[11px] text-text-muted">
                        {weekHeaders.map((d) => <p key={d} className="text-center">{d}</p>)}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {days.map((date, idx) => {
                            if (!date) return <div key={`empty-${idx}`} className="aspect-square" />;
                            const dateKey = getDateKey(date);
                            const isToday = date.isSame(dayjs(), 'day');
                            const dotClass = getDotClass(date);
                            const inMonth = date.month() === month.month();
                            return (
                                <button
                                    key={dateKey}
                                    onClick={() => setSelectedDate(dateKey)}
                                    className={`aspect-square rounded-xl p-1 border text-xs relative ${isToday ? 'border-accent' : 'border-border'} ${inMonth ? 'bg-bg-surface' : 'bg-bg-surface text-text-muted opacity-50'}`}
                                >
                                    <span>{date.date()}</span>
                                    {dotClass && <span className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-1.5 h-1.5 rounded-full ${dotClass}`} />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="text-xs text-text-muted grid grid-cols-2 gap-2">
                        <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green" />Primary completed</p>
                        <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan" />Secondary completed</p>
                        <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red" />Missed primary day</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { void handleSharePeriod('week'); }} disabled={sharingPeriod !== null} className="rounded-xl bg-bg-surface border border-border py-2.5 text-sm font-medium text-text-secondary">
                            {sharingPeriod === 'week' ? 'Preparing...' : 'Share week'}
                        </button>
                        <button onClick={() => { void handleSharePeriod('month'); }} disabled={sharingPeriod !== null} className="rounded-xl bg-bg-surface border border-border py-2.5 text-sm font-medium text-text-secondary">
                            {sharingPeriod === 'month' ? `Sharing ${month.format('MMM')}` : `Share ${month.format('MMM')}`}
                        </button>
                    </div>
                </div>
            )}

            {/* Session detail modal */}
            {selectedDate && (
                <div className="fixed inset-0 z-[80] bg-black/60 flex items-end" onClick={() => setSelectedDate(null)}>
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl p-5 animate-slide-up max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold">{dayjs(selectedDate).format('ddd, MMM D')}</h3>
                            <button onClick={() => setSelectedDate(null)} className="text-xs text-text-muted px-3 py-1 rounded-lg bg-bg-card">Close</button>
                        </div>

                        {selectedSessions.length === 0 ? (
                            <div className="rounded-2xl bg-bg-card p-4 text-sm text-text-secondary">No completed workout for this day.</div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-2xl bg-bg-card p-4">
                                    <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Sessions</p>
                                    <div className="space-y-2">
                                        {selectedSessions.map((session) => {
                                            const isSelected = selectedSession?.id === session.id;
                                            return (
                                                <div key={session.id} className={`rounded-xl border transition-colors ${isSelected ? 'border-accent bg-accent/10' : 'border-border bg-bg-surface'}`}>
                                                    <div className="flex items-center gap-2 p-2">
                                                        <button onClick={() => setSelectedSessionId(session.id)} className="flex-1 text-left">
                                                            <p className="text-sm font-semibold">{dayjs(session.startedAt).format('h:mm A')} • {formatDurationHuman(session.duration)}</p>
                                                            <p className="text-xs text-text-secondary mt-1">{session.exercises.length} exercises • {getSessionSetCount(session)} sets</p>
                                                            <p className="text-xs text-text-muted mt-1 line-clamp-1">{getWorkoutHeadline(session) || 'No exercises logged'}</p>
                                                        </button>
                                                        <button onClick={() => navigate(`/history/${session.id}`)} className="px-3 h-9 rounded-lg border border-border text-xs text-text-secondary">Open</button>
                                                        <button
                                                            onClick={() => { void handleDeleteWorkout(session); }}
                                                            disabled={deletingSessionId === session.id}
                                                            className="w-9 h-9 rounded-lg border border-red/30 text-red hover:bg-red/10 disabled:opacity-40 flex items-center justify-center"
                                                            aria-label="Delete workout"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {selectedSession && (
                                    <>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Duration', value: formatDurationHuman(selectedSession.duration) },
                                                { label: 'Exercises', value: selectedSession.exercises.length },
                                                { label: selectedSessionEffort?.unit === 'kg·reps' ? 'Volume' : 'Reps', value: selectedSessionEffort?.value || '0' },
                                            ].map((m) => (
                                                <div key={m.label} className="rounded-2xl bg-bg-card p-3">
                                                    <p className="text-xs text-text-muted">{m.label}</p>
                                                    <p className="text-sm font-semibold mt-1">{m.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-2xl bg-bg-card p-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs text-text-muted uppercase tracking-wide">Session Notes</p>
                                                <button onClick={() => navigate(`/history/${selectedSession.id}`)} className="text-xs text-accent font-medium">Full Summary</button>
                                            </div>
                                            <p className="text-sm text-text-secondary whitespace-pre-wrap">
                                                {selectedSession.notes?.trim() || 'No notes saved for this session.'}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl bg-bg-card p-4 space-y-3">
                                            <p className="text-xs text-text-muted uppercase tracking-wide">Exercise Details</p>
                                            {selectedSession.exercises.length === 0 ? (
                                                <p className="text-sm text-text-secondary">No exercises logged for this session.</p>
                                            ) : selectedSession.exercises.map((exercise) => {
                                                const vol = Math.round(getExerciseVolume(exercise));
                                                const reps = exercise.sets.reduce((s, set) => s + (set.reps || 0), 0);
                                                const effort = formatEffortValue(vol, reps);
                                                return (
                                                    <div key={exercise.id} className="rounded-xl bg-bg-surface p-3 border border-border">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-sm font-semibold">{exercise.name}</p>
                                                            <p className="text-xs text-text-muted">{exercise.sets.length} sets • {effort.value} {effort.unit}</p>
                                                        </div>
                                                        <div className="mt-2 space-y-1">
                                                            {exercise.sets.map((setItem, idx) => (
                                                                <p key={setItem.id} className="text-xs text-text-secondary">
                                                                    Set {idx + 1}: {formatSetPerformance(setItem.weight, setItem.reps)}{setItem.completed ? ' ✓' : ''}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
