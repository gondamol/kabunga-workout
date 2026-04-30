import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../stores/workoutStore';
import dayjs from 'dayjs';
import { getExerciseHistory, saveWorkout, updateCoachPlanProgress, uploadMedia } from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import { formatDuration, generateWorkoutSummary, shareWorkout, compressImage } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';
import { COMMON_EXERCISES } from '../lib/constants';
import RestTimer from '../components/RestTimer';
import toast from 'react-hot-toast';
import type { ExerciseHistory, ExerciseSet, IronSetType } from '../lib/types';
import { formatProgressionInsightTarget, getProgressionSuggestionFromHistory } from '../lib/progressionInsights';
import { formatLoadLabel, formatSetPerformance } from '../lib/exerciseRules';
import {
    Plus, X, Check, CheckSquare,
    Camera, Video, StopCircle, Pause, Play,
    Search, Timer, ChevronLeft, ChevronRight,
    Zap, MoreHorizontal, Trash2, Bell, ClipboardList,
    Droplets, Star, Share2, Clock, Flame, Dumbbell, PersonStanding,
} from 'lucide-react';
import type { WorkoutSession } from '../lib/types';
import Webcam from 'react-webcam';
import { isIronTemplateId } from '../lib/ironProtocol';
import { ActionButton, EmptyState, ProgressRing, StatChip } from '../components/ui';

const normalizeExerciseName = (name: string): string =>
    name.toLowerCase().trim().replace(/\s+/g, ' ');

const setTypeMeta: Record<IronSetType, { label: string; shortLabel: string; className: string }> = {
    warmup: { label: 'Warm-Up', shortLabel: 'WU', className: 'bg-bg-input text-text-muted border-border' },
    working: { label: 'Working', shortLabel: 'WRK', className: 'bg-cyan/15 text-cyan border-cyan/30' },
    heavy: { label: 'Heavy', shortLabel: 'HVY', className: 'bg-orange-600/20 text-orange-400 border-orange-500/40' },
    backoff: { label: 'Back-Off', shortLabel: 'BO', className: 'bg-green/15 text-green border-green/30' },
    accessories: { label: 'Accessory', shortLabel: 'ACC', className: 'bg-bg-input text-text-muted border-border' },
};

