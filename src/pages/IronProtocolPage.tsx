import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar, Check, ChevronRight, Dumbbell, Eye, Flame, Plus, Search, TrendingUp, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import {
    getFitnessDailyConfig,
    getFitnessDailyLogs,
    getOneRepMaxes,
    getUserWorkouts,
    saveFitnessDailyConfig,
    saveFitnessDailyLog,
    saveOneRepMaxes,
} from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import type { DailyTrackLogEntry, FitnessDailyConfig, FitnessDailyLog, GuidedTrackStage, OneRepMaxes, UserDailyTrack, WorkoutSession } from '../lib/types';
import {
    getIronScheduleForDate,
    getIronTemplateById,
    getScaledIronTemplates,
    IRON_WEEKLY_SCHEDULE,
    normalizeOneRepMaxes,
    scaleTemplateForOneRepMaxes,
    type IronScheduleDay,
} from '../lib/ironProtocol';
import { formatSetPerformance, hasExternalLoad } from '../lib/exerciseRules';
import { getOneRepMaxPromptStatus } from '../lib/oneRepMaxes';
import OneRepMaxCard from '../components/OneRepMaxCard';
import { InsightCard } from '../components/ui';
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
    // Monday-based week start.
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
        const weekSessions = sessions.filter((session) => session.startedAt >= start.valueOf() && session.startedAt <= end.valueOf());
        const notes = weekSessions.find((session) => session.notes?.trim())?.notes || '-';

        return {
            weekLabel: `${start.format('MMM D')}`,
            bench: pickBestSet(weekSessions, ['flat bench press', 'bench press']),
            squat: pickBestSet(weekSessions, ['back squat', 'squat']),
            ohp: pickBestSet(weekSessions, ['overhead bb press', 'overhead press']),
            notes,
        };
    });
};

