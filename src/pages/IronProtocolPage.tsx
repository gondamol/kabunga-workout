import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar, Check, ChevronRight, Dumbbell, Eye, Flame, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import {
    getFitnessDailyLogs,
    getOneRepMaxes,
    getUserWorkouts,
    saveFitnessDailyLog,
    saveOneRepMaxes,
} from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import type { FitnessDailyLog, OneRepMaxes, WorkoutSession } from '../lib/types';
import {
    getIronScheduleForDate,
    getIronTemplateById,
    getScaledIronTemplates,
    IRON_WEEKLY_SCHEDULE,
    normalizeOneRepMaxes,
    scaleTemplateForOneRepMaxes,
    type IronScheduleDay,
} from '../lib/ironProtocol';
import { getOneRepMaxPromptStatus } from '../lib/oneRepMaxes';
import OneRepMaxCard from '../components/OneRepMaxCard';

const dailyTasks = [
    { key: 'legRaisesDone', label: '10-Min Leg Raises' },
    { key: 'armCurlsDone', label: '5-Min Arm Curls' },
    { key: 'barHangDone', label: '3-Min Bar Hang' },
] as const;

type DailyTaskKey = (typeof dailyTasks)[number]['key'];

const normalizeExerciseName = (name: string): string =>
    name.toLowerCase().trim().replace(/\s+/g, ' ');

const getWeekStart = (date: Dayjs): Dayjs => {
    // Monday-based week start.
    return date.startOf('day').subtract((date.day() + 6) % 7, 'day');
};

const isDailyComplete = (log?: FitnessDailyLog): boolean => {
    if (!log) return false;
    return !!log.legRaisesDone && !!log.armCurlsDone && !!log.barHangDone;
};

const pickBestSet = (sessions: WorkoutSession[], exerciseNames: string[]): string => {
    const nameSet = new Set(exerciseNames.map(normalizeExerciseName));
    let bestWeight = 0;
    let bestReps = 0;
    let bestScore = 0;

    for (const session of sessions) {
        for (const exercise of session.exercises) {
            if (!nameSet.has(normalizeExerciseName(exercise.name))) continue;
            for (const setItem of exercise.sets) {
                const score = setItem.weight * setItem.reps;
                if (score > bestScore || (score === bestScore && setItem.weight > bestWeight)) {
                    bestScore = score;
                    bestWeight = setItem.weight;
                    bestReps = setItem.reps;
                }
            }
        }
    }

    if (bestScore <= 0) return '-';
    return `${bestWeight}kg x ${bestReps}`;
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
    const [dailyLogs, setDailyLogs] = useState<Record<string, FitnessDailyLog>>({});
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [showPatternRef, setShowPatternRef] = useState(false);
    const [savingMaxes, setSavingMaxes] = useState(false);
    const [updatingDaily, setUpdatingDaily] = useState(false);

    const today = dayjs();
    const todayKey = today.format('YYYY-MM-DD');
    const todaySchedule = getIronScheduleForDate(today);
    const [selectedWeekday, setSelectedWeekday] = useState<number>(today.day());

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        setOneRepMaxes((prev) => prev ?? normalizeOneRepMaxes(user.uid, null));

        const loadFast = async () => {
            try {
                const [maxes, logs] = await Promise.all([
                    getOneRepMaxes(user.uid),
                    getFitnessDailyLogs(user.uid, 14),
                ]);
                if (cancelled) return;

                setOneRepMaxes(normalizeOneRepMaxes(user.uid, maxes));
                setDailyLogs(logs.reduce<Record<string, FitnessDailyLog>>((acc, log) => {
                    acc[log.date] = log;
                    return acc;
                }, {}));
            } catch (error) {
                console.warn('Failed to load Iron Protocol data:', error);
                if (!cancelled) {
                    setOneRepMaxes(normalizeOneRepMaxes(user.uid, null));
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
        const existing = dailyLogs[todayKey];
        if (existing) return existing;
        return {
            userId: user?.uid || 'LOCAL',
            date: todayKey,
            legRaisesDone: false,
            armCurlsDone: false,
            barHangDone: false,
            completedAt: 0,
        };
    }, [dailyLogs, todayKey, user]);

    const dailyStreak = useMemo(() => {
        let streak = 0;
        for (let i = 0; i < 7; i++) {
            const dateKey = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
            if (isDailyComplete(dailyLogs[dateKey])) streak++;
            else break;
        }
        return streak;
    }, [dailyLogs]);

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

    const handleToggleDaily = async (key: DailyTaskKey) => {
        if (!user) return;
        if (updatingDaily) return;

        const updatedLog: FitnessDailyLog = {
            ...todayLog,
            userId: user.uid,
            date: todayKey,
            [key]: !todayLog[key],
            completedAt: Date.now(),
        };

        setUpdatingDaily(true);
        setDailyLogs((prev) => ({ ...prev, [todayKey]: updatedLog }));

        try {
            await saveFitnessDailyLog(user.uid, todayKey, updatedLog);
        } catch (error) {
            await enqueueAction({
                type: 'fitnessDaily',
                action: 'update',
                data: { uid: user.uid, date: todayKey, log: updatedLog },
            });
            toast('Daily log saved offline', { icon: '📴' });
            console.warn('Failed to save daily log:', error);
        } finally {
            setUpdatingDaily(false);
        }
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

    if (!oneRepMaxes) {
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
            <div className="glass rounded-3xl p-5" style={{ background: '#0D1B2A', borderColor: '#2D5F8A' }}>
                <p className="text-xs tracking-wider uppercase" style={{ color: '#D6E4F0' }}>Kabunga</p>
                <h1 className="text-2xl font-black mt-1 text-white">Iron Protocol</h1>
                <p className="text-sm mt-1" style={{ color: '#D6E4F0' }}>
                    Weekly PPL structure with auto-loaded daily sessions
                </p>
            </div>

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
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Fitness Dailies</h3>
                    <span className="text-xs text-text-muted">7-day streak: {dailyStreak}</span>
                </div>

                <div className="mt-3 space-y-2">
                    {dailyTasks.map((task) => {
                        const done = !!todayLog[task.key];
                        return (
                            <button
                                key={task.key}
                                onClick={() => handleToggleDaily(task.key)}
                                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors ${done ? 'border-green/40 bg-green/10' : 'border-border bg-bg-card'}`}
                            >
                                <span className="text-sm">{task.label}</span>
                                <span className={`w-6 h-6 rounded-md flex items-center justify-center ${done ? 'bg-green text-white' : 'bg-bg-input text-text-muted'}`}>
                                    {done ? <Check size={14} /> : null}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }, (_, idx) => {
                        const key = dayjs().subtract(6 - idx, 'day').format('YYYY-MM-DD');
                        const done = isDailyComplete(dailyLogs[key]);
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
        </div>
    );
}
