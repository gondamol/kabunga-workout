import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { Calendar, Check, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getUserWorkouts } from '../lib/firestoreService';
import type { WorkoutSession } from '../lib/types';
import { formatDurationHuman } from '../lib/utils';

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

const getSessionSummary = (sessions: WorkoutSession[]) => {
    const exerciseNames = Array.from(new Set(sessions.flatMap((session) => session.exercises.map((exercise) => exercise.name))));
    const totalVolume = sessions.reduce(
        (sum, session) =>
            sum + session.exercises.reduce(
                (exerciseSum, exercise) =>
                    exerciseSum + exercise.sets.reduce((setSum, setItem) => setSum + setItem.weight * setItem.reps, 0),
                0
            ),
        0
    );
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    const prs = sessions.reduce(
        (sum, session) =>
            sum + session.exercises.reduce(
                (exerciseSum, exercise) => exerciseSum + exercise.sets.filter((setItem) => setItem.personalBest).length,
                0
            ),
        0
    );
    const notes = sessions.map((session) => session.notes).filter((note) => note.trim());

    return {
        exerciseNames,
        totalVolume,
        totalDuration,
        prs,
        notes: notes.length > 0 ? notes.join(' • ') : '',
    };
};

export default function HistoryPage() {
    const { user } = useAuthStore();
    const [month, setMonth] = useState(dayjs().startOf('month'));
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        getUserWorkouts(user.uid, 90)
            .then(setWorkouts)
            .catch((error) => console.warn('Failed to load workout history:', error));
    }, [user]);

    const workoutsByDate = useMemo(() => {
        return workouts.reduce<Record<string, WorkoutSession[]>>((acc, workout) => {
            const key = dayjs(workout.startedAt).format('YYYY-MM-DD');
            if (!acc[key]) acc[key] = [];
            acc[key].push(workout);
            return acc;
        }, {});
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

    const selectedSessions = selectedDate ? (workoutsByDate[selectedDate] || []) : [];
    const selectedSummary = useMemo(() => getSessionSummary(selectedSessions), [selectedSessions]);
    const oldestLoadedWorkoutDay = useMemo(() => {
        if (workouts.length === 0) return null;
        const oldest = workouts.reduce((min, workout) => Math.min(min, workout.startedAt), workouts[0].startedAt);
        return dayjs(oldest).startOf('day');
    }, [workouts]);

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
                                    <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Exercises Completed</p>
                                    <p className="text-sm">{selectedSummary.exerciseNames.join(', ')}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-bg-card p-3">
                                        <p className="text-xs text-text-muted">Total Volume</p>
                                        <p className="text-sm font-semibold mt-1">{Math.round(selectedSummary.totalVolume)} kg·reps</p>
                                    </div>
                                    <div className="rounded-2xl bg-bg-card p-3">
                                        <p className="text-xs text-text-muted">Duration</p>
                                        <p className="text-sm font-semibold mt-1">{formatDurationHuman(selectedSummary.totalDuration)}</p>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-bg-card p-4">
                                    <p className="text-xs text-text-muted uppercase tracking-wide mb-2">PRs Hit</p>
                                    <p className="text-sm font-semibold flex items-center gap-2">
                                        <Check size={14} className="text-green" />
                                        {selectedSummary.prs}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-bg-card p-4">
                                    <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Notes</p>
                                    <textarea
                                        readOnly
                                        value={selectedSummary.notes || 'No notes'}
                                        className="w-full h-24 bg-bg-input border border-border rounded-xl p-3 text-sm text-text-secondary resize-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
