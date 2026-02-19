import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { getRecentWorkouts, getActiveChallenges, getMealsByDate } from '../lib/firestoreService';
import { formatDurationHuman, formatRelativeTime, getTodayKey, getDaysInRange } from '../lib/utils';
import type { WorkoutSession, Challenge, Meal } from '../lib/types';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Dumbbell, Flame, Clock, TrendingUp, ChevronRight, Zap, Trophy, Plus } from 'lucide-react';
import dayjs from 'dayjs';

export default function DashboardPage() {
    const { user, profile } = useAuthStore();
    const { activeSession } = useWorkoutStore();
    const navigate = useNavigate();

    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
    const [loadingWorkouts, setLoadingWorkouts] = useState(true);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            try {
                const [w, c, m] = await Promise.all([
                    getRecentWorkouts(user.uid, 30),
                    getActiveChallenges(user.uid),
                    getMealsByDate(user.uid, getTodayKey()),
                ]);
                setWorkouts(w);
                setChallenges(c);
                setTodayMeals(m);
            } catch (err) {
                console.warn('Failed to load dashboard data:', err);
            } finally {
                setLoadingWorkouts(false);
            }
        };
        load();
    }, [user]);

    const stats = useMemo(() => {
        const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
        const totalCalories = workouts.reduce((sum, w) => sum + w.caloriesEstimate, 0);

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
            <div className="glass rounded-2xl p-4 animate-fade-in stagger-2">
                <h3 className="text-sm font-semibold text-text-secondary mb-4">This Week</h3>
                <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
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
                </div>
            </div>

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
                    <h3 className="text-sm font-semibold text-text-secondary mb-3">Recent Sessions</h3>
                    <div className="space-y-2">
                        {workouts.slice(0, 5).map((w) => (
                            <div key={w.id} className="glass rounded-2xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                                    <Dumbbell size={18} className="text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {w.exercises.length > 0
                                            ? w.exercises.map((e) => e.name).join(', ')
                                            : 'Quick Session'}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        {formatDurationHuman(w.duration)} • {formatRelativeTime(w.startedAt)}
                                    </p>
                                </div>
                                <span className="text-xs text-text-muted">{w.exercises.length} ex</span>
                            </div>
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
                    <p className="text-text-secondary text-sm">Start your first one and track your progress! 🚀</p>
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
