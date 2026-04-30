import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Calendar, Check, ChevronRight, Clock, Dumbbell, Eye, Flame, Leaf,
    Play, Plus, Search, ShieldCheck, TrendingUp, X, Zap,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import {
    getFitnessDailyConfig,
    getFitnessDailyLogs,
    getOneRepMaxes,
    getUserWorkouts,
    saveFitnessDailyConfig,
    saveFitnessDailyLog,
} from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import type { DailyTrackLogEntry, FitnessDailyConfig, FitnessDailyLog, GuidedTrackStage, OneRepMaxes, UserDailyTrack, WorkoutSession } from '../lib/types';
import {
    getIronScheduleForDate,
    getIronTemplateById,
    IRON_WEEKLY_SCHEDULE,
    normalizeOneRepMaxes,
    scaleTemplateForOneRepMaxes,
    type IronScheduleDay,
} from '../lib/ironProtocol';
import { formatSetPerformance, hasExternalLoad } from '../lib/exerciseRules';
import { searchExercises } from '../lib/exerciseLibraryService';
import {
    DAILY_TRACK_LIBRARY,
    applyGuidedRecommendation,
    buildLegacyDailyFlags,
    createUserDailyTrack,
    dedupeTracksByExerciseName,
    formatDailyTarget,
    getGuidedRecommendation,
    getGuidedStageLabel,
    getSeasonSummary,
    getTrackCompletionCount,
    getTrackEntry,
    isDailyComplete,
    nextTrackSortOrder,
    normalizeFitnessDailyConfig,
    normalizeFitnessDailyLog,
    setTrackStage,
    sortTracks,
    updateTrackEntry,
} from '../lib/fitnessDailies';

const normalizeExerciseName = (name: string): string =>
    name.toLowerCase().trim().replace(/\s+/g, ' ');

const getWeekStart = (date: Dayjs): Dayjs => {
    return date.startOf('day').subtract((date.day() + 6) % 7, 'day');
};

const guidedStageOptions: GuidedTrackStage[] = ['assisted', 'bodyweight', 'weighted'];

const pickBestSet = (sessions: WorkoutSession[], exerciseNames: string[]): string => {
    const nameSet = new Set(exerciseNames.map(normalizeExerciseName));
    let bestWeight = 0;
    let bestReps = 0;
    let bestScore = 0;

    for (const session of sessions) {
        for (const exercise of session.exercises) {
            if (!nameSet.has(normalizeExerciseName(exercise.name))) continue;
            for (const setItem of exercise.sets) {
                const score = hasExternalLoad(setItem.weight)
                    ? setItem.weight * setItem.reps
                    : (setItem.reps || 0);
                if (score > bestScore || (score === bestScore && setItem.weight > bestWeight)) {
                    bestScore = score;
                    bestWeight = setItem.weight;
                    bestReps = setItem.reps;
                }
            }
        }
    }

    if (bestScore <= 0) return '-';
    return formatSetPerformance(bestWeight, bestReps);
};

const buildSixWeekRows = (sessions: WorkoutSession[]) => {
    const thisWeekStart = getWeekStart(dayjs());

    return Array.from({ length: 6 }, (_, idx) => {
        const start = thisWeekStart.subtract(5 - idx, 'week');
        const end = start.add(6, 'day').endOf('day');
        const weekSessions = sessions.filter((s) => s.startedAt >= start.valueOf() && s.startedAt <= end.valueOf());
        const notes = weekSessions.find((s) => s.notes?.trim())?.notes || '-';

        return {
            weekLabel: `${start.format('MMM D')}`,
            bench: pickBestSet(weekSessions, ['flat bench press', 'bench press']),
            squat: pickBestSet(weekSessions, ['back squat', 'squat']),
            ohp: pickBestSet(weekSessions, ['overhead bb press', 'overhead press']),
            notes,
        };
    });
};

const SESSION_ICON: Record<string, typeof Dumbbell> = {
    Push: Dumbbell,
    Pull: TrendingUp,
    Legs: Flame,
    Rest: Leaf,
};