export default function ActiveWorkoutPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const {
        activeSession, timerSeconds, isTimerRunning, timerAlarmMinutes,
        currentExerciseIndex, goToExercise, nextExercise, prevExercise,
        addExercise, removeExercise, addSet, removeSet, updateSet, completeSet, toggleSetComplete,
        endWorkout, cancelWorkout, tick, setTimerRunning, setTimerAlarmMinutes, addMediaUrl, updateSessionNotes,
        startRest, defaultRestSeconds, isResting, activeTemplate,
    } = useWorkoutStore();

    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState('');
    const [custom, setCustom] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [finishingWorkout, setFinishingWorkout] = useState(false);
    const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
    const [completedSummaryText, setCompletedSummaryText] = useState('');
    const [historyByExercise, setHistoryByExercise] = useState<Record<string, ExerciseHistory | null>>({});
    const [sessionBestScores, setSessionBestScores] = useState<Record<string, number>>({});

    const webcamRef = useRef<Webcam>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Master 1-second tick
    useEffect(() => {
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [tick]);

    // Redirect if no session
    useEffect(() => {
        if (!activeSession) navigate('/workout', { replace: true });
    }, [activeSession, navigate]);

    useEffect(() => {
        if (!user || !activeSession || !isIronTemplateId(activeSession.templateId)) {
            setHistoryByExercise({});
            return;
        }
        let cancelled = false;
        const uniqueNames = Array.from(new Set(activeSession.exercises.map((exercise) => exercise.name)));

        const loadHistory = async () => {
            const entries = await Promise.all(
                uniqueNames.map(async (name) => {
                    try {
                        const history = await getExerciseHistory(user.uid, name, 10);
                        return [normalizeExerciseName(name), history] as const;
                    } catch (error) {
                        console.warn(`Failed to load history for ${name}:`, error);
                        return [normalizeExerciseName(name), null] as const;
                    }
                })
            );

            if (cancelled) return;
            setHistoryByExercise(
                entries.reduce<Record<string, ExerciseHistory | null>>((acc, [key, value]) => {
                    acc[key] = value;
                    return acc;
                }, {})
            );
        };

        loadHistory();
        return () => {
            cancelled = true;
        };
    }, [user, activeSession]);

    useEffect(() => {
        setSessionBestScores({});
    }, [activeSession?.id]);

    useEffect(() => {
        if (!user || !activeSession?.scheduledWorkoutId) return;

        const totalSets = activeSession.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
        const completedSets = activeSession.exercises.reduce(
            (sum, exercise) => sum + exercise.sets.filter((setItem) => setItem.completed).length,
            0
        );
        const currentExerciseName = activeSession.exercises[currentExerciseIndex]?.name || '';
        const timeout = window.setTimeout(() => {
            updateCoachPlanProgress(activeSession.scheduledWorkoutId!, {
                progressCompletedSets: completedSets,
                progressTotalSets: totalSets,
                progressCurrentExercise: currentExerciseName,
                athleteInSession: true,
            }).catch((error) => {
                console.warn('Could not sync coach plan progress:', error);
            });
        }, 600);

        return () => window.clearTimeout(timeout);
    }, [user, activeSession?.scheduledWorkoutId, activeSession?.exercises, currentExerciseIndex]);

    useEffect(() => {
        if (!user || !activeSession?.scheduledWorkoutId) return;
        const planId = activeSession.scheduledWorkoutId;
        return () => {
            updateCoachPlanProgress(planId, {
                athleteInSession: false,
            }).catch(() => {
                // Ignore transient offline/permission errors on cleanup.
            });
        };
    }, [user, activeSession?.scheduledWorkoutId]);

    if (!activeSession && !completedSession) return null;

    // ── Completion celebration screen ──
    if (completedSession) {
        const durationMin = Math.round(completedSession.duration / 60);
        const totalExercises = completedSession.exercises.length;
        const completedSetsCount = completedSession.exercises.reduce(
            (sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
        const totalSetsCount = completedSession.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        const effortPct = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 100;
        const estimatedCal = Math.round(durationMin * 7.5);
        const firstName = user?.displayName?.split(' ')[0] ?? 'Athlete';
        const durationLabel = `${String(Math.floor(durationMin / 60) * 60 + durationMin % 60).padStart(2, '0')}:${String(Math.round((completedSession.duration % 60))).padStart(2, '0')}`;
        const completedExCount = completedSession.exercises.filter((ex) => ex.sets.some((s) => s.completed)).length;

        // 7-day streak from session history (M T W T F S S; today highlighted)
        const todayWeekday = dayjs().day(); // 0 = Sun, 1 = Mon ... 6 = Sat
        const isoMondayIndex = todayWeekday === 0 ? 6 : todayWeekday - 1;
        const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const weekDots = weekLabels.map((label, idx) => ({
            label,
            isToday: idx === isoMondayIndex,
            done: idx <= isoMondayIndex, // Filled up to today
        }));
        const streakCount = isoMondayIndex + 1; // simplified placeholder

        return (
            <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">
                {/* ── Hero with confetti decorations ── */}
                <div className="relative pt-2">
                    {/* Confetti decorations */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <span className="absolute top-2 left-12 text-amber text-lg rotate-12">▍</span>
                        <span className="absolute top-6 right-20 text-tertiary text-sm -rotate-12">▎</span>
                        <span className="absolute top-14 left-4 text-secondary text-base rotate-45">▍</span>
                        <span className="absolute top-20 right-8 text-amber text-sm">▎</span>
                        <span className="absolute top-32 left-20 text-tertiary text-xs rotate-12">●</span>
                        <span className="absolute top-2 right-2 text-secondary text-base rotate-12">▎</span>
                    </div>
                    <div className="relative">
                        <h1 className="font-display text-[2.3rem] font-extrabold text-primary leading-[1.05]">
                            Workout<br />Complete! <span className="inline-block">🎉</span>
                        </h1>
                        <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-[88%]">
                            You showed up and gave it your all. Great work, {firstName}!
                        </p>
                    </div>
                </div>

                {/* ── Session Summary ── */}
                <div className="rounded-3xl bg-bg-card p-5 shadow-card">
                    <div className="flex items-center gap-2 mb-4">
                        <Star size={16} className="text-amber" fill="currentColor" />
                        <h2 className="text-sm font-bold text-text-primary">Session Summary</h2>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <SummaryStat
                            icon={<Clock size={18} className="text-primary" strokeWidth={2.5} />}
                            iconBg="bg-primary-container"
                            value={durationLabel.includes(':') && durationMin < 60 ? `${durationMin}:${String(Math.round(completedSession.duration % 60)).padStart(2, '0')}` : `${durationMin}`}
                            unit={durationMin < 60 ? 'min' : 'min'}
                            label="Duration"
                        />
                        <SummaryStat
                            icon={<Flame size={18} className="text-amber" strokeWidth={2.5} fill="currentColor" />}
                            iconBg="bg-amber/15"
                            value={`${estimatedCal}`}
                            unit="Cal"
                            label="Calories Burned"
                        />
                        <SummaryStat
                            icon={<Dumbbell size={18} className="text-tertiary" strokeWidth={2.5} />}
                            iconBg="bg-tertiary-container"
                            value={`${completedExCount}`}
                            unit={`of ${totalExercises}`}
                            label="Exercises Completed"
                        />
                        <SummaryStat
                            icon={<PersonStanding size={18} className="text-amber" strokeWidth={2.5} />}
                            iconBg="bg-amber/15"
                            value={`${effortPct}`}
                            unit="%"
                            label="Awesome Effort"
                        />
                    </div>
                </div>

                {/* ── Streak ── */}
                <div className="rounded-3xl bg-secondary-container p-5">
                    <div className="flex items-start gap-4">
                        {/* Shield badge */}
                        <div className="relative shrink-0">
                            <div className="w-20 h-24 flex items-center justify-center" aria-hidden="true">
                                <svg viewBox="0 0 80 96" className="absolute inset-0 w-full h-full">
                                    <path
                                        d="M40 4 L72 16 L72 52 Q72 76 40 92 Q8 76 8 52 L8 16 Z"
                                        fill="#17452a"
                                        stroke="#9bd93c"
                                        strokeWidth="3"
                                    />
                                </svg>
                                <div className="relative z-10 text-center -mt-2">
                                    <p className="font-display text-2xl font-extrabold text-white leading-none">{streakCount}</p>
                                    <span className="block mt-1 text-secondary text-base">🔥</span>
                                </div>
                            </div>
                            {/* Laurel wings */}
                            <span className="absolute -bottom-1 left-0 text-secondary text-lg leading-none transform -rotate-6" aria-hidden="true">🌿</span>
                            <span className="absolute -bottom-1 right-0 text-secondary text-lg leading-none transform rotate-6 scale-x-[-1]" aria-hidden="true">🌿</span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h3 className="font-display text-base font-extrabold text-text-primary">Streak</h3>
                                <span className="text-base">🔥</span>
                            </div>
                            <p className="mt-1 text-2xl font-extrabold text-text-primary leading-none">
                                {streakCount} <span className="text-sm font-semibold text-text-secondary">days</span>
                            </p>
                            <p className="mt-1 text-sm font-bold text-primary">Keep it up!</p>
                            <p className="mt-0.5 text-xs text-text-secondary leading-tight">You're building unstoppable momentum.</p>
                        </div>
                    </div>

                    {/* Day dots */}
                    <div className="mt-3 flex items-center justify-between gap-1">
                        {weekDots.map((d, i) => (
                            <div key={i} className="flex flex-col items-center gap-1.5">
                                <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center ${d.done && !d.isToday ? 'bg-primary' : d.isToday ? 'border-2 border-primary bg-bg-card' : 'border-2 border-border bg-transparent'}`}
                                >
                                    {d.done && !d.isToday && <Check size={12} className="text-secondary" strokeWidth={3} />}
                                </div>
                                <span className="text-[10px] font-semibold text-text-muted">{d.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Recovery tip ── */}
                <button
                    onClick={() => navigate('/nutrition')}
                    className="w-full rounded-3xl bg-tertiary-container/40 p-4 flex items-center gap-3 border border-tertiary/15 text-left"
                >
                    <div className="w-10 h-10 rounded-2xl bg-bg-card flex items-center justify-center shrink-0">
                        <Droplets size={18} className="text-tertiary" fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary">Recovery Tip</p>
                        <p className="text-xs text-text-secondary leading-snug mt-0.5">
                            Great session! Hydrate well, stretch lightly, and refuel your body to recover stronger.
                        </p>
                    </div>
                    <ChevronRight size={16} className="text-text-muted shrink-0" />
                </button>

                {/* ── CTAs ── */}
                <button
                    onClick={() => navigate('/', { replace: true })}
                    className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-card"
                >
                    <Check size={18} strokeWidth={2.8} /> Save &amp; Done
                </button>
                <button
                    onClick={() => { void shareWorkout(completedSummaryText); }}
                    className="w-full py-4 rounded-2xl border-2 border-primary text-base font-bold text-primary flex items-center justify-center gap-2 bg-bg-card"
                >
                    <Share2 size={17} strokeWidth={2.5} /> Share Your Achievement
                </button>
            </div>
        );
    }

    const exercises = activeSession!.exercises;
    const currentEx = exercises[currentExerciseIndex];
    const isFirst = currentExerciseIndex === 0;
    const isLast = currentExerciseIndex === exercises.length - 1;
    const completedSets = currentEx?.sets.filter(s => s.completed).length ?? 0;
    const totalSets = currentEx?.sets.length ?? 0;
    const sessionCompletedSets = exercises.reduce((sum, exercise) => sum + exercise.sets.filter((setItem) => setItem.completed).length, 0);
    const sessionTotalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const sessionProgressPct = sessionTotalSets > 0 ? Math.round((sessionCompletedSets / sessionTotalSets) * 100) : 0;
    const allSetsComplete = totalSets > 0 && completedSets === totalSets;
    const isIronSession = isIronTemplateId(activeSession!.templateId);

    const resolveSetType = (setItem?: ExerciseSet): IronSetType => {
        if (setItem?.setType) return setItem.setType;
        if (currentEx?.phaseType) return currentEx.phaseType;
        if (setItem?.isWarmup || currentEx?.isWarmup) return 'warmup';
        return 'accessories';
    };

    const currentPhaseType = resolveSetType(currentEx?.sets[0]);
    const currentPhaseMeta = setTypeMeta[currentPhaseType];
    const currentHistory = currentEx ? historyByExercise[normalizeExerciseName(currentEx.name)] ?? null : null;
    const lastSession = currentHistory?.sessions[0];
    const lastWeeksAgo = lastSession ? Math.max(0, dayjs().diff(dayjs(lastSession.date), 'week')) : null;
    const currentSuggestion = useMemo(() => {
        if (!currentEx) return null;
        return getProgressionSuggestionFromHistory(
            currentHistory,
            currentEx.name,
            currentEx.plannedReps,
            activeTemplate?.progressionRule || 'linear'
        );
    }, [activeTemplate?.progressionRule, currentEx, currentHistory]);

    const getHistoricalBestScore = (history: ExerciseHistory | null): number => {
        if (!history) return 0;
        return history.sessions.reduce((best, session) => {
            const candidate = session.sets.reduce((sessionBest, setItem) => {
                return Math.max(sessionBest, setItem.weight * setItem.reps);
            }, 0);
            return Math.max(best, candidate);
        }, 0);
    };

    const handleSetPress = (setItem: ExerciseSet) => {
        if (!currentEx) return;
        if (setItem.completed) {
            toggleSetComplete(currentEx.id, setItem.id);
            return;
        }

        completeSet(currentEx.id, setItem.id);

        if (!isIronSession) return;

        const key = normalizeExerciseName(currentEx.name);
        const history = historyByExercise[key] ?? null;
        const historicalBest = getHistoricalBestScore(history);
        const sessionBest = sessionBestScores[key] ?? 0;
        const candidateScore = setItem.weight * setItem.reps;

        if (candidateScore > Math.max(historicalBest, sessionBest) && candidateScore > 0) {
            updateSet(currentEx.id, setItem.id, { personalBest: true });
            setSessionBestScores((prev) => ({ ...prev, [key]: candidateScore }));
            toast.success('🔥 New PR!');
        }
    };

    // ─── Exercise picker ───
    const filtered = COMMON_EXERCISES.filter(e => e.toLowerCase().includes(search.toLowerCase()));

    const handleAddExercise = (name: string) => {
        addExercise(name);
        setShowPicker(false);
        setSearch('');
        setCustom('');
        // Jump to the newly added exercise
        setTimeout(() => goToExercise(exercises.length), 50);
    };

    const handleAddCustom = () => {
        if (custom.trim()) handleAddExercise(custom.trim());
    };

    // ─── Camera ───
    const capturePhoto = async () => {
        if (!webcamRef.current || !user) return;
        const src = webcamRef.current.getScreenshot();
        if (!src) return;
        setUploading(true);
        try {
            const res = await fetch(src);
            const blob = await res.blob();
            const compressed = await compressImage(blob);
            const url = await uploadMedia(user.uid, compressed, 'photo.webp');
            addMediaUrl(url);
            toast.success('Photo saved! 📸');
        } catch (err: any) {
            toast.error(`Upload failed: ${err?.message || 'Unknown error'}`);
        } finally { setUploading(false); }
    };

    const startRecording = () => {
        if (!webcamRef.current?.stream) return;
        chunksRef.current = [];
        const mr = new MediaRecorder(webcamRef.current.stream, { mimeType: 'video/webm' });
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = async () => {
            if (!user) return;
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setUploading(true);
            try {
                const url = await uploadMedia(user.uid, blob, 'video.webm');
                addMediaUrl(url);
                toast.success('Video saved! 🎬');
            } catch { toast.error('Failed to upload video'); }
            finally { setUploading(false); }
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setIsRecording(true);
        setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        }, 30000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    // ─── End workout ───
    const handleEnd = async () => {
        if (finishingWorkout) return;
        const completed = endWorkout();
        if (!completed) return;
        setFinishingWorkout(true);

        const summary = generateWorkoutSummary(completed);
        try {
            await saveWorkout(completed);
        } catch {
            try {
                await enqueueAction({ type: 'workout', action: 'create', data: completed });
                toast('Saved offline — will sync when online', { icon: '📴' });
            } catch (queueError) {
                console.warn('Failed to save workout and enqueue fallback:', queueError);
                toast.error('Could not save workout. Check connection and retry.');
            }
        } finally {
            setFinishingWorkout(false);
            setCompletedSession(completed);
            setCompletedSummaryText(summary);
        }
    };

    const handleCancel = () => {
        if (confirm('Cancel workout? All data will be lost.')) {
            cancelWorkout();
            navigate('/workout', { replace: true });
        }
    };

    const cycleTimerAlarm = () => {
        const options = [0, 5, 10, 15, 20];
        const currentIndex = options.indexOf(timerAlarmMinutes);
        const nextValue = options[(currentIndex + 1) % options.length];
        setTimerAlarmMinutes(nextValue);
        if (nextValue === 0) {
            toast('Workout timer alarm off');
        } else {
            toast(`Workout timer alarm every ${nextValue} min`);
        }
    };

    const timerAlarmLabel = timerAlarmMinutes > 0 ? `Alarm ${timerAlarmMinutes}m` : 'Alarm off';

    return (
        <div className="active-workout-shell mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-6 pt-4">
            {/* Rest timer overlay */}
            <RestTimer />

            {/* ── Top bar ── */}
            <div className="mb-4">
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-bg-input overflow-hidden mb-3">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${sessionProgressPct}%` }}
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <ActionButton onClick={handleCancel} size="sm" variant="ghost">
                        Cancel
                    </ActionButton>
                    <div className="flex flex-col items-center">
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Workout Progress</p>
                        <span className="font-display text-lg font-extrabold text-text-primary">{sessionProgressPct}%</span>
                    </div>
                    <button
                        onClick={() => setTimerRunning(!isTimerRunning)}
                        className="flex items-center gap-1.5 rounded-2xl bg-bg-card border border-border px-3 py-2 shadow-card"
                    >
                        {isTimerRunning
                            ? <Pause size={14} className="text-amber" />
                            : <Play size={14} className="text-green" />}
                        <span className="font-display text-base font-extrabold tabular-nums text-text-primary">
                            {formatDuration(timerSeconds)}
                        </span>
                    </button>
                    <ActionButton
                        onClick={() => setShowMenu(!showMenu)}
                        size="icon"
                        variant="ghost"
                        icon={<MoreHorizontal size={22} />}
                        aria-label="Workout menu"
                    />
                </div>
            </div>

            {/* Overflow menu */}
            {showMenu && (
                <div className="absolute top-16 right-4 z-50 bg-bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-fade-in">
                    {import.meta.env.VITE_SUPABASE_URL && (
                        <button
                            onClick={() => { setShowCamera(!showCamera); setShowMenu(false); }}
                            className="w-full text-left px-5 py-3 text-sm hover:bg-bg-card flex items-center gap-3"
                        >
                            <Camera size={16} className="text-text-muted" /> Camera
                        </button>
                    )}
                    <button
                        onClick={() => { startRest(defaultRestSeconds); setShowMenu(false); }}
                        className="w-full text-left px-5 py-3 text-sm hover:bg-bg-card flex items-center gap-3"
                    >
                        <Timer size={16} className="text-text-muted" /> Rest Timer
                    </button>
                    <button
                        onClick={() => { cycleTimerAlarm(); setShowMenu(false); }}
                        className="w-full text-left px-5 py-3 text-sm hover:bg-bg-card flex items-center justify-between gap-3"
                    >
                        <span className="flex items-center gap-3">
                            <Bell size={16} className="text-text-muted" /> Workout Alarm
                        </span>
                        <span className="text-xs text-text-muted">{timerAlarmLabel}</span>
                    </button>
                    <button
                        onClick={() => { handleEnd(); setShowMenu(false); }}
                        disabled={finishingWorkout}
                        className="w-full text-left px-5 py-3 text-sm text-red hover:bg-red/10 flex items-center gap-3"
                    >
                        <Check size={16} /> Finish Workout
                    </button>
                </div>
            )}
            {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}

            {/* ── Exercise progress strip ── */}
            <div className="mb-5 flex gap-1.5">
                {exercises.map((ex, i) => {
                    const done = ex.sets.length > 0 && ex.sets.every(s => s.completed);
                    const active = i === currentExerciseIndex;
                    return (
                        <button
                            key={ex.id}
                            onClick={() => goToExercise(i)}
                            aria-label={`Go to exercise ${i + 1}: ${ex.name}`}
                            className={`h-2 rounded-full flex-1 transition-all ${done ? 'bg-green' : active ? 'bg-accent' : 'bg-bg-card'
                                }`}
                        />
                    );
                })}
                {/* Placeholder for "add exercise" */}
                <button
                    onClick={() => setShowPicker(true)}
                    className="flex h-8 w-8 shrink-0 -mt-3 items-center justify-center rounded-full bg-bg-card"
                    aria-label="Add exercise"
                >
                    <Plus size={12} className="text-text-muted" />
                </button>
            </div>

            {/* ── Current exercise card ── */}
            {currentEx ? (
                <div className="flex-1 flex flex-col">
                    {/* Exercise header card */}
                    <div className="rounded-3xl bg-bg-card p-5 mb-4 shadow-lifted">
                        {/* Label + nav */}
                        <div className="flex items-center justify-between mb-3">
                            <button
                                onClick={prevExercise}
                                disabled={isFirst}
                                className="w-10 h-10 rounded-2xl bg-bg-surface flex items-center justify-center disabled:opacity-25"
                                aria-label="Previous exercise"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="text-center flex-1 px-2">
                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
                                    Current Exercise
                                </p>
                                {isIronSession && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border mt-1 ${currentPhaseMeta.className}`}>
                                        {currentPhaseMeta.label}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={nextExercise}
                                disabled={isLast}
                                className="w-10 h-10 rounded-2xl bg-bg-surface flex items-center justify-center disabled:opacity-25"
                                aria-label="Next exercise"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Big exercise name */}
                        <h2 className="font-display text-3xl font-extrabold text-text-primary text-center leading-tight mb-1">
                            {currentEx.name}
                        </h2>
                        {currentEx.phaseName && (
                            <p className="text-sm text-text-muted text-center mb-2">{currentEx.phaseName}</p>
                        )}

                        {/* Set indicator circles */}
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-wide mr-1">
                                Set {completedSets + (allSetsComplete ? 0 : 1)} of {totalSets}
                            </p>
                            {currentEx.sets.map((s, idx) => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSetPress(s)}
                                    className="flex items-center justify-center rounded-full font-bold text-sm transition-all"
                                    style={{
                                        width: 32,
                                        height: 32,
                                        background: s.completed ? '#17452a' : idx === completedSets ? '#dcefd8' : '#edf4e8',
                                        color: s.completed ? 'white' : idx === completedSets ? '#17452a' : '#748177',
                                        border: idx === completedSets && !s.completed ? '2px solid #9bd93c' : '2px solid transparent',
                                    }}
                                >
                                    {s.completed ? '✓' : idx + 1}
                                </button>
                            ))}
                        </div>

                        {/* REPS and WEIGHT big display */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="rounded-2xl bg-bg-surface p-3 text-center">
                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1">Reps</p>
                                <p className="font-display text-4xl font-extrabold text-text-primary leading-none">
                                    {currentEx.sets[completedSets]?.reps || currentEx.plannedReps || '—'}
                                    {currentEx.plannedReps && currentEx.sets[completedSets]?.reps && currentEx.sets[completedSets].reps !== currentEx.plannedReps
                                        ? <span className="text-lg text-text-muted">/{currentEx.plannedReps}</span>
                                        : null}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-bg-surface p-3 text-center">
                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1">Weight</p>
                                <p className="font-display text-4xl font-extrabold text-text-primary leading-none">
                                    {currentEx.sets[completedSets]?.weight || currentEx.plannedWeight || '—'}
                                    <span className="text-lg text-text-muted ml-1">kg</span>
                                </p>
                            </div>
                        </div>

                        {/* Coaching cue */}
                        {currentEx.cue && (
                            <div className="flex items-start gap-2 p-3 rounded-2xl bg-accent/5 border border-accent/10">
                                <Zap size={14} className="text-accent mt-0.5 shrink-0" />
                                <p className="text-xs text-text-secondary">{currentEx.cue}</p>
                            </div>
                        )}

                        {currentSuggestion && (
                            <div className="mt-3 rounded-2xl border border-cyan/20 bg-cyan/8 p-3">
                                <p className="text-xs uppercase tracking-wide text-cyan font-bold">Next Load Suggestion</p>
                                <p className="text-sm font-semibold text-text-primary mt-1">
                                    {formatProgressionInsightTarget(currentSuggestion)}
                                </p>
                                <p className="text-xs text-text-secondary mt-0.5">{currentSuggestion.reason}</p>
                            </div>
                        )}

                        {isIronSession && lastSession && (
                            <p className="mt-3 text-xs text-text-muted text-center">
                                Last time: {formatSetPerformance(lastSession.bestSet.weight, lastSession.bestSet.reps)}
                                {lastWeeksAgo !== null ? ` · ${lastWeeksAgo}w ago` : ''}
                            </p>
                        )}
                    </div>

                    <div className="glass rounded-2xl p-4 mb-4">
                        {activeSession!.scheduledWorkoutId && (activeSession!.coachNotes || '').trim().length > 0 && (
                            <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 mb-3">
                                <p className="text-xs uppercase tracking-wide text-accent mb-1 flex items-center gap-1">
                                    <ClipboardList size={12} />
                                    Coach Brief
                                </p>
                                <p className="text-sm text-text-primary whitespace-pre-wrap">{activeSession!.coachNotes}</p>
                            </div>
                        )}
                        <p className="text-xs uppercase tracking-wide text-text-muted mb-2">Workout Notes</p>
                        <textarea
                            value={activeSession!.notes}
                            onChange={(event) => updateSessionNotes(event.target.value)}
                            placeholder="How did this session feel? PR attempts, energy, pain points..."
                            rows={3}
                            className="w-full bg-bg-input border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none"
                        />
                    </div>

                    {/* Camera panel */}
                    {showCamera && (
                        <div className="glass rounded-2xl p-3 mb-4 animate-slide-up">
                            <div className="rounded-xl overflow-hidden mb-3 aspect-[4/3] bg-bg-input">
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ facingMode: 'environment', width: 640, height: 480 }}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex items-center justify-center gap-4">
                                <button onClick={capturePhoto} disabled={uploading}
                                    className="w-14 h-14 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                                    <Camera size={22} className="text-bg-primary" />
                                </button>
                                {!isRecording ? (
                                    <button onClick={startRecording} disabled={uploading}
                                        className="w-14 h-14 rounded-full bg-red flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                                        <Video size={22} className="text-white" />
                                    </button>
                                ) : (
                                    <button onClick={stopRecording}
                                        className="w-14 h-14 rounded-full bg-red flex items-center justify-center animate-pulse">
                                        <StopCircle size={22} className="text-white" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Sets table ── */}
                    <div className="glass rounded-2xl overflow-hidden mb-4">
                        {/* Header row — 4 columns: Set | KG | Reps | Delete */}
                        <div className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 px-3 pt-3 pb-2 text-[11px] text-text-muted font-semibold uppercase tracking-wide">
                            <span className="text-center">Set</span>
                            <span className="text-center">Weight (kg)</span>
                            <span className="text-center">Reps</span>
                            <span />
                        </div>

                        <div className="divide-y divide-border/40">
                            {currentEx.sets.map((set, idx) => (
                                <div
                                    key={set.id}
                                    className={`grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 items-center px-3 py-2 transition-colors ${set.completed ? 'bg-green/5' : ''}`}
                                >
                                    {/* Set number / complete toggle */}
                                    {(() => {
                                        const setType = resolveSetType(set);
                                        const setTypeBadge = setTypeMeta[setType];
                                        return (
                                    <button
                                        onClick={() => handleSetPress(set)}
                                        className="flex items-center justify-center w-full h-11"
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            {set.completed
                                                ? <CheckSquare size={22} className="text-green" />
                                                : <div className="w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center active:scale-90 transition-transform">
                                                    <span className="text-sm font-bold text-text-muted">{idx + 1}</span>
                                                </div>
                                            }
                                            {isIronSession && (
                                                <span className={`w-9 text-center text-[9px] px-1 py-0.5 rounded border uppercase tracking-wide ${setTypeBadge.className}`}>
                                                    {setTypeBadge.shortLabel}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                        );
                                    })()}

                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={set.weight || ''}
                                        onChange={e => updateSet(currentEx.id, set.id, { weight: parseFloat(e.target.value) || 0 })}
                                        placeholder={currentEx.plannedWeight ? String(currentEx.plannedWeight) : '0'}
                                        className={`w-full min-w-0 bg-bg-input border rounded-xl py-3 px-1 text-base md:text-sm text-center focus:outline-none focus:border-accent/50 transition-colors ${set.completed ? 'border-green/20 text-text-muted' : 'border-border'}`}
                                    />

                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={set.reps || ''}
                                        onChange={e => updateSet(currentEx.id, set.id, { reps: parseInt(e.target.value) || 0 })}
                                        placeholder={currentEx.plannedReps ? String(currentEx.plannedReps) : '0'}
                                        className={`w-full min-w-0 bg-bg-input border rounded-xl py-3 px-1 text-base md:text-sm text-center focus:outline-none focus:border-accent/50 transition-colors ${set.completed ? 'border-green/20 text-text-muted' : 'border-border'}`}
                                    />

                                    {/* Delete set — large tap target */}
                                    <button
                                        onClick={() => removeSet(currentEx.id, set.id)}
                                        className="flex items-center justify-center w-full h-11 text-text-muted hover:text-red active:scale-90 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add set */}
                        <div className="flex gap-2 px-4 pb-3 pt-2">
                            <button
                                onClick={() => addSet(currentEx.id)}
                                className="flex-1 py-2.5 rounded-xl border border-dashed border-border text-text-muted text-xs font-medium hover:border-accent/40 hover:text-accent transition-colors"
                            >
                                + Add Set
                            </button>
                            <button
                                onClick={() => startRest(currentEx.restSeconds || defaultRestSeconds)}
                                className="px-4 py-2.5 rounded-xl border border-dashed border-border text-text-muted text-xs font-medium hover:border-accent/40 hover:text-accent transition-colors flex items-center gap-1"
                            >
                                <Timer size={13} /> Rest
                            </button>
                        </div>
                    </div>

                    {/* ── Action row ── */}
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setTimerRunning(!isTimerRunning)}
                            className="flex items-center gap-2 rounded-2xl border border-border bg-bg-card px-4 py-4 font-semibold text-sm text-text-secondary shadow-card"
                        >
                            {isTimerRunning ? <Pause size={18} className="text-amber" /> : <Play size={18} className="text-green" />}
                            Pause
                        </button>
                        <button
                            onClick={() => {
                                const nextIncompleteSet = currentEx.sets.find((s) => !s.completed);
                                if (nextIncompleteSet) handleSetPress(nextIncompleteSet);
                                else if (!isLast) nextExercise();
                            }}
                            className="flex-1 py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-lifted"
                        >
                            <Check size={20} />
                            Complete Set
                        </button>
                        {!isLast ? (
                            <button
                                onClick={nextExercise}
                                className="flex items-center gap-1 rounded-2xl border border-border bg-bg-card px-4 py-4 font-semibold text-sm text-text-secondary shadow-card"
                            >
                                Next
                                <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleEnd}
                                disabled={finishingWorkout}
                                className="flex items-center gap-1 rounded-2xl bg-green px-4 py-4 text-white font-bold text-sm shadow-card"
                            >
                                <Check size={18} />
                                Done
                            </button>
                        )}
                    </div>

                    {/* Up Next card */}
                    {!isLast && exercises[currentExerciseIndex + 1] && (
                        <div className="flex items-center gap-3 bg-bg-card rounded-2xl p-3 mb-3 border border-border">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-0.5">Up Next</p>
                                <p className="text-sm font-extrabold truncate">{exercises[currentExerciseIndex + 1].name}</p>
                                <p className="text-[11px] text-text-secondary">
                                    {exercises[currentExerciseIndex + 1].sets.length} sets
                                    {exercises[currentExerciseIndex + 1].plannedReps ? ` • ${exercises[currentExerciseIndex + 1].plannedReps} reps` : ''}
                                </p>
                            </div>
                            <button onClick={nextExercise} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#17452a' }}>
                                <ChevronRight size={18} color="white" />
                            </button>
                        </div>
                    )}

                    {/* Bottom stats strip */}
                    <div className="flex items-center justify-around bg-bg-card rounded-2xl p-3 shadow-card mb-2">
                        <div className="text-center">
                            <p className="text-xs text-text-muted">Calories</p>
                            <p className="text-base font-extrabold text-text-primary">
                                {Math.round(activeSession!.caloriesEstimate ?? (timerSeconds / 60 * 5))}
                            </p>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="text-center">
                            <p className="text-xs text-text-muted">Workout Time</p>
                            <p className="text-base font-extrabold text-text-primary">{formatDuration(timerSeconds)}</p>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="text-center">
                            <p className="text-xs text-text-muted">Sets Done</p>
                            <p className="text-base font-extrabold text-text-primary">{sessionCompletedSets}/{sessionTotalSets}</p>
                        </div>
                    </div>

                    {/* Remove exercise link */}
                    <button
                        onClick={() => removeExercise(currentEx.id)}
                        className="w-full py-2 text-xs text-text-muted flex items-center justify-center gap-1"
                    >
                        <Trash2 size={13} /> Remove this exercise
                    </button>
                </div>
            ) : (
                /* Empty — add first exercise */
                <div className="flex flex-1 items-center justify-center py-12">
                    <EmptyState
                        title="Add an exercise to get started"
                        description="Build the session here if you skipped planning."
                        actionLabel="Add exercise"
                        onAction={() => setShowPicker(true)}
                    />
                </div>
            )}

            {/* Exercise picker sheet */}
            {showPicker && (
                <div
                    className="fixed inset-0 z-[100] bg-black/60 flex items-end"
                    onClick={() => setShowPicker(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl p-6 max-h-[80vh] flex flex-col animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Add Exercise</h3>
                            <button onClick={() => setShowPicker(false)} className="p-2 text-text-muted">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="relative mb-3">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search exercises..."
                                autoFocus
                                className="w-full bg-bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-accent/50"
                            />
                        </div>

                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={custom}
                                onChange={e => setCustom(e.target.value)}
                                placeholder="Custom exercise..."
                                className="flex-1 bg-bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent/50"
                                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                            />
                            <button
                                onClick={handleAddCustom}
                                disabled={!custom.trim()}
                                className="px-5 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-30"
                            >
                                Add
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 -mx-2">
                            {filtered.map(name => (
                                <button
                                    key={name}
                                    onClick={() => handleAddExercise(name)}
                                    className="w-full text-left py-3 px-4 rounded-xl text-sm hover:bg-bg-card transition-colors flex items-center justify-between group"
                                >
                                    <span>{name}</span>
                                    <Plus size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryStat({
    icon,
    iconBg,
    value,
    unit,
    label,
}: {
    icon: React.ReactNode;
    iconBg: string;
    value: string;
    unit: string;
    label: string;
}) {
    return (
        <div className="flex flex-col items-center text-center">
            <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center mb-2`}>
                {icon}
            </div>
            <div className="flex items-baseline gap-0.5">
                <p className="font-display text-base font-extrabold text-text-primary leading-none">{value}</p>
                <span className="text-[10px] font-bold text-text-muted leading-none">{unit}</span>
            </div>
            <p className="mt-1 text-[10px] text-text-secondary leading-tight">{label}</p>
        </div>
    );
}