export default function IronProtocolPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuthStore();
    const { activeSession, initFromTemplatePlan, startFromTemplate } = useWorkoutStore();

    const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxes | null>(null);
    const [dailyConfig, setDailyConfig] = useState<FitnessDailyConfig | null>(null);
    const [dailyLogs, setDailyLogs] = useState<Record<string, FitnessDailyLog>>({});
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [showPatternRef, setShowPatternRef] = useState(false);
    const [showDailyManager, setShowDailyManager] = useState(false);
    const [dailySearch, setDailySearch] = useState('');
    const [savingMaxes, setSavingMaxes] = useState(false);
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
        return () => {
            cancelled = true;
        };
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
        return sortTracks(dailyConfig.activeTracks.filter((track) => track.status === 'active'));
    }, [dailyConfig]);

    const seasonSummary = useMemo(() => {
        if (!dailyConfig) return null;
        return getSeasonSummary(dailyConfig);
    }, [dailyConfig]);

    const recommendedDailyTracks = useMemo(() => {
        const activeNames = new Set(activeDailyTracks.map((track) => normalizeExerciseName(track.exerciseName)));
        return DAILY_TRACK_LIBRARY.filter((track) => !activeNames.has(normalizeExerciseName(track.exerciseName)));
    }, [activeDailyTracks]);

    const dailySearchResults = useMemo(() => {
        if (dailySearch.trim().length < 2) return [];
        const activeNames = new Set(activeDailyTracks.map((track) => normalizeExerciseName(track.exerciseName)));
        return searchExercises(dailySearch)
            .map((exercise) => exercise.name)
            .filter((name) => !activeNames.has(normalizeExerciseName(name)))
            .slice(0, 8);
    }, [activeDailyTracks, dailySearch]);

    const sixWeekRows = useMemo(() => buildSixWeekRows(workouts), [workouts]);

    const scaledTemplateCount = useMemo(() => {
        if (!oneRepMaxes) return 0;
        return getScaledIronTemplates(oneRepMaxes).length;
    }, [oneRepMaxes]);

    const todayTemplate = useMemo(() => {
        if (!oneRepMaxes || !todaySchedule.templateId) return null;
        const template = getIronTemplateById(todaySchedule.templateId);
        if (!template) return null;
        return scaleTemplateForOneRepMaxes(template, oneRepMaxes);
    }, [oneRepMaxes, todaySchedule.templateId]);

    const selectedSchedule = useMemo<IronScheduleDay>(() => {
        return IRON_WEEKLY_SCHEDULE.find((entry) => entry.weekday === selectedWeekday) ?? todaySchedule;
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
                    .flatMap((phase) => phase.exercises)
                    .filter((exercise) => exercise.weight > 0 && exercise.name.toLowerCase().includes(primaryKeyword))
                    .map((exercise) => exercise.weight)
            )
        ).sort((a, b) => a - b);
    };

    const todayTargetWeights = useMemo(() => {
        return getTargetWeights(todayTemplate, todaySchedule.primaryLift);
    }, [todayTemplate, todaySchedule.primaryLift]);

    const selectedTargetWeights = useMemo(() => {
        return getTargetWeights(selectedTemplate, selectedSchedule.primaryLift);
    }, [selectedTemplate, selectedSchedule.primaryLift]);

    const oneRepMaxStatus = useMemo(() => {
        return getOneRepMaxPromptStatus(oneRepMaxes, workouts, profile);
    }, [oneRepMaxes, profile, workouts]);

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

    const updateMax = (key: keyof Omit<OneRepMaxes, 'userId' | 'updatedAt'>, value: number) => {
        setOneRepMaxes((prev) => {
            if (!prev) return prev;
            return { ...prev, [key]: Math.max(0, value) };
        });
    };

    const handleSaveOneRepMaxes = async () => {
        if (!user || !oneRepMaxes) return;
        setSavingMaxes(true);
        const payload = { ...oneRepMaxes, userId: user.uid, updatedAt: Date.now() };
        setOneRepMaxes(payload);

        try {
            await saveOneRepMaxes(user.uid, payload);
            toast.success('1RMs updated');
        } catch (error) {
            await enqueueAction({
                type: 'oneRepMaxes',
                action: 'update',
                data: { uid: user.uid, maxes: payload },
            });
            toast('Saved offline - will sync when online', { icon: '📴' });
            console.warn('Failed to save 1RMs:', error);
        } finally {
            setSavingMaxes(false);
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

    const handleTrackEntryChange = async (
        track: UserDailyTrack,
        patch: Partial<DailyTrackLogEntry>
    ) => {
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
            activeTracks: dailyConfig.activeTracks.filter((track) => track.id !== trackId),
            updatedAt: Date.now(),
        });
    };

    const handleTrackTargetChange = async (trackId: string, patch: Partial<UserDailyTrack['target']>) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: dailyConfig.activeTracks.map((track) => (
                track.id === trackId
                    ? { ...track, target: { ...track.target, ...patch } }
                    : track
            )),
            updatedAt: Date.now(),
        });
    };

    const handleTrackStageChange = async (trackId: string, stage: GuidedTrackStage) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: dailyConfig.activeTracks.map((track) => (
                track.id === trackId ? setTrackStage(track, stage) : track
            )),
            updatedAt: Date.now(),
        });
    };

    const handleApplyGuidance = async (trackId: string) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            activeTracks: dailyConfig.activeTracks.map((track) => (
                track.id === trackId ? applyGuidedRecommendation(track) : track
            )),
            updatedAt: Date.now(),
        });
    };

    const handleSeasonLengthChange = async (seasonLengthDays: 30 | 60 | 90) => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            seasonLengthDays,
            updatedAt: Date.now(),
        });
    };

    const handleRestartSeason = async () => {
        if (!dailyConfig) return;
        await saveDailyConfigState({
            ...dailyConfig,
            seasonStartedAt: Date.now(),
            updatedAt: Date.now(),
        });
    };

    const resolveScaledTemplate = (schedule: IronScheduleDay) => {
        if (!oneRepMaxes || !schedule.templateId) return null;
        const template = getIronTemplateById(schedule.templateId);
        if (!template) {
            return null;
        }
        return scaleTemplateForOneRepMaxes(template, oneRepMaxes);
    };

    const handleStartSchedule = (schedule: IronScheduleDay) => {
        if (!user || !schedule.templateId) return;
        const scaledTemplate = resolveScaledTemplate(schedule);
        if (!scaledTemplate) {
            toast.error('Template not found');
            return;
        }
        if (activeSession && !confirm('You already have an active workout. Start a new one?')) return;

        startFromTemplate(user.uid, scaledTemplate);
        navigate('/active-workout');
    };

    const handlePreviewSchedule = (schedule: IronScheduleDay) => {
        if (!user || !schedule.templateId) return;
        const scaledTemplate = resolveScaledTemplate(schedule);
        if (!scaledTemplate) {
            toast.error('Template not found');
            return;
        }
        if (activeSession && !confirm('You already have an active workout. Replace it with this planned session?')) return;

        initFromTemplatePlan(user.uid, scaledTemplate);
        toast.success('Workout loaded in planner. Adjust sets/reps/weights, then start.');
        navigate('/workout');
    };

    if (!oneRepMaxes || !dailyConfig) {
        return (
            <div className="max-w-lg mx-auto px-4 py-8">
                <div className="glass rounded-2xl p-6 text-center">
                    <p className="text-text-secondary">Loading Iron Protocol...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
            <div className="rounded-[2rem] border border-amber/25 bg-surface-inverse p-5 text-text-inverse shadow-lifted">
                <p className="text-xs font-bold tracking-[0.16em] uppercase text-secondary">Kabunga performance</p>
                <h1 className="font-display text-3xl font-extrabold mt-1 text-text-inverse">Iron Protocol</h1>
                <p className="text-sm leading-6 mt-2 text-text-inverse/75">
                    Weekly PPL structure, scaled from your 1RM data, with daily bodyweight progression.
                </p>
            </div>

            <InsightCard
                tone="progress"
                title="Strength, not clutter"
                description="Targets stay visible, bodyweight work still counts, and you can start the day’s session without rebuilding a plan."
            />

            <div className="glass rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-2 text-text-secondary text-xs uppercase tracking-wide">
                    <Calendar size={13} />
                    Weekly Calendar
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                    {IRON_WEEKLY_SCHEDULE.map((day) => {
                        const isToday = today.day() === day.weekday;
                        const isSelected = selectedSchedule.weekday === day.weekday;
                        return (
                            <button
                                key={day.shortLabel}
                                onClick={() => setSelectedWeekday(day.weekday)}
                                className="rounded-xl p-2 border text-center transition-colors"
                                style={{
                                    borderColor: isSelected ? '#22d3ee' : isToday ? '#E8630A' : '#2D5F8A',
                                    background: isSelected ? 'rgba(34, 211, 238, 0.15)' : isToday ? 'rgba(232, 99, 10, 0.18)' : '#12263A',
                                }}
                            >
                                <p className="text-[11px] font-semibold" style={{ color: isSelected ? '#22d3ee' : isToday ? '#E8630A' : '#D6E4F0' }}>
                                    {day.shortLabel}
                                </p>
                                <p className="text-[10px] leading-tight mt-1 text-white">
                                    {day.sessionType === 'rest' ? 'Rest' : day.title.split(' ')[0]}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="glass rounded-3xl p-5" style={{ borderColor: '#2D5F8A' }}>
                <p className="text-xs uppercase tracking-wide text-text-muted">Today&apos;s Session</p>
                <h2 className="text-xl font-black mt-1 text-white">{todaySchedule.title}</h2>
                <p className="text-sm mt-1" style={{ color: '#D6E4F0' }}>
                    Primary lift: <span className="font-semibold text-white">{todaySchedule.primaryLift}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                    {todayTargetWeights.length > 0 ? (
                        todayTargetWeights.map((weight) => (
                            <span
                                key={weight}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                style={{ background: 'rgba(45,95,138,0.35)', color: '#D6E4F0' }}
                            >
                                {weight}kg target
                            </span>
                        ))
                    ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-bg-card text-text-secondary">
                            Bodyweight progression focus
                        </span>
                    )}
                </div>

                <button
                    onClick={() => handleStartSchedule(todaySchedule)}
                    disabled={!todaySchedule.templateId}
                    className="mt-4 w-full py-4 rounded-2xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: '#E8630A' }}
                >
                    <Dumbbell size={18} />
                    Start Today&apos;s Workout
                    <ChevronRight size={18} />
                </button>
                <button
                    onClick={() => handlePreviewSchedule(todaySchedule)}
                    disabled={!todaySchedule.templateId}
                    className="mt-2 w-full py-3 rounded-2xl border border-border text-sm text-text-secondary font-medium flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    <Eye size={16} />
                    Preview & Edit Today
                </button>
            </div>

            <div className="glass rounded-3xl p-5" style={{ borderColor: '#2D5F8A' }}>
                <p className="text-xs uppercase tracking-wide text-text-muted">Selected Day</p>
                <h2 className="text-xl font-black mt-1 text-white">
                    {selectedSchedule.shortLabel} — {selectedSchedule.title}
                </h2>
                <p className="text-sm mt-1" style={{ color: '#D6E4F0' }}>
                    Primary lift: <span className="font-semibold text-white">{selectedSchedule.primaryLift}</span>
                </p>

                {selectedSchedule.sessionType === 'rest' || !selectedTemplate ? (
                    <div className="mt-3 rounded-xl bg-bg-card p-3 text-sm text-text-secondary">
                        Recovery day. Mobility + light walk + hydration.
                    </div>
                ) : (
                    <>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {selectedTargetWeights.length > 0 ? (
                                selectedTargetWeights.map((weight) => (
                                    <span
                                        key={weight}
                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                        style={{ background: 'rgba(45,95,138,0.35)', color: '#D6E4F0' }}
                                    >
                                        {weight}kg target
                                    </span>
                                ))
                            ) : (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-bg-card text-text-secondary">
                                    Bodyweight progression focus
                                </span>
                            )}
                        </div>

                        <div className="mt-3 space-y-2 max-h-[280px] overflow-y-auto pr-1">
                            {selectedTemplate.phases.map((phase, phaseIndex) => (
                                <div key={`${phase.name}-${phaseIndex}`} className="rounded-xl bg-bg-card p-3">
                                    <p className="text-xs uppercase tracking-wide text-text-muted mb-2">{phase.name}</p>
                                    <div className="space-y-1.5">
                                        {phase.exercises.map((exercise, exerciseIndex) => (
                                            <div key={`${phase.name}-${exercise.name}-${exerciseIndex}`} className="text-xs text-text-secondary">
                                                <p className="font-semibold text-text-primary">{exercise.name}</p>
                                                <p>
                                                    {exercise.sets} sets × {exercise.reps} reps
                                                    {exercise.weight > 0 ? ` @ ${exercise.weight}kg` : ''}
                                                    {exercise.restSeconds > 0 ? ` • rest ${exercise.restSeconds}s` : ''}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handlePreviewSchedule(selectedSchedule)}
                                className="py-3 rounded-xl border border-border text-sm text-text-secondary font-medium flex items-center justify-center gap-2"
                            >
                                <Eye size={15} />
                                Preview & Edit
                            </button>
                            <button
                                onClick={() => handleStartSchedule(selectedSchedule)}
                                className="py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                                style={{ background: '#E8630A' }}
                            >
                                <Dumbbell size={15} />
                                Start Session
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="glass rounded-2xl overflow-hidden">
                <button
                    onClick={() => setShowPatternRef((s) => !s)}
                    className="w-full px-4 py-3 text-left flex items-center justify-between"
                >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp size={16} className="text-accent" />
                        Set Pattern Reference
                    </div>
                    <ChevronRight
                        size={16}
                        className={`text-text-muted transition-transform ${showPatternRef ? 'rotate-90' : ''}`}
                    />
                </button>
                {showPatternRef && (
                    <div className="px-4 pb-4 text-sm text-text-secondary space-y-1">
                        <p><span className="text-text-primary font-semibold">Set 0:</span> Warm-up (not counted) - 40-50%, 15-20 reps</p>
                        <p><span className="text-text-primary font-semibold">Sets 1-4:</span> Working - 60-70%, 8-12 reps</p>
                        <p><span className="text-text-primary font-semibold">Sets 5-6:</span> Heavy - 80-87%, 3-6 reps</p>
                        <p><span className="text-text-primary font-semibold">Sets 7-10:</span> Back-off - 60-70%, match Sets 1-4</p>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <Flame size={16} style={{ color: '#E8630A' }} />
                        <h3 className="text-sm font-semibold">1RM Calculator</h3>
                    </div>
                    <span className="text-xs text-text-muted">{scaledTemplateCount}/6 templates updated</span>
                </div>
                <OneRepMaxCard
                    title="Iron Strength Inputs"
                    subtitle="Update these here or in Profile. New Iron sessions scale automatically from the latest values."
                    maxes={oneRepMaxes}
                    status={oneRepMaxStatus}
                    saving={savingMaxes}
                    onChange={updateMax}
                    onSave={handleSaveOneRepMaxes}
                />
            </div>

            <div className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold">Fitness Dailies</h3>
                        <p className="text-xs text-text-muted mt-1">
                            {activeDailyTracks.length} active track{activeDailyTracks.length === 1 ? '' : 's'}
                            {seasonSummary ? ` • ${seasonSummary.remainingDays} days left in this block` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">7-day streak: {dailyStreak}</span>
                        <button
                            onClick={() => setShowDailyManager(true)}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary"
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
                                className={`rounded-xl border p-3 transition-colors ${entry.completed ? 'border-green/40 bg-green/10' : 'border-border bg-bg-card'}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold">{track.exerciseName}</p>
                                            {track.specializationKind && track.stage && (
                                                <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan">
                                                    {getGuidedStageLabel(track.stage)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-text-muted mt-1">
                                            Target {formatDailyTarget(track)}
                                            {track.stage === 'weighted' && track.addedWeightKg ? ` @ ${track.addedWeightKg}kg` : ''}
                                            {` • ${completionCount}/7 days complete`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleToggleDailyTrack(track)}
                                        disabled={updatingDaily}
                                        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${entry.completed ? 'bg-green text-white' : 'bg-bg-input text-text-secondary'}`}
                                    >
                                        {entry.completed ? 'Done' : 'Mark done'}
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
                                                onChange={(event) => handleTrackEntryChange(track, {
                                                    actualSeconds: Math.max(0, Number(event.target.value) || 0),
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
                                                onChange={(event) => handleTrackEntryChange(track, {
                                                    actualReps: Math.max(0, Number(event.target.value) || 0),
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
                                                    onChange={(event) => handleTrackEntryChange(track, {
                                                        actualSets: Math.max(0, Number(event.target.value) || 0),
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
                                                    onChange={(event) => handleTrackEntryChange(track, {
                                                        actualReps: Math.max(0, Number(event.target.value) || 0),
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
                                                        onChange={(event) => handleTrackEntryChange(track, {
                                                            actualLoadKg: Math.max(0, Number(event.target.value) || 0),
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
                        <div className="rounded-xl border border-border bg-bg-card p-3 text-sm text-text-secondary">
                            No active daily tracks yet. Add a few from the library to build your block.
                        </div>
                    )}
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1">
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

            <div className="glass rounded-2xl p-4 overflow-x-auto">
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-cyan" />
                    <h3 className="text-sm font-semibold">6-Week Progress Log</h3>
                </div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-text-muted">
                            <th className="text-left pb-2 font-medium">Week</th>
                            <th className="text-left pb-2 font-medium">Bench</th>
                            <th className="text-left pb-2 font-medium">Squat</th>
                            <th className="text-left pb-2 font-medium">OHP</th>
                            <th className="text-left pb-2 font-medium">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sixWeekRows.map((row) => (
                            <tr key={row.weekLabel} className="border-t border-border/50">
                                <td className="py-2 pr-2 text-text-secondary">{row.weekLabel}</td>
                                <td className="py-2 pr-2">{row.bench}</td>
                                <td className="py-2 pr-2">{row.squat}</td>
                                <td className="py-2 pr-2">{row.ohp}</td>
                                <td className="py-2 text-text-secondary truncate max-w-[140px]" title={row.notes}>
                                    {row.notes}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button
                onClick={() => navigate('/history')}
                className="w-full py-3 rounded-xl border border-border text-sm text-text-secondary flex items-center justify-center gap-2"
            >
                <Calendar size={16} />
                Open Calendar History
            </button>

            {showDailyManager && (
                <div
                    className="fixed inset-0 z-[100] bg-black/60 flex items-end"
                    onClick={() => setShowDailyManager(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl px-4 pt-3 pb-4 max-h-[88vh] flex flex-col animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-3" />

                        <div className="sticky top-0 z-10 bg-bg-surface pb-3">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold">Manage Fitness Dailies</h3>
                                    <p className="text-xs text-text-muted mt-1">
                                        Build your current block from the exercise library and keep specialization separate from the main Iron templates.
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
                                        className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-text-secondary disabled:opacity-40"
                                    >
                                        Restart block
                                    </button>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    {[30, 60, 90].map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => handleSeasonLengthChange(days as 30 | 60 | 90)}
                                            disabled={savingDailyConfig}
                                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${dailyConfig.seasonLengthDays === days ? 'bg-accent text-white' : 'bg-bg-input text-text-secondary'}`}
                                        >
                                            {days} days
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative mb-3">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    type="text"
                                    value={dailySearch}
                                    onChange={(event) => setDailySearch(event.target.value)}
                                    placeholder="Search the exercise library..."
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
                                        <div key={track.id} className="rounded-xl border border-border bg-bg-card p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold">{track.exerciseName}</p>
                                                        {track.specializationKind && track.stage && (
                                                            <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan">
                                                                {getGuidedStageLabel(track.stage)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-text-muted mt-1">Current target: {formatDailyTarget(track)}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveDailyTrack(track.id)}
                                                    className="rounded-lg bg-red/10 px-2.5 py-1.5 text-[11px] font-semibold text-red"
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
                                                            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${track.stage === stage ? 'bg-cyan text-bg-surface' : 'bg-bg-input text-text-secondary'}`}
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
                                                            onChange={(event) => handleTrackTargetChange(track.id, {
                                                                seconds: Math.max(0, Number(event.target.value) || 0),
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
                                                            onChange={(event) => handleTrackTargetChange(track.id, {
                                                                reps: Math.max(0, Number(event.target.value) || 0),
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
                                                                onChange={(event) => handleTrackTargetChange(track.id, {
                                                                    sets: Math.max(0, Number(event.target.value) || 0),
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
                                                                onChange={(event) => handleTrackTargetChange(track.id, {
                                                                    reps: Math.max(0, Number(event.target.value) || 0),
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
                                                                    onChange={(event) => saveDailyConfigState({
                                                                        ...dailyConfig,
                                                                        activeTracks: dailyConfig.activeTracks.map((candidate) => (
                                                                            candidate.id === track.id
                                                                                ? { ...candidate, addedWeightKg: Math.max(0, Number(event.target.value) || 0) }
                                                                                : candidate
                                                                        )),
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
                                    <span className="text-[11px] text-text-muted">Quick start</span>
                                </div>
                                <div className="space-y-2">
                                    {recommendedDailyTracks.map((track) => (
                                        <button
                                            key={track.id}
                                            onClick={() => handleAddDailyTrack(track.exerciseName)}
                                            className="w-full rounded-xl border border-border bg-bg-card p-3 text-left"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">{track.exerciseName}</p>
                                                    <p className="text-xs text-text-muted mt-1">Default target: {track.defaultTarget.seconds ? `${track.defaultTarget.seconds / 60} min` : track.defaultTarget.sets ? `${track.defaultTarget.sets} x ${track.defaultTarget.reps}` : `${track.defaultTarget.reps} reps`}</p>
                                                </div>
                                                <span className="rounded-lg bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent flex items-center gap-1">
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
                                    <div className="flex items-center justify-between px-2 mb-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Search results</p>
                                        <span className="text-[11px] text-text-muted">Exercise library</span>
                                    </div>
                                    {dailySearchResults.length > 0 ? (
                                        <div className="space-y-2">
                                            {dailySearchResults.map((exerciseName) => (
                                                <button
                                                    key={exerciseName}
                                                    onClick={() => handleAddDailyTrack(exerciseName)}
                                                    className="w-full rounded-xl border border-border bg-bg-card p-3 text-left"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold">{exerciseName}</p>
                                                            <p className="text-xs text-text-muted mt-1">Create a daily track from this exercise</p>
                                                        </div>
                                                        <span className="rounded-lg bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent flex items-center gap-1">
                                                            <Plus size={12} />
                                                            Add
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-border bg-bg-card p-3 text-sm text-text-secondary">
                                            No matches yet. Try another exercise name.
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
