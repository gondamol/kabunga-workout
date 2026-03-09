import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Flame, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { deleteWorkout, getUserWorkouts } from '../lib/firestoreService';
import type { Exercise, WorkoutSession } from '../lib/types';
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
    const offset = (firstDay.day() + 6) % 7; // Monday-first
    const totalDays = month.daysInMonth();

    const days: Array<Dayjs | null> = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(month.date(d));
    return days;
};

const getSessionSetCount = (session: WorkoutSession): number => {
    return session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
};

const getExerciseVolume = (exercise: Exercise): number => {
    return exercise.sets.reduce((sum, setItem) => sum + setItem.weight * setItem.reps, 0);
};

const getSessionVolume = (session: WorkoutSession): number => {
    return session.exercises.reduce((sum, exercise) => sum + getExerciseVolume(exercise), 0);
};

export default function HistoryPage() {
    const { user, profile } = useAuthStore();
    const navigate = useNavigate();
    const [month, setMonth] = useState(dayjs().startOf('month'));
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const [sharingPeriod, setSharingPeriod] = useState<'week' | 'month' | null>(null);

    useEffect(() => {
        if (!user) return undefined;
        let cancelled = false;
        setLoadingHistory(true);
        getUserWorkouts(user.uid, 120)
            .then((sessions) => {
                if (cancelled) return;
                setWorkouts(sessions);
            })
            .catch((error) => {
                if (cancelled) return;
                console.warn('Failed to load workout history:', error);
                toast.error('Could not load workout history');
            })
            .finally(() => {
                if (!cancelled) setLoadingHistory(false);
            });

        return () => {
            cancelled = true;
        };
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
            if (!isTrainingDay(cursor)) {
                cursor = cursor.subtract(1, 'day');
                continue;
            }
            const hasWorkout = (workoutsByDate[getDateKey(cursor)] || []).length > 0;
            if (!hasWorkout) break;
            streak++;
            cursor = cursor.subtract(1, 'day');
        }
        return streak;
    }, [workoutsByDate]);

    const weeklyCompliance = useMemo(() => {
        const start = getWeekStart(dayjs());
        const keys = Array.from({ length: 6 }, (_, idx) => getDateKey(start.add(idx, 'day')));
        const completed = keys.filter((key) => (workoutsByDate[key] || []).length > 0).length;
        return { completed, total: 6, pct: Math.round((completed / 6) * 100) };
    }, [workoutsByDate]);

    const days = useMemo(() => buildCalendarDays(month), [month]);
    const currentWeekWindow = useMemo(() => {
        const start = getWeekStart(dayjs());
        return {
            start,
            end: start.add(6, 'day').endOf('day'),
        };
    }, []);
    const weekWorkouts = useMemo(() => {
        return workouts.filter((workout) => (
            workout.startedAt >= currentWeekWindow.start.valueOf()
            && workout.startedAt <= currentWeekWindow.end.valueOf()
        ));
    }, [currentWeekWindow.end, currentWeekWindow.start, workouts]);
    const monthWorkouts = useMemo(() => {
        const monthStart = month.startOf('month').valueOf();
        const monthEnd = month.endOf('month').valueOf();
        return workouts.filter((workout) => workout.startedAt >= monthStart && workout.startedAt <= monthEnd);
    }, [month, workouts]);

    const selectedSessions = selectedDate ? (workoutsByDate[selectedDate] || []) : [];
    const selectedSession = useMemo(() => {
        if (selectedSessions.length === 0) return null;
        if (!selectedSessionId) return selectedSessions[0];
        return selectedSessions.find((session) => session.id === selectedSessionId) ?? selectedSessions[0];
    }, [selectedSessions, selectedSessionId]);
    const selectedSessionEffort = useMemo(() => {
        if (!selectedSession) return null;
        const totalReps = selectedSession.exercises.reduce(
            (sum, exercise) => sum + exercise.sets.reduce((setSum, setItem) => setSum + (setItem.reps || 0), 0),
            0
        );
        return formatEffortValue(Math.round(getSessionVolume(selectedSession)), totalReps);
    }, [selectedSession]);

    useEffect(() => {
        if (!selectedDate) {
            setSelectedSessionId(null);
            return;
        }
        if (selectedSessions.length === 0) {
            setSelectedSessionId(null);
            return;
        }
        if (!selectedSessionId || !selectedSessions.some((session) => session.id === selectedSessionId)) {
            setSelectedSessionId(selectedSessions[0].id);
        }
    }, [selectedDate, selectedSessions, selectedSessionId]);

    const oldestLoadedWorkoutDay = useMemo(() => {
        if (workouts.length === 0) return null;
        const oldest = workouts.reduce((min, workout) => Math.min(min, workout.startedAt), workouts[0].startedAt);
        return dayjs(oldest).startOf('day');
    }, [workouts]);

    const handleSharePeriod = async (period: 'week' | 'month') => {
        const data = period === 'week' ? weekWorkouts : monthWorkouts;
        if (data.length === 0) {
            toast.error(period === 'week' ? 'No workouts to share this week' : 'No workouts to share for this month');
            return;
        }

        setSharingPeriod(period);
        try {
            const result = await shareWorkoutPeriodImage(data, {
                athleteName: profile?.displayName,
                periodLabel: period === 'week' ? 'This Week' : month.format('MMMM'),
                title: period === 'week' ? 'Weekly Training Recap' : `${month.format('MMMM')} Training Recap`,
                subtitle: period === 'week'
                    ? `${currentWeekWindow.start.format('MMM D')} - ${currentWeekWindow.end.format('MMM D, YYYY')}`
                    : month.format('MMMM YYYY'),
                filenameLabel: period === 'week' ? 'weekly-recap' : `${month.format('YYYY-MM')}-recap`,
            });
            toast.success(result === 'shared' ? 'Period share card ready' : 'Period share card downloaded');
        } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
                console.warn('Failed to share period recap:', error);
                toast.error('Could not export period recap');
            }
        } finally {
            setSharingPeriod(null);
        }
    };

    const handleDeleteWorkout = async (session: WorkoutSession) => {
        if (!user) return;
        const shouldDelete = confirm('Delete this workout from history? This cannot be undone.');
        if (!shouldDelete) return;

        setDeletingSessionId(session.id);
        try {
            await deleteWorkout(session.id, user.uid);
            setWorkouts((current) => current.filter((workout) => workout.id !== session.id));
            toast.success('Workout deleted');
        } catch (error) {
            console.warn('Failed to delete workout:', error);
            toast.error('Failed to delete workout');
        } finally {
            setDeletingSessionId(null);
        }
    };

    const getDotClass = (date: Dayjs): string => {
        const key = getDateKey(date);
        const hasWorkout = (workoutsByDate[key] || []).length > 0;

        if (hasWorkout) {
            if (!isTrainingDay(date)) return '';
            return isPrimaryDay(date) ? 'bg-green' : 'bg-cyan';
        }

        if (
            date.isBefore(dayjs(), 'day') &&
            isPrimaryDay(date) &&
            (!oldestLoadedWorkoutDay || !date.isBefore(oldestLoadedWorkoutDay, 'day'))
        ) {
            return 'bg-red';
        }

        return '';
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
            <div className="glass rounded-3xl p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-text-muted">Calendar History</p>
                        <h1 className="text-2xl font-black mt-1">Training Calendar</h1>
                        {loadingHistory && (
                            <p className="text-xs text-text-muted mt-1">Loading sessions...</p>
                        )}
                    </div>
                    <Calendar size={22} className="text-accent" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-bg-card p-3">
                        <p className="text-xs text-text-muted">Current Streak</p>
                        <p className="text-xl font-black mt-1 flex items-center gap-1">
                            <Flame size={18} className="text-amber" />
                            {currentTrainingStreak} days
                        </p>
                    </div>
                    <div className="rounded-2xl bg-bg-card p-3">
                        <p className="text-xs text-text-muted">Weekly Compliance</p>
                        <p className="text-xl font-black mt-1">
                            {weeklyCompliance.completed}/{weeklyCompliance.total}
                        </p>
                        <div className="w-full h-1.5 rounded-full bg-bg-input mt-2 overflow-hidden">
                            <div className="h-full gradient-primary" style={{ width: `${weeklyCompliance.pct}%` }} />
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                        onClick={() => { void handleSharePeriod('week'); }}
                        disabled={sharingPeriod !== null}
                        className="py-3 rounded-2xl border border-border text-sm text-text-secondary font-semibold disabled:opacity-50"
                    >
                        {sharingPeriod === 'week' ? 'Preparing...' : 'Share This Week'}
                    </button>
                    <button
                        onClick={() => { void handleSharePeriod('month'); }}
                        disabled={sharingPeriod !== null}
                        className="py-3 rounded-2xl border border-border text-sm text-text-secondary font-semibold disabled:opacity-50"
                    >
                        {sharingPeriod === 'month' ? `Sharing ${month.format('MMM')}` : `Share ${month.format('MMM')}`}
                    </button>
                </div>
            </div>

            <div className="glass rounded-3xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => setMonth((prev) => prev.subtract(1, 'month'))}
                        className="w-9 h-9 rounded-xl bg-bg-card flex items-center justify-center"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <h2 className="font-semibold">{month.format('MMMM YYYY')}</h2>
                    <button
                        onClick={() => setMonth((prev) => prev.add(1, 'month'))}
                        className="w-9 h-9 rounded-xl bg-bg-card flex items-center justify-center"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-[11px] text-text-muted mb-2">
                    {weekHeaders.map((day) => (
                        <p key={day} className="text-center">{day}</p>
                    ))}
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
                                className={`aspect-square rounded-xl p-1 border text-xs relative ${isToday ? 'border-accent' : 'border-border'} ${inMonth ? 'bg-bg-card' : 'bg-bg-surface text-text-muted'}`}
                            >
                                <span>{date.date()}</span>
                                {dotClass && <span className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-1.5 h-1.5 rounded-full ${dotClass}`} />}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 text-xs text-text-muted grid grid-cols-2 gap-2">
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green" />Primary completed</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan" />Secondary completed</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red" />Missed primary day</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-bg-input" />Rest / no marker</p>
                </div>
            </div>

            {selectedDate && (
                <div className="fixed inset-0 z-[80] bg-black/60 flex items-end" onClick={() => setSelectedDate(null)}>
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl p-5 animate-slide-up max-h-[80vh] overflow-y-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold">{dayjs(selectedDate).format('ddd, MMM D')}</h3>
                            <button onClick={() => setSelectedDate(null)} className="text-xs text-text-muted">Close</button>
                        </div>

                        {selectedSessions.length === 0 ? (
                            <div className="rounded-2xl bg-bg-card p-4 text-sm text-text-secondary">
                                No completed workout for this day.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-2xl bg-bg-card p-4">
                                    <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Sessions</p>
                                    <div className="space-y-2">
                                        {selectedSessions.map((session) => {
                                            const isSelected = selectedSession?.id === session.id;
                                            return (
                                                <div
                                                    key={session.id}
                                                    className={`rounded-xl border transition-colors ${isSelected ? 'border-accent bg-accent/10' : 'border-border bg-bg-surface'}`}
                                                >
                                                    <div className="flex items-center gap-2 p-2">
                                                        <button
                                                            onClick={() => setSelectedSessionId(session.id)}
                                                            className="flex-1 text-left"
                                                        >
                                                            <p className="text-sm font-semibold">
                                                                {dayjs(session.startedAt).format('h:mm A')} • {formatDurationHuman(session.duration)}
                                                            </p>
                                                            <p className="text-xs text-text-secondary mt-1">
                                                                {session.exercises.length} exercises • {getSessionSetCount(session)} sets
                                                            </p>
                                                            <p className="text-xs text-text-muted mt-1 line-clamp-1">
                                                                {getWorkoutHeadline(session) || 'No exercises logged'}
                                                            </p>
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/history/${session.id}`)}
                                                            className="px-3 h-9 rounded-lg border border-border text-xs text-text-secondary hover:border-accent/40 hover:text-accent"
                                                        >
                                                            Open
                                                        </button>
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
                                            <div className="rounded-2xl bg-bg-card p-3">
                                                <p className="text-xs text-text-muted">Duration</p>
                                                <p className="text-sm font-semibold mt-1">{formatDurationHuman(selectedSession.duration)}</p>
                                            </div>
                                            <div className="rounded-2xl bg-bg-card p-3">
                                                <p className="text-xs text-text-muted">Exercises</p>
                                                <p className="text-sm font-semibold mt-1">{selectedSession.exercises.length}</p>
                                            </div>
                                            <div className="rounded-2xl bg-bg-card p-3">
                                                <p className="text-xs text-text-muted">{selectedSessionEffort?.unit === 'kg·reps' ? 'Volume' : 'Reps'}</p>
                                                <p className="text-sm font-semibold mt-1">{selectedSessionEffort?.value || '0'}</p>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl bg-bg-card p-4">
                                            <div className="flex items-center justify-between gap-3 mb-1">
                                                <p className="text-xs text-text-muted uppercase tracking-wide">Session Notes</p>
                                                <button
                                                    onClick={() => navigate(`/history/${selectedSession.id}`)}
                                                    className="text-xs text-accent font-medium"
                                                >
                                                    Full Summary
                                                </button>
                                            </div>
                                            <p className="text-sm text-text-secondary whitespace-pre-wrap">
                                                {selectedSession.notes?.trim() || 'No notes saved for this session.'}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl bg-bg-card p-4 space-y-3">
                                            <p className="text-xs text-text-muted uppercase tracking-wide">Exercise Details</p>
                                            {selectedSession.exercises.length === 0 ? (
                                                <p className="text-sm text-text-secondary">No exercises logged for this session.</p>
                                            ) : (
                                                selectedSession.exercises.map((exercise) => {
                                                    const exerciseVolume = Math.round(getExerciseVolume(exercise));
                                                    const exerciseReps = exercise.sets.reduce((sum, setItem) => sum + (setItem.reps || 0), 0);
                                                    const effort = formatEffortValue(exerciseVolume, exerciseReps);

                                                    return (
                                                        <div key={exercise.id} className="rounded-xl bg-bg-surface p-3 border border-border">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-sm font-semibold">{exercise.name}</p>
                                                                <p className="text-xs text-text-muted">
                                                                    {exercise.sets.length} sets • {effort.value} {effort.unit}
                                                                </p>
                                                            </div>
                                                            <div className="mt-2 space-y-1">
                                                                {exercise.sets.map((setItem, index) => (
                                                                    <p key={setItem.id} className="text-xs text-text-secondary">
                                                                        Set {index + 1}: {formatSetPerformance(setItem.weight, setItem.reps)}
                                                                        {setItem.completed ? ' ✓' : ''}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
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