export default function IronProtocolPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { activeSession, initFromTemplatePlan, startFromTemplate } = useWorkoutStore();

    const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxes | null>(null);
    const [dailyConfig, setDailyConfig] = useState<FitnessDailyConfig | null>(null);
    const [dailyLogs, setDailyLogs] = useState<Record<string, FitnessDailyLog>>({});
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [showPatternRef, setShowPatternRef] = useState(false);
    const [showDailyManager, setShowDailyManager] = useState(false);
    const [dailySearch, setDailySearch] = useState('');
    const [updatingDaily, setUpdatingDaily] = useState(false);
    const [savingDailyConfig, setSavingDailyConfig] = useState(false);

    const today = dayjs();
    const todayKey = today.format('YYYY-MM-DD');
    const todaySchedule = getIronScheduleForDate(today);
    const [selectedWeekday, setSelectedWeekday] = useState<number>(today.day());

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        setOneRepMaxes((prev) => prev ?? normalizeOneRepMaxes(user.uid, null));
        setDailyConfig((prev) => prev ?? normalizeFitnessDailyConfig(user.uid, null));

        const loadFast = async () => {
            try {
                const [maxes, config, logs] = await Promise.all([
                    getOneRepMaxes(user.uid),
                    getFitnessDailyConfig(user.uid),
                    getFitnessDailyLogs(user.uid, 14),
                ]);
                if (cancelled) return;

                const normalizedConfig = normalizeFitnessDailyConfig(user.uid, config);
                setOneRepMaxes(normalizeOneRepMaxes(user.uid, maxes));
                setDailyConfig(normalizedConfig);
                setDailyLogs(logs.reduce<Record<string, FitnessDailyLog>>((acc, log) => {
                    acc[log.date] = normalizeFitnessDailyLog(user.uid, log.date, normalizedConfig, log);
                    return acc;
                }, {}));
            } catch (error) {
                console.warn('Failed to load Iron Protocol data:', error);
                if (!cancelled) {
                    setOneRepMaxes(normalizeOneRepMaxes(user.uid, null));
                    setDailyConfig(normalizeFitnessDailyConfig(user.uid, null));
                }
            }
        };

        const loadHistory = async () => {
            try {
                const history = await getUserWorkouts(user.uid, 90);
                if (!cancelled) setWorkouts(history);
            } catch (error) {
                console.warn('Failed to load Iron history rows:', error);
            }
        };

        loadFast();
        loadHistory();
        return () => { cancelled = true; };
    }, [user]);

    const todayLog = useMemo<FitnessDailyLog>(() => {
        const uid = user?.uid || 'LOCAL';
        const config = dailyConfig ?? normalizeFitnessDailyConfig(uid, null);
        return normalizeFitnessDailyLog(uid, todayKey, config, dailyLogs[todayKey]);
    }, [dailyConfig, dailyLogs, todayKey, user]);

    const dailyStreak = useMemo(() => {
        if (!dailyConfig) return 0;
        let streak = 0;
        for (let i = 0; i < 7; i++) {
            const dateKey = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
            if (isDailyComplete(dailyLogs[dateKey], dailyConfig)) streak++;
            else break;
        }
        return streak;
    }, [dailyConfig, dailyLogs]);

    const activeDailyTracks = useMemo(() => {
        if (!dailyConfig) return [];
        return sortTracks(dailyConfig.activeTracks.filter((t) => t.status === 'active'));
    }, [dailyConfig]);

    const seasonSummary = useMemo(() => {
        if (!dailyConfig) return null;
        return getSeasonSummary(dailyConfig);
    }, [dailyConfig]);

    const recommendedDailyTracks = useMemo(() => {
        const activeNames = new Set(activeDailyTracks.map((t) => normalizeExerciseName(t.exerciseName)));
        return DAILY_TRACK_LIBRARY.filter((t) => !activeNames.has(normalizeExerciseName(t.exerciseName)));
    }, [activeDailyTracks]);

    const dailySearchResults = useMemo(() => {
        if (dailySearch.trim().length < 2) return [];
        const activeNames = new Set(activeDailyTracks.map((t) => normalizeExerciseName(t.exerciseName)));
        return searchExercises(dailySearch)
            .map((e) => e.name)
            .filter((name) => !activeNames.has(normalizeExerciseName(name)))
            .slice(0, 8);
    }, [activeDailyTracks, dailySearch]);

    const sixWeekRows = useMemo(() => buildSixWeekRows(workouts), [workouts]);

    const todayTemplate = useMemo(() => {
        if (!oneRepMaxes || !todaySchedule.templateId) return null;
        const template = getIronTemplateById(todaySchedule.templateId);
        if (!template) return null;
        return scaleTemplateForOneRepMaxes(template, oneRepMaxes);
    }, [oneRepMaxes, todaySchedule.templateId]);

    const selectedSchedule = useMemo<IronScheduleDay>(() => {
        return IRON_WEEKLY_SCHEDULE.find((e) => e.weekday === selectedWeekday) ?? todaySchedule;
    }, [selectedWeekday, todaySchedule]);

    const selectedTemplate = useMemo(() => {
        if (!oneRepMaxes || !selectedSchedule.templateId) return null;
        const template = getIronTemplateById(selectedSchedule.templateId);
        if (!template) return null;
        return scaleTemplateForOneRepMaxes(template, oneRepMaxes);
    }, [oneRepMaxes, selectedSchedule.templateId]);

    const getTargetWeights = (template: typeof todayTemplate, primaryLift: string): number[] => {
        if (!template) return [];
        const primaryKeyword = primaryLift.toLowerCase().split(' ')[0];
        return Array.from(
            new Set(
                template.phases
                    .flatMap((p) => p.exercises)
                    .filter((e) => e.weight > 0 && e.name.toLowerCase().includes(primaryKeyword))
                    .map((e) => e.weight)
            )
        ).sort((a, b) => a - b);
    };

    const todayTargetWeights = useMemo(() => {
        return getTargetWeights(todayTemplate, todaySchedule.primaryLift);
    }, [todayTemplate, todaySchedule.primaryLift]);

    const selectedTargetWeights = useMemo(() => {
        return getTargetWeights(selectedTemplate, selectedSchedule.primaryLift);
    }, [selectedTemplate, selectedSchedule.primaryLift]);

    const saveDailyConfigState = async (nextConfig: FitnessDailyConfig) => {
        if (!user) return;
        setSavingDailyConfig(true);
        setDailyConfig(nextConfig);
        try {
            await saveFitnessDailyConfig(user.uid, nextConfig);
        } catch (error) {
            await enqueueAction({
                type: 'fitnessDailyConfig',
                action: 'update',
                data: { uid: user.uid, config: nextConfig },
            });
            toast('Daily track settings saved offline', { icon: '📴' });
            console.warn('Failed to save daily config:', error);
        } finally {
            setSavingDailyConfig(false);
        }
    };

    const saveDailyLogState = async (nextLog: FitnessDailyLog) => {
        if (!user || !dailyConfig) return;
        const payload: FitnessDailyLog = {
            ...nextLog,
            ...buildLegacyDailyFlags(nextLog.entries, dailyConfig.activeTracks),
            completedAt: nextLog.completedAt || Date.now(),
        };
        setUpdatingDaily(true);
        setDailyLogs((prev) => ({ ...prev, [todayKey]: payload }));
        try {
            await saveFitnessDailyLog(user.uid, todayKey, payload);
        } catch (error) {
            await enqueueAction({
                type: 'fitnessDaily',
                action: 'update',
                data: { uid: user.uid, date: todayKey, log: payload },
            });
            toast('Daily log saved offline', { icon: '📴' });
            console.warn('Failed to save daily log:', error);
        } finally {
            setUpdatingDaily(false);
        }
    };

    const handleToggleDailyTrack = async (track: UserDailyTrack) => {
        if (!user) return;
        const currentEntry = getTrackEntry(todayLog, track.id);
        const nextLog = updateTrackEntry(todayLog, track.id, {
            completed: !currentEntry.completed,
            completedAt: !currentEntry.completed ? Date.now() : undefined,
            actualReps: currentEntry.actualReps ?? track.target.reps,
            actualSeconds: currentEntry.actualSeconds ?? track.target.seconds,
            actualSets: currentEntry.actualSets ?? track.target.sets,
            actualLoadKg: currentEntry.actualLoadKg ?? track.addedWeightKg ?? undefined,
        });
        await saveDailyLogState(nextLog);
    };

    const handleTrackEntryChange = async (track: UserDailyTrack, patch: Partial<DailyTrackLogEntry>) => {
        if (!user) return;
        const nextLog = updateTrackEntry(todayLog, track.id, patch);
        await saveDailyLogState(nextLog);
    };

    const handleAddDailyTrack = async (exerciseName: string) => {
        if (!user || !dailyConfig) return;
        const nextTrack = createUserDailyTrack(exerciseName, nextTrackSortOrder(dailyConfig.activeTracks));
        const nextTracks = dedupeTracksByExerciseName([...dailyConfig.activeTracks, nextTrack]);
        if (nextTracks.length === dailyConfig.activeTracks.length) {
            toast('Track already active');
            return;
        }
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: sortTracks(nextTracks),
            updatedAt: Date.now(),
        });
        setDailySearch('');
        toast.success(`${nextTrack.exerciseName} added to dailies`);
    };

    const handleRemoveDailyTrack = async (trackId: string) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: dailyConfig.activeTracks.filter((t) => t.id !== trackId),
            updatedAt: Date.now(),
        });
    };

    const handleTrackTargetChange = async (trackId: string, patch: Partial<UserDailyTrack['target']>) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: dailyConfig.activeTracks.map((t) =>
                t.id === trackId ? { ...t, target: { ...t.target, ...patch } } : t
            ),
            updatedAt: Date.now(),
        });
    };

    const handleTrackStageChange = async (trackId: string, stage: GuidedTrackStage) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: dailyConfig.activeTracks.map((t) =>
                t.id === trackId ? setTrackStage(t, stage) : t
            ),
            updatedAt: Date.now(),
        });
    };

    const handleApplyGuidance = async (trackId: string) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: dailyConfig.activeTracks.map((t) =>
                t.id === trackId ? applyGuidedRecommendation(t) : t
            ),
            updatedAt: Date.now(),
        });
    };

    const handleSeasonLengthChange = async (seasonLengthDays: 30 | 60 | 90) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({ ...dailyConfig, seasonLengthDays, updatedAt: Date.now() });
    };

    const handleRestartSeason = async () => {
        if (!dailyConfig) return;
        await saveDailyConfigState({ ...dailyConfig, seasonStartedAt: Date.now(), updatedAt: Date.now() });
    };

    const resolveScaledTemplate = (schedule: IronScheduleDay) => {
        if (!oneRepMaxes || !schedule.templateId) return null;
        const template = getIronTemplateById(schedule.templateId);
        if (!template) return null;
        return scaleTemplateForOneRepMaxes(template, oneRepMaxes);
    };

    const handleStartSchedule = (schedule: IronScheduleDay) => {
        if (!user || !schedule.templateId) return;
        const scaledTemplate = resolveScaledTemplate(schedule);
        if (!scaledTemplate) { toast.error('Template not found'); return; }
        if (activeSession && !confirm('You already have an active workout. Start a new one?')) return;
        startFromTemplate(user.uid, scaledTemplate);
        navigate('/active-workout');
    };

    const handlePreviewSchedule = (schedule: IronScheduleDay) => {
        if (!user || !schedule.templateId) return;
        const scaledTemplate = resolveScaledTemplate(schedule);
        if (!scaledTemplate) { toast.error('Template not found'); return; }
        if (activeSession && !confirm('You already have an active workout. Replace it with this planned session?')) return;
        initFromTemplatePlan(user.uid, scaledTemplate);
        toast.success('Workout loaded in planner. Adjust sets/reps/weights, then start.');
        navigate('/workout');
    };

    if (!oneRepMaxes || !dailyConfig) {
        return (
            <div className="max-w-lg mx-auto px-4 py-8">
                <div className="bg-bg-card rounded-3xl p-8 text-center shadow-card">
                    <div className="w-12 h-12 rounded-2xl bg-surface-inverse mx-auto mb-4 animate-pulse" />
                    <p className="text-text-secondary font-medium">Loading Iron Protocol…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-28 space-y-5">

            {/* ── Hero Card ── */}
            <div className="relative rounded-[2rem] bg-surface-inverse p-6 shadow-lifted overflow-hidden">
                <div
                    className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                    style={{ background: 'rgba(155,217,60,0.12)', transform: 'translate(30%, -30%)' }}
                />
                <div className="relative">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 border border-secondary/30 px-3 py-1 text-[11px] font-bold tracking-[0.1em] uppercase text-secondary">
                        <Zap size={10} />
                        1RM Adaptive
                    </span>
                    <h1 className="font-display text-4xl font-extrabold mt-3 text-text-inverse leading-tight">
                        Iron Protocol
                    </h1>
                    <p className="text-sm leading-6 mt-2 text-text-inverse/75">
                        Weekly PPL structure with auto-loaded daily sessions from your 1RM.
                    </p>
                </div>
            </div>

            {/* ── Weekly Calendar ── */}
            <div className="bg-bg-card rounded-3xl p-4 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar size={15} className="text-primary" />
                    <h2 className="text-sm font-bold text-text-primary">Weekly Calendar</h2>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {IRON_WEEKLY_SCHEDULE.map((day) => {
                        const isToday = today.day() === day.weekday;
                        const isSelected = selectedSchedule.weekday === day.weekday;
                        const sessionKey = day.sessionType === 'rest' ? 'Rest' : day.title.split(' ')[0];
                        const DayIcon = SESSION_ICON[sessionKey] ?? Dumbbell;

                        return (
                            <button
                                key={day.shortLabel}
                                onClick={() => setSelectedWeekday(day.weekday)}
                                className="rounded-2xl py-2.5 px-1 flex flex-col items-center gap-1 transition-all"
                                style={{
                                    background: isSelected
                                        ? '#17452a'
                                        : isToday
                                            ? '#e8f5e9'
                                            : 'transparent',
                                    border: isToday && !isSelected
                                        ? '1.5px solid #9bd93c'
                                        : '1.5px solid transparent',
                                }}
                            >
                                <span
                                    className="text-[10px] font-bold"
                                    style={{ color: isSelected ? '#9bd93c' : isToday ? '#17452a' : '#748177' }}
                                >
                                    {day.shortLabel}
                                </span>
                                <DayIcon
                                    size={13}
                                    style={{ color: isSelected ? '#9bd93c' : isToday ? '#2f7d32' : '#9ca3af' }}
                                />
                                <span
                                    className="text-[9px] font-semibold leading-tight text-center"
                                    style={{ color: isSelected ? 'white' : isToday ? '#17452a' : '#9ca3af' }}
                                >
                                    {sessionKey}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Today's Session ── */}
            <div className="bg-bg-card rounded-3xl p-5 shadow-card">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck size={16} className="text-primary" />
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Today's Session</span>
                </div>
                <p className="text-xs text-text-muted mb-3">Auto-loaded from Iron Protocol plan</p>

                <h2 className="text-xl font-extrabold text-text-primary">{todaySchedule.title}</h2>
                <p className="text-sm text-text-secondary mt-1">
                    Primary lift: <span className="font-bold text-text-primary">{todaySchedule.primaryLift}</span>
                </p>

                {todayTargetWeights.length > 0 && (
                    <div className="mt-3">
                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Primary lift targets</p>
                        <div className="flex flex-wrap gap-2">
                            {todayTargetWeights.map((weight) => (
                                <span
                                    key={weight}
                                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary-container text-primary"
                                >
                                    {weight} kg target
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {todaySchedule.sessionType === 'rest' ? (
                    <div className="mt-4 rounded-2xl bg-bg-surface p-4">
                        <p className="font-semibold text-text-primary mb-1">Rest Day</p>
                        <p className="text-sm text-text-secondary">Recovery, mobility, and hydration. Rest is part of the protocol.</p>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={() => handleStartSchedule(todaySchedule)}
                            disabled={!todaySchedule.templateId}
                            className="mt-4 w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2.5 disabled:opacity-40 transition-opacity"
                            style={{ background: '#d8871f' }}
                        >
                            <Play size={18} strokeWidth={2.5} />
                            Start Today's Workout
                            <ChevronRight size={17} />
                        </button>
                        <button
                            onClick={() => handlePreviewSchedule(todaySchedule)}
                            disabled={!todaySchedule.templateId}
                            className="mt-2 w-full py-3 rounded-2xl border border-border/80 bg-bg-surface text-sm text-text-secondary font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                            <Eye size={16} />
                            Preview &amp; Edit Today
                        </button>
                    </>
                )}

                <p className="mt-3 text-[11px] text-center text-text-muted">
                    Targets are calculated from your 1RM.{' '}
                    <button
                        onClick={() => navigate('/profile?focus=one-rep-maxes')}
                        className="text-primary font-bold underline-offset-2 underline"
                    >
                        Manage 1RM in Profile
                    </button>
                </p>
            </div>

            {/* ── Selected Day ── */}
            <div className="bg-bg-card rounded-3xl p-5 shadow-card">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1">Selected Day</p>
                <h2 className="text-lg font-extrabold text-text-primary">
                    {selectedSchedule.shortLabel} — {selectedSchedule.title}
                </h2>

                {selectedSchedule.sessionType === 'rest' || !selectedTemplate ? (
                    <div className="mt-3 rounded-2xl bg-bg-surface p-4">
                        <p className="font-semibold text-text-primary mb-1">Recovery Day</p>
                        <p className="text-sm text-text-secondary">Mobility + light walk + hydration.</p>
                    </div>
                ) : (
                    <>
                        <div className="mt-4 divide-y divide-border">
                            <div className="flex items-center justify-between py-3">
                                <span className="text-sm text-text-muted">Primary lift</span>
                                <span className="text-sm font-bold text-text-primary">{selectedSchedule.primaryLift}</span>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <span className="text-sm text-text-muted">Warm-up (Set 0)</span>
                                <span className="text-sm font-bold text-text-primary">Auto-loaded</span>
                            </div>
                            {(() => {
                                const workPhase = selectedTemplate.phases.find((p) =>
                                    p.name.toLowerCase().includes('work') || p.name.toLowerCase().includes('heavy')
                                ) ?? selectedTemplate.phases[1] ?? selectedTemplate.phases[0];
                                const workEx = workPhase?.exercises[0];
                                if (!workEx) return null;
                                return (
                                    <div className="flex items-center justify-between py-3">
                                        <span className="text-sm text-text-muted">Work Sets</span>
                                        <span className="text-sm font-bold text-text-primary">
                                            {workEx.sets} × {workEx.reps}{workEx.weight > 0 ? ` @ ${workEx.weight}kg` : ' @ 80% 1RM'}
                                        </span>
                                    </div>
                                );
                            })()}
                            {(() => {
                                const count = selectedTemplate.phases
                                    .filter((p) =>
                                        p.name.toLowerCase().includes('access') ||
                                        p.name.toLowerCase().includes('supplement')
                                    )
                                    .reduce((sum, p) => sum + p.exercises.length, 0);
                                return (
                                    <div className="flex items-center justify-between py-3">
                                        <span className="text-sm text-text-muted">Accessory lifts</span>
                                        <span className="text-sm font-bold text-text-primary">
                                            {count > 0 ? `${count} movements` : 'See plan'}
                                        </span>
                                    </div>
                                );
                            })()}
                            <div className="flex items-center justify-between py-3">
                                <span className="text-sm text-text-muted flex items-center gap-1.5">
                                    <Clock size={13} />
                                    Estimated duration
                                </span>
                                <span className="text-sm font-bold text-text-primary">60–75 min</span>
                            </div>
                        </div>

                        {selectedTargetWeights.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedTargetWeights.map((weight) => (
                                    <span
                                        key={weight}
                                        className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-container text-primary"
                                    >
                                        {weight} kg
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handlePreviewSchedule(selectedSchedule)}
                                className="py-3 rounded-2xl border border-border/80 bg-bg-surface text-sm text-text-secondary font-semibold flex items-center justify-center gap-2"
                            >
                                <Eye size={15} />
                                Preview &amp; Edit
                            </button>
                            <button
                                onClick={() => handleStartSchedule(selectedSchedule)}
                                className="py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
                                style={{ background: '#d8871f' }}
                            >
                                <Play size={15} strokeWidth={2.5} />
                                Start Session
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── Set Pattern Reference ── */}
            <div className="bg-bg-card rounded-2xl overflow-hidden shadow-card">
                <button
                    onClick={() => setShowPatternRef((s) => !s)}
                    className="w-full px-4 py-3.5 text-left flex items-center justify-between"
                >
                    <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <TrendingUp size={16} className="text-accent" />
                        Set Pattern Reference
                    </div>
                    <ChevronRight
                        size={16}
                        className={`text-text-muted transition-transform ${showPatternRef ? 'rotate-90' : ''}`}
                    />
                </button>
                {showPatternRef && (
                    <div className="px-4 pb-4 border-t border-border">
                        <div className="pt-3 space-y-2 text-sm text-text-secondary">
                            <p><span className="text-text-primary font-semibold">Set 0:</span> Warm-up (not counted) — 40–50%, 15–20 reps</p>
                            <p><span className="text-text-primary font-semibold">Sets 1–4:</span> Working — 60–70%, 8–12 reps</p>
                            <p><span className="text-text-primary font-semibold">Sets 5–6:</span> Heavy — 80–87%, 3–6 reps</p>
                            <p><span className="text-text-primary font-semibold">Sets 7–10:</span> Back-off — 60–70%, match Sets 1–4</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Fitness Dailies ── */}
            <div className="bg-bg-card rounded-3xl p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-text-primary">Fitness Dailies</h3>
                        <p className="text-xs text-text-muted mt-0.5">
                            {activeDailyTracks.length} active track{activeDailyTracks.length === 1 ? '' : 's'}
                            {seasonSummary ? ` · ${seasonSummary.remainingDays} days left in this block` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">Streak: {dailyStreak}</span>
                        <button
                            onClick={() => setShowDailyManager(true)}
                            className="rounded-xl border border-border px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary bg-bg-surface"
                        >
                            Manage
                        </button>
                    </div>
                </div>

                <div className="mt-3 space-y-3">
                    {activeDailyTracks.map((track) => {
                        const entry = getTrackEntry(todayLog, track.id);
                        const recommendation = getGuidedRecommendation(track, dailyLogs);
                        const completionCount = getTrackCompletionCount(dailyLogs, track.id);
                        return (
                            <div
                                key={track.id}
                                className={`rounded-2xl border p-3 transition-colors ${entry.completed ? 'border-green/40 bg-green/8' : 'border-border bg-bg-surface'}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-text-primary">{track.exerciseName}</p>
                                            {track.specializationKind && track.stage && (
                                                <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan">
                                                    {getGuidedStageLabel(track.stage)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-text-muted mt-0.5">
                                            Target {formatDailyTarget(track)}
                                            {track.stage === 'weighted' && track.addedWeightKg ? ` @ ${track.addedWeightKg}kg` : ''}
                                            {` · ${completionCount}/7 days`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleToggleDailyTrack(track)}
                                        disabled={updatingDaily}
                                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${entry.completed ? 'bg-green text-white' : 'bg-bg-input text-text-secondary border border-border'}`}
                                    >
                                        {entry.completed ? (
                                            <span className="flex items-center gap-1"><Check size={12} /> Done</span>
                                        ) : 'Mark done'}
                                    </button>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                    {track.metric === 'seconds' && (
                                        <label className="text-[11px] text-text-muted sm:col-span-2">
                                            Seconds
                                            <input
                                                type="number"
                                                min={0}
                                                value={entry.actualSeconds ?? track.target.seconds ?? ''}
                                                onChange={(e) => handleTrackEntryChange(track, {
                                                    actualSeconds: Math.max(0, Number(e.target.value) || 0),
                                                })}
                                                className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                            />
                                        </label>
                                    )}
                                    {track.metric === 'reps' && (
                                        <label className="text-[11px] text-text-muted sm:col-span-2">
                                            Reps
                                            <input
                                                type="number"
                                                min={0}
                                                value={entry.actualReps ?? track.target.reps ?? ''}
                                                onChange={(e) => handleTrackEntryChange(track, {
                                                    actualReps: Math.max(0, Number(e.target.value) || 0),
                                                })}
                                                className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                            />
                                        </label>
                                    )}
                                    {track.metric === 'sets_reps' && (
                                        <>
                                            <label className="text-[11px] text-text-muted">
                                                Sets
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={entry.actualSets ?? track.target.sets ?? ''}
                                                    onChange={(e) => handleTrackEntryChange(track, {
                                                        actualSets: Math.max(0, Number(e.target.value) || 0),
                                                    })}
                                                    className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                />
                                            </label>
                                            <label className="text-[11px] text-text-muted">
                                                Reps
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={entry.actualReps ?? track.target.reps ?? ''}
                                                    onChange={(e) => handleTrackEntryChange(track, {
                                                        actualReps: Math.max(0, Number(e.target.value) || 0),
                                                    })}
                                                    className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                />
                                            </label>
                                            {track.stage === 'weighted' && (
                                                <label className="text-[11px] text-text-muted">
                                                    Load kg
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.5"
                                                        value={entry.actualLoadKg ?? track.addedWeightKg ?? ''}
                                                        onChange={(e) => handleTrackEntryChange(track, {
                                                            actualLoadKg: Math.max(0, Number(e.target.value) || 0),
                                                        })}
                                                        className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                    />
                                                </label>
                                            )}
                                        </>
                                    )}
                                </div>

                                {recommendation && (
                                    <div className="mt-3 rounded-xl border border-cyan/20 bg-cyan/5 p-3">
                                        <p className="text-xs font-semibold text-cyan">{recommendation.title}</p>
                                        <p className="mt-1 text-xs text-text-secondary">{recommendation.detail}</p>
                                        <button
                                            onClick={() => handleApplyGuidance(track.id)}
                                            className="mt-2 rounded-lg bg-cyan/15 px-3 py-1.5 text-[11px] font-semibold text-cyan"
                                        >
                                            {recommendation.actionLabel}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {activeDailyTracks.length === 0 && (
                        <div className="rounded-2xl border border-border bg-bg-surface p-4 text-sm text-text-secondary">
                            No active daily tracks yet. Add a few from the library to build your block.
                        </div>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }, (_, idx) => {
                        const key = dayjs().subtract(6 - idx, 'day').format('YYYY-MM-DD');
                        const done = isDailyComplete(dailyLogs[key], dailyConfig);
                        return (
                            <div
                                key={key}
                                className={`h-2 rounded-full ${done ? 'bg-green' : 'bg-bg-input'}`}
                                title={key}
                            />
                        );
                    })}
                </div>
            </div>

            {/* ── 6-Week Progress Log ── */}
            <div className="bg-bg-card rounded-3xl p-4 shadow-card overflow-x-auto">
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={15} className="text-primary" />
                    <h3 className="text-sm font-bold text-text-primary">6-Week Progress Log</h3>
                </div>
                <table className="w-full text-xs min-w-[320px]">
                    <thead>
                        <tr className="text-text-muted">
                            <th className="text-left pb-2 font-semibold">Week</th>
                            <th className="text-left pb-2 font-semibold">Bench</th>
                            <th className="text-left pb-2 font-semibold">Squat</th>
                            <th className="text-left pb-2 font-semibold">OHP</th>
                            <th className="text-left pb-2 font-semibold">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sixWeekRows.map((row) => (
                            <tr key={row.weekLabel} className="border-t border-border/50">
                                <td className="py-2 pr-2 text-text-secondary font-medium">{row.weekLabel}</td>
                                <td className="py-2 pr-2 text-text-primary">{row.bench}</td>
                                <td className="py-2 pr-2 text-text-primary">{row.squat}</td>
                                <td className="py-2 pr-2 text-text-primary">{row.ohp}</td>
                                <td className="py-2 text-text-secondary truncate max-w-[120px]" title={row.notes}>{row.notes}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button
                onClick={() => navigate('/history')}
                className="w-full py-3 rounded-2xl border border-border bg-bg-card text-sm text-text-secondary font-semibold flex items-center justify-center gap-2 shadow-card"
            >
                <Calendar size={16} />
                Open Calendar History
            </button>

            {/* ── Daily Manager Modal ── */}
            {showDailyManager && (
                <div
                    className="fixed inset-0 z-[100] bg-black/60 flex items-end"
                    onClick={() => setShowDailyManager(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl px-4 pt-3 pb-4 max-h-[88vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-3" />

                        <div className="sticky top-0 z-10 bg-bg-surface pb-3">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary">Manage Fitness Dailies</h3>
                                    <p className="text-xs text-text-muted mt-1">
                                        Build your current block from the exercise library.
                                    </p>
                                </div>
                                <button onClick={() => setShowDailyManager(false)} className="p-2 text-text-muted">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="rounded-2xl border border-border bg-bg-card p-3 mb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Season length</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            {seasonSummary ? `${seasonSummary.remainingDays} days left in this block` : 'Start a consistency block'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleRestartSeason}
                                        disabled={savingDailyConfig}
                                        className="rounded-xl border border-border px-3 py-2 text-[11px] font-semibold text-text-secondary disabled:opacity-40"
                                    >
                                        Restart
                                    </button>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    {[30, 60, 90].map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => handleSeasonLengthChange(days as 30 | 60 | 90)}
                                            disabled={savingDailyConfig}
                                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${dailyConfig.seasonLengthDays === days ? 'bg-accent text-white' : 'bg-bg-input text-text-secondary'}`}
                                        >
                                            {days} days
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative mb-3">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    type="text"
                                    value={dailySearch}
                                    onChange={(e) => setDailySearch(e.target.value)}
                                    placeholder="Search exercise library…"
                                    className="w-full bg-bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-accent/50"
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-4">
                            <div>
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Active tracks</p>
                                    {savingDailyConfig && <span className="text-[11px] text-text-muted">Saving…</span>}
                                </div>
                                <div className="space-y-2">
                                    {activeDailyTracks.map((track) => (
                                        <div key={track.id} className="rounded-2xl border border-border bg-bg-card p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold text-text-primary">{track.exerciseName}</p>
                                                        {track.specializationKind && track.stage && (
                                                            <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan">
                                                                {getGuidedStageLabel(track.stage)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-text-muted mt-0.5">Target: {formatDailyTarget(track)}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveDailyTrack(track.id)}
                                                    className="rounded-xl bg-red/10 px-2.5 py-1.5 text-[11px] font-semibold text-red"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            {track.specializationKind && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {guidedStageOptions.map((stage) => (
                                                        <button
                                                            key={`${track.id}-${stage}`}
                                                            onClick={() => handleTrackStageChange(track.id, stage)}
                                                            className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold ${track.stage === stage ? 'bg-cyan text-bg-surface' : 'bg-bg-input text-text-secondary'}`}
                                                        >
                                                            {getGuidedStageLabel(stage)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                                {track.metric === 'seconds' && (
                                                    <label className="text-[11px] text-text-muted sm:col-span-2">
                                                        Target seconds
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={track.target.seconds ?? ''}
                                                            onChange={(e) => handleTrackTargetChange(track.id, {
                                                                seconds: Math.max(0, Number(e.target.value) || 0),
                                                            })}
                                                            className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                        />
                                                    </label>
                                                )}
                                                {track.metric === 'reps' && (
                                                    <label className="text-[11px] text-text-muted sm:col-span-2">
                                                        Target reps
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={track.target.reps ?? ''}
                                                            onChange={(e) => handleTrackTargetChange(track.id, {
                                                                reps: Math.max(0, Number(e.target.value) || 0),
                                                            })}
                                                            className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                        />
                                                    </label>
                                                )}
                                                {track.metric === 'sets_reps' && (
                                                    <>
                                                        <label className="text-[11px] text-text-muted">
                                                            Sets
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={track.target.sets ?? ''}
                                                                onChange={(e) => handleTrackTargetChange(track.id, {
                                                                    sets: Math.max(0, Number(e.target.value) || 0),
                                                                })}
                                                                className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                            />
                                                        </label>
                                                        <label className="text-[11px] text-text-muted">
                                                            Reps
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={track.target.reps ?? ''}
                                                                onChange={(e) => handleTrackTargetChange(track.id, {
                                                                    reps: Math.max(0, Number(e.target.value) || 0),
                                                                })}
                                                                className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                            />
                                                        </label>
                                                        {track.stage === 'weighted' && (
                                                            <label className="text-[11px] text-text-muted">
                                                                Start load kg
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    step="0.5"
                                                                    value={track.addedWeightKg ?? ''}
                                                                    onChange={(e) => saveDailyConfigState({
                                                                        ...dailyConfig,
                                                                        activeTracks: dailyConfig.activeTracks.map((c) =>
                                                                            c.id === track.id
                                                                                ? { ...c, addedWeightKg: Math.max(0, Number(e.target.value) || 0) }
                                                                                : c
                                                                        ),
                                                                        updatedAt: Date.now(),
                                                                    })}
                                                                    className="mt-1 w-full rounded-xl border border-border bg-bg-input px-3 py-2 text-sm text-text-primary"
                                                                />
                                                            </label>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Suggested library</p>
                                </div>
                                <div className="space-y-2">
                                    {recommendedDailyTracks.map((track) => (
                                        <button
                                            key={track.id}
                                            onClick={() => handleAddDailyTrack(track.exerciseName)}
                                            className="w-full rounded-2xl border border-border bg-bg-card p-3 text-left"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-text-primary">{track.exerciseName}</p>
                                                    <p className="text-xs text-text-muted mt-0.5">
                                                        Default: {track.defaultTarget.seconds ? `${track.defaultTarget.seconds / 60} min` : track.defaultTarget.sets ? `${track.defaultTarget.sets} × ${track.defaultTarget.reps}` : `${track.defaultTarget.reps} reps`}
                                                    </p>
                                                </div>
                                                <span className="rounded-xl bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent flex items-center gap-1 shrink-0">
                                                    <Plus size={12} />
                                                    Add
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {dailySearch.trim().length >= 2 && (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted px-2 mb-2">Search results</p>
                                    {dailySearchResults.length > 0 ? (
                                        <div className="space-y-2">
                                            {dailySearchResults.map((name) => (
                                                <button
                                                    key={name}
                                                    onClick={() => handleAddDailyTrack(name)}
                                                    className="w-full rounded-2xl border border-border bg-bg-card p-3 text-left"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-text-primary">{name}</p>
                                                            <p className="text-xs text-text-muted mt-0.5">Add as a daily track</p>
                                                        </div>
                                                        <span className="rounded-xl bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent flex items-center gap-1 shrink-0">
                                                            <Plus size={12} />
                                                            Add
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-border bg-bg-card p-3 text-sm text-text-secondary">
                                            No matches. Try another exercise name.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
