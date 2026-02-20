import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../stores/workoutStore';
import dayjs from 'dayjs';
import { getExerciseHistory, saveWorkout, uploadMedia } from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import { formatDuration, generateWorkoutSummary, shareWorkout, compressImage } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';
import { COMMON_EXERCISES } from '../lib/constants';
import RestTimer from '../components/RestTimer';
import toast from 'react-hot-toast';
import type { ExerciseHistory, ExerciseSet, IronSetType } from '../lib/types';
import {
    Plus, X, Check, CheckSquare,
    Camera, Video, StopCircle, Pause, Play,
    Search, Timer, ChevronLeft, ChevronRight,
    Zap, MoreHorizontal, Trash2,
} from 'lucide-react';
import Webcam from 'react-webcam';
import { isIronTemplateId } from '../lib/ironProtocol';

const normalizeExerciseName = (name: string): string =>
    name.toLowerCase().trim().replace(/\s+/g, ' ');

const setTypeMeta: Record<IronSetType, { label: string; className: string }> = {
    warmup: { label: 'Warm-Up', className: 'bg-bg-input text-text-muted border-border' },
    working: { label: 'Working', className: 'bg-cyan/15 text-cyan border-cyan/30' },
    heavy: { label: 'Heavy', className: 'bg-orange-600/20 text-orange-400 border-orange-500/40' },
    backoff: { label: 'Back-Off', className: 'bg-green/15 text-green border-green/30' },
    accessories: { label: 'Accessory', className: 'bg-bg-input text-text-muted border-border' },
};

