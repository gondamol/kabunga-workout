import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    Clock,
    Dumbbell,
    FileText,
    Flame,
    ImageDown,
    Share2,
    TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getRecentWorkouts, getWorkoutById } from '../lib/firestoreService';
import type { WorkoutSession } from '../lib/types';
import { copyToClipboard, formatDurationHuman, formatRelativeTime, generateWorkoutSummary } from '../lib/utils';
import {
    getExerciseVolume,
    getWorkoutBestSet,
    getWorkoutExerciseSummaryRows,
    getWorkoutHeadline,
    getWorkoutLoggedSetCount,
    getWorkoutPersonalBestBadges,
    getWorkoutTopExercise,
    getWorkoutTotalReps,
    getWorkoutTotalSets,
    getWorkoutTotalVolume,
    shareWorkoutImage,
} from '../lib/workoutSummary';
import { formatEffortValue, formatSetPerformance } from '../lib/exerciseRules';
import { SESSION_SUMMARY_THEME } from '../lib/sessionDetailPresentation';

export default function SessionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuthStore();
    const navigate = useNavigate();

    const [session, setSession] = useState<WorkoutSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sharingImage, setSharingImage] = useState(false);
    const [sharingText, setSharingText] = useState(false);
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSession[]>([]);

    useEffect(() => {
        if (!id) {
            setError('Session not found');
            setLoading(false);
            return;
        }
        if (!user) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        const load = async () => {
            try {
                const [workout, history] = await Promise.all([
                    getWorkoutById(user.uid, id),
                    getRecentWorkouts(user.uid, 365),
                ]);
                if (cancelled) return;
                if (!workout) {
                    setError('Session not found');
                    return;
                }
                setSession(workout);
                setRecentWorkouts(history);
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load session:', err);
                setError('Failed to load session details');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [id, user]);

    const workoutStats = useMemo(() => {
        if (!session) return null;
        return {
            headline: getWorkoutHeadline(session),
            totalVolume: Math.round(getWorkoutTotalVolume(session)),
            totalSets: getWorkoutTotalSets(session),
            loggedSets: getWorkoutLoggedSetCount(session),
            totalReps: getWorkoutTotalReps(session),
            topExercise: getWorkoutTopExercise(session),
            exerciseRows: getWorkoutExerciseSummaryRows(session, 4),
            personalBestBadges: getWorkoutPersonalBestBadges(
                session,
                recentWorkouts.filter((workout) => workout.id !== session.id)
            ),
            bestSet: getWorkoutBestSet(session),
        };
    }, [recentWorkouts, session]);

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/history');
    };

    const handleShareImage = async () => {
        if (!session) return;
        setSharingImage(true);
        try {
            const result = await shareWorkoutImage(session, {
                athleteName: profile?.displayName || user?.displayName,
                previousWorkouts: recentWorkouts.filter((workout) => workout.id !== session.id),
            });
            toast.success(result === 'shared' ? 'Session image ready to share' : 'Session image downloaded');
        } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
                console.error('Failed to share workout image:', error);
                toast.error('Could not export session image');
            }
        } finally {
            setSharingImage(false);
        }
    };

    const handleShareText = async () => {
        if (!session) return;
        setSharingText(true);
        try {
            const summary = generateWorkoutSummary(session);
            if (typeof navigator.share === 'function') {
                try {
                    await navigator.share({
                        title: 'Kabunga Workout',
                        text: summary,
                    });
                    toast.success('Session summary shared');
                    return;
                } catch (error) {
                    if ((error as Error)?.name === 'AbortError') return;
                }
            }

            await copyToClipboard(summary);
            toast.success('Session summary copied');
        } catch (error) {
            console.error('Failed to share workout summary:', error);
            toast.error('Could not share session summary');
        } finally {
            setSharingText(false);
        }
    };

    if (loading) {
        return (
            <div className="shell-page pt-6 pb-4">
                <div className="flex justify-center items-center min-h-screen">
                    <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (error || !session || !workoutStats) {
        return (
            <div className="shell-page pt-6 pb-24">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6"
                >
                    <ArrowLeft size={20} />
                    Back
                </button>
                <div className="glass rounded-3xl p-6 text-center">
                    <p className="text-text-secondary">{error || 'Session not found'}</p>
                </div>
            </div>
        );
    }

    const date = dayjs(session.startedAt);
    const completionPct = workoutStats.totalSets > 0
        ? Math.round((workoutStats.loggedSets / workoutStats.totalSets) * 100)
        : 0;
    const workoutEffort = formatEffortValue(workoutStats.totalVolume, workoutStats.totalReps);
    const topExerciseEffort = workoutStats.topExercise
        ? formatEffortValue(workoutStats.topExercise.volume, workoutStats.topExercise.reps)
        : null;

    return (
        <div className="shell-page pt-6 pb-24 space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </button>
                    <p className="text-sm text-text-secondary">{date.format('dddd, MMMM D, YYYY')}</p>
                    <h1 className="text-2xl font-bold mt-1">Session Summary</h1>
                    <p className="text-xs text-text-muted mt-2">{formatRelativeTime(session.startedAt)}</p>
                </div>
                    <button
                    onClick={() => navigate('/history')}
                    className="px-3 py-2 rounded-xl border border-border bg-white text-xs text-text-secondary shrink-0"
                >
                    Calendar
                </button>
            </div>

            <div className={`relative overflow-hidden ${SESSION_SUMMARY_THEME.heroCard}`}>
                <div className="absolute -top-16 left-[-10%] h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 right-[-10%] h-40 w-40 rounded-full bg-cyan/10 blur-3xl pointer-events-none" />
                <div className="relative">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan">Kabunga Session</p>
                    <h2 className={`mt-2 text-2xl font-black leading-tight ${SESSION_SUMMARY_THEME.primaryText}`}>{workoutStats.headline}</h2>
                    <p className={`mt-2 text-sm ${SESSION_SUMMARY_THEME.secondaryText}`}>
                        {formatDurationHuman(session.duration)} • {session.exercises.length} exercises • {workoutStats.totalReps} reps
                    </p>

                    {workoutStats.personalBestBadges.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {workoutStats.personalBestBadges.map((badge) => (
                                <span
                                    key={badge}
                                    className="px-3 py-1 rounded-full bg-green/15 border border-green/20 text-[11px] font-semibold text-green"
                                >
                                    {badge}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-5">
                        <PreviewMetric
                            label={workoutEffort.unit === 'kg·reps' ? 'Volume' : 'Reps'}
                            value={workoutEffort.value}
                            sub={workoutEffort.unit}
                        />
                        <PreviewMetric label="Sets" value={`${workoutStats.loggedSets}`} sub="logged" />
                        <PreviewMetric label="Calories" value={`${Math.round(session.caloriesEstimate)}`} sub="kcal" />
                        <PreviewMetric label="Completion" value={`${completionPct}%`} sub="of planned sets" />
                    </div>

                    <div className={SESSION_SUMMARY_THEME.topLiftCard}>
                        <p className={`text-[11px] uppercase tracking-wide ${SESSION_SUMMARY_THEME.mutedText}`}>
                            {workoutStats.topExercise?.metric === 'reps' ? 'Top Movement' : 'Top Lift'}
                        </p>
                        <p className={`mt-2 text-base font-semibold ${SESSION_SUMMARY_THEME.primaryText}`}>
                            {workoutStats.topExercise?.name || 'No single lift recorded'}
                        </p>
                        <p className={`mt-1 text-xs ${SESSION_SUMMARY_THEME.secondaryText}`}>
                            {topExerciseEffort
                                ? `${topExerciseEffort.value} ${topExerciseEffort.unit}`
                                : 'Bodyweight or timed emphasis'}
                        </p>
                    </div>

                    {workoutStats.bestSet && (
                        <div className={SESSION_SUMMARY_THEME.bestSetCard}>
                            <p className="text-[11px] uppercase tracking-wide text-cyan font-semibold">Best Set Callout</p>
                            <p className={`mt-2 text-sm font-semibold ${SESSION_SUMMARY_THEME.primaryText}`}>
                                {workoutStats.bestSet.exerciseName} • {formatSetPerformance(
                                    workoutStats.bestSet.weight,
                                    workoutStats.bestSet.reps
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="glass rounded-3xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <h2 className="text-sm font-semibold text-text-secondary">Share This Session</h2>
                        <p className="text-xs text-text-muted mt-1">On mobile this opens the share sheet. On desktop the image downloads.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => void handleShareImage()}
                        disabled={sharingImage}
                        className="py-3 rounded-2xl gradient-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <ImageDown size={18} />
                        {sharingImage ? 'Preparing...' : 'Share Image'}
                    </button>
                    <button
                        onClick={() => void handleShareText()}
                        disabled={sharingText}
                        className="py-3 rounded-2xl border border-border text-text-secondary font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Share2 size={18} />
                        {sharingText ? 'Preparing...' : 'Share Text'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <MetricCard
                    icon={<Clock size={20} className="text-cyan" />}
                    label="Duration"
                    value={formatDurationHuman(session.duration)}
                />
                <MetricCard
                    icon={<Flame size={20} className="text-amber" />}
                    label="Calories"
                    value={`${Math.round(session.caloriesEstimate)}`}
                    unit="kcal"
                />
                <MetricCard
                    icon={<Dumbbell size={20} className="text-accent" />}
                    label={workoutEffort.unit === 'kg·reps' ? 'Total Volume' : 'Total Reps'}
                    value={workoutEffort.value}
                    unit={workoutEffort.unit}
                />
                <MetricCard
                    icon={<TrendingUp size={20} className="text-green" />}
                    label="Logged Sets"
                    value={`${workoutStats.loggedSets}/${workoutStats.totalSets}`}
                />
            </div>

            <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-text-secondary">High Level</h3>
                    <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            session.status === 'completed'
                                ? 'bg-green/20 text-green'
                                : session.status === 'active'
                                    ? 'bg-amber/20 text-amber'
                                    : 'bg-red/20 text-red'
                        }`}
                    >
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <SummaryRow label="Started" value={date.format('h:mm A')} />
                    <SummaryRow label="Date" value={date.format('MMM D, YYYY')} />
                    <SummaryRow label="Exercises" value={`${session.exercises.length}`} />
                    <SummaryRow label="Total Reps" value={`${workoutStats.totalReps}`} />
                </div>
            </div>

            <div className="glass rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Exercise Snapshot</h3>
                <div className="space-y-3">
                    {workoutStats.exerciseRows.map((row) => {
                        const effort = formatEffortValue(row.volume, row.reps);
                        return (
                            <div key={`${row.name}-${row.sets}-${row.reps}`} className="rounded-2xl bg-bg-card p-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{row.name}</p>
                                    <p className="text-xs text-text-muted mt-1">
                                        {row.sets} sets • {row.reps} reps
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-semibold">{effort.value}</p>
                                    <p className="text-xs text-text-muted">{effort.unit}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Exercise Details</h3>
                <div className="space-y-3">
                    {session.exercises.map((exercise) => {
                        const exerciseVolume = Math.round(getExerciseVolume(exercise));
                        const exerciseReps = exercise.sets.reduce((sum, set) => sum + (set.reps || 0), 0);
                        const exerciseEffort = formatEffortValue(exerciseVolume, exerciseReps);
                        const completedSets = exercise.sets.filter((set) => set.completed).length;

                        return (
                            <div key={exercise.id} className="glass rounded-2xl p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-semibold">{exercise.name}</h4>
                                            <span className="text-xs text-text-muted">
                                                {completedSets > 0 ? `${completedSets}/${exercise.sets.length}` : exercise.sets.length} sets
                                            </span>
                                            {exercise.isWarmup && (
                                                <span className="text-[11px] px-2 py-1 rounded-full bg-cyan/10 text-cyan">
                                                    Warmup
                                                </span>
                                            )}
                                        </div>
                                        {exercise.phaseName && (
                                            <p className="text-xs text-text-muted mt-1">{exercise.phaseName}</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-semibold">{exerciseEffort.value}</p>
                                        <p className="text-xs text-text-muted">{exerciseEffort.unit}</p>
                                    </div>
                                </div>

                                {exercise.cue && (
                                    <div className="rounded-xl bg-accent/10 border border-accent/15 px-3 py-2 mb-3">
                                        <p className="text-[11px] uppercase tracking-wide text-accent font-semibold mb-1">Cue</p>
                                        <p className="text-xs text-text-secondary">{exercise.cue}</p>
                                    </div>
                                )}

                                {exercise.notes.trim() && (
                                    <div className="rounded-xl bg-bg-card px-3 py-3 mb-3">
                                        <p className="text-xs text-text-secondary whitespace-pre-wrap">{exercise.notes}</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {exercise.sets.map((set, index) => (
                                        <div
                                            key={set.id}
                                            className={`rounded-xl px-3 py-2.5 flex items-center justify-between text-xs ${
                                                set.completed
                                                    ? 'bg-green/10 border border-green/20'
                                                    : 'bg-bg-card border border-border'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`font-semibold ${set.completed ? 'text-green' : 'text-text-muted'}`}>
                                                    Set {index + 1}
                                                </span>
                                                <span className="text-text-secondary">
                                                    {formatSetPerformance(set.weight, set.reps)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-text-muted">
                                                {set.rpe && <span>RPE {set.rpe}</span>}
                                                {set.completed && <span className="text-green font-semibold">Done</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {session.notes.trim() && (
                <div className="glass rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText size={16} className="text-accent" />
                        <h3 className="text-sm font-semibold text-text-secondary">Session Notes</h3>
                    </div>
                    <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{session.notes}</p>
                </div>
            )}

            {session.coachNotes?.trim() && (
                <div className="glass rounded-2xl p-4 border border-accent/20 bg-accent/5">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText size={16} className="text-accent" />
                        <h3 className="text-sm font-semibold text-accent">Coach Notes</h3>
                    </div>
                    <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{session.coachNotes}</p>
                </div>
            )}
        </div>
    );
}

function MetricCard({
    icon,
    label,
    value,
    unit,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    unit?: string;
}) {
    return (
        <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">{icon}</div>
            <p className="text-xs text-text-muted mb-1">{label}</p>
            <p className="text-lg font-bold">
                {value}
                {unit && <span className="text-xs text-text-muted ml-1">{unit}</span>}
            </p>
        </div>
    );
}

function PreviewMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className={SESSION_SUMMARY_THEME.previewMetric}>
            <p className={`text-[11px] uppercase tracking-wide ${SESSION_SUMMARY_THEME.mutedText}`}>{label}</p>
            <p className={`mt-2 text-xl font-black ${SESSION_SUMMARY_THEME.primaryText}`}>{value}</p>
            <p className={`mt-1 text-xs ${SESSION_SUMMARY_THEME.secondaryText}`}>{sub}</p>
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-bg-card px-3 py-3">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="font-semibold mt-1">{value}</p>
        </div>
    );
}