export default function ActiveWorkoutPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const {
        activeSession, timerSeconds, isTimerRunning,
        currentExerciseIndex, goToExercise, nextExercise, prevExercise,
        addExercise, removeExercise, addSet, removeSet, updateSet, completeSet, toggleSetComplete,
        endWorkout, cancelWorkout, tick, setTimerRunning, addMediaUrl,
        startRest, defaultRestSeconds, isResting,
    } = useWorkoutStore();

    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState('');
    const [custom, setCustom] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [uploading, setUploading] = useState(false);
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

    if (!activeSession) return null;

    const exercises = activeSession.exercises;
    const currentEx = exercises[currentExerciseIndex];
    const isFirst = currentExerciseIndex === 0;
    const isLast = currentExerciseIndex === exercises.length - 1;
    const completedSets = currentEx?.sets.filter(s => s.completed).length ?? 0;
    const totalSets = currentEx?.sets.length ?? 0;
    const allSetsComplete = totalSets > 0 && completedSets === totalSets;
    const isIronSession = isIronTemplateId(activeSession.templateId);

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
    const capturePhoto = useCallback(async () => {
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
    }, [user, addMediaUrl]);

    const startRecording = useCallback(() => {
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
    }, [user, addMediaUrl]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    // ─── End workout ───
    const handleEnd = async () => {
        const completed = endWorkout();
        if (!completed) return;

        const totalSetsAll = completed.exercises.reduce((s, e) => s + e.sets.length, 0);
        const summary = generateWorkoutSummary(
            completed.duration,
            completed.exercises.length,
            totalSetsAll,
            completed.caloriesEstimate,
        );

        toast.success('Workout complete! 🎉', { duration: 4000 });
        navigate('/', { replace: true });

        saveWorkout(completed).catch(async () => {
            await enqueueAction({ type: 'workout', action: 'create', data: completed });
            toast('Saved offline — will sync when online', { icon: '📴' });
        });

        setTimeout(() => {
            if (confirm('Share your workout? 💪')) shareWorkout(summary);
        }, 800);
    };

    const handleCancel = () => {
        if (confirm('Cancel workout? All data will be lost.')) {
            cancelWorkout();
            navigate('/workout', { replace: true });
        }
    };

    return (
        <div className="max-w-lg mx-auto flex flex-col min-h-screen px-4 pt-4 pb-6">
            {/* Rest timer overlay */}
            <RestTimer />

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between mb-5">
                <button onClick={handleCancel} className="text-sm text-text-muted font-medium px-2 py-2">
                    Cancel
                </button>
                {/* Workout timer */}
                <button
                    onClick={() => setTimerRunning(!isTimerRunning)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-card"
                >
                    {isTimerRunning
                        ? <Pause size={14} className="text-amber" />
                        : <Play size={14} className="text-green" />}
                    <span className="text-xl font-black font-mono gradient-text">
                        {formatDuration(timerSeconds)}
                    </span>
                </button>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-text-muted"
                >
                    <MoreHorizontal size={22} />
                </button>
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
                        onClick={() => { handleEnd(); setShowMenu(false); }}
                        className="w-full text-left px-5 py-3 text-sm text-red hover:bg-red/10 flex items-center gap-3"
                    >
                        <Check size={16} /> Finish Workout
                    </button>
                </div>
            )}
            {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}

            {/* ── Exercise progress strip ── */}
            <div className="flex gap-1.5 mb-5">
                {exercises.map((ex, i) => {
                    const done = ex.sets.length > 0 && ex.sets.every(s => s.completed);
                    const active = i === currentExerciseIndex;
                    return (
                        <button
                            key={ex.id}
                            onClick={() => goToExercise(i)}
                            className={`h-1.5 rounded-full flex-1 transition-all ${done ? 'bg-green' : active ? 'bg-accent' : 'bg-bg-card'
                                }`}
                        />
                    );
                })}
                {/* Placeholder for "add exercise" */}
                <button
                    onClick={() => setShowPicker(true)}
                    className="w-6 h-6 rounded-full bg-bg-card flex items-center justify-center shrink-0 -mt-2"
                >
                    <Plus size={12} className="text-text-muted" />
                </button>
            </div>

            {/* ── Current exercise card ── */}
            {currentEx ? (
                <div className="flex-1 flex flex-col">
                    {/* Exercise header */}
                    <div className="glass rounded-3xl p-5 mb-4">
                        {/* Exercise name + nav */}
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={prevExercise}
                                disabled={isFirst}
                                className="w-9 h-9 rounded-xl glass flex items-center justify-center disabled:opacity-20"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="text-center flex-1 px-3">
                                <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">
                                    Exercise {currentExerciseIndex + 1} of {exercises.length}
                                </p>
                                {isIronSession && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border mb-1 ${currentPhaseMeta.className}`}>
                                        {currentPhaseMeta.label}
                                    </span>
                                )}
                                <h2 className="text-2xl font-black">{currentEx.name}</h2>
                                {currentEx.plannedSets && (
                                    <p className="text-sm text-text-secondary mt-1">
                                        Target: {currentEx.plannedSets} sets
                                        {currentEx.plannedReps ? ` × ${currentEx.plannedReps} reps` : ''}
                                        {currentEx.plannedWeight ? ` @ ${currentEx.plannedWeight}kg` : ''}
                                    </p>
                                )}
                                {isIronSession && (
                                    <p className="text-xs text-text-secondary mt-1">
                                        {lastSession
                                            ? `Last time: ${lastSession.bestSet.weight} kg × ${lastSession.bestSet.reps} reps (${lastWeeksAgo} week${lastWeeksAgo === 1 ? '' : 's'} ago)`
                                            : 'Last time: no history yet'}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={nextExercise}
                                disabled={isLast}
                                className="w-9 h-9 rounded-xl glass flex items-center justify-center disabled:opacity-20"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* Coaching cue */}
                        {currentEx.cue && (
                            <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-accent/5 border border-accent/10">
                                <Zap size={14} className="text-accent mt-0.5 shrink-0" />
                                <p className="text-xs text-text-secondary">{currentEx.cue}</p>
                            </div>
                        )}

                        {/* Set completion progress */}
                        <div className="flex items-center gap-2 mt-4">
                            <div className="flex-1 h-2 bg-bg-input rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-green transition-all duration-500"
                                    style={{ width: totalSets > 0 ? `${(completedSets / totalSets) * 100}%` : '0%' }}
                                />
                            </div>
                            <span className="text-xs font-bold text-text-secondary shrink-0">
                                {completedSets}/{totalSets} sets
                            </span>
                        </div>
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
                        <div className="grid grid-cols-[44px_1fr_1fr_44px] gap-2 px-3 pt-3 pb-2 text-[11px] text-text-muted font-semibold uppercase tracking-wide">
                            <span className="text-center">Set</span>
                            <span className="text-center">Weight (kg)</span>
                            <span className="text-center">Reps</span>
                            <span />
                        </div>

                        <div className="divide-y divide-border/40">
                            {currentEx.sets.map((set, idx) => (
                                <div
                                    key={set.id}
                                    className={`grid grid-cols-[44px_1fr_1fr_44px] gap-2 items-center px-3 py-2 transition-colors ${set.completed ? 'bg-green/5' : ''}`}
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
                                                <span className={`text-[9px] px-1 py-0.5 rounded border uppercase tracking-wide ${setTypeBadge.className}`}>
                                                    {setTypeBadge.label}
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
                                        className={`bg-bg-input border rounded-xl py-3 text-sm text-center focus:outline-none focus:border-accent/50 transition-colors ${set.completed ? 'border-green/20 text-text-muted' : 'border-border'}`}
                                    />

                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={set.reps || ''}
                                        onChange={e => updateSet(currentEx.id, set.id, { reps: parseInt(e.target.value) || 0 })}
                                        placeholder={currentEx.plannedReps ? String(currentEx.plannedReps) : '0'}
                                        className={`bg-bg-input border rounded-xl py-3 text-sm text-center focus:outline-none focus:border-accent/50 transition-colors ${set.completed ? 'border-green/20 text-text-muted' : 'border-border'}`}
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

                    {/* ── Primary CTA ── */}
                    {!isLast ? (
                        <button
                            id="next-exercise-btn"
                            onClick={nextExercise}
                            className={`w-full py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-3 active:scale-[0.97] transition-all shadow-lg ${allSetsComplete
                                ? 'gradient-green text-white shadow-green/20'
                                : 'gradient-primary text-white shadow-accent/20'
                                }`}
                        >
                            {allSetsComplete ? <Check size={22} /> : <ChevronRight size={22} />}
                            {allSetsComplete ? 'Done — Next Exercise' : 'Next Exercise'}
                            <span className="text-sm opacity-70">
                                ({currentExerciseIndex + 2} of {exercises.length})
                            </span>
                        </button>
                    ) : (
                        <button
                            id="finish-workout-btn"
                            onClick={handleEnd}
                            className="w-full py-5 rounded-3xl gradient-green text-white font-bold text-lg flex items-center justify-center gap-3 active:scale-[0.97] transition-transform shadow-lg shadow-green/20"
                        >
                            <Check size={22} />
                            Finish Workout 🎉
                        </button>
                    )}

                    {/* Remove exercise link */}
                    <button
                        onClick={() => {
                            removeExercise(currentEx.id);
                        }}
                        className="mt-3 w-full py-2 text-xs text-text-muted flex items-center justify-center gap-1 hover:text-red transition-colors"
                    >
                        <Trash2 size={13} /> Remove this exercise
                    </button>
                </div>
            ) : (
                /* Empty — add first exercise */
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                    <p className="text-text-secondary mb-4">Add an exercise to get started</p>
                    <button
                        onClick={() => setShowPicker(true)}
                        className="px-6 py-3 rounded-xl gradient-primary text-white font-semibold"
                    >
                        + Add Exercise
                    </button>
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
