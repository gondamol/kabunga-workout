import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { getAthleteCoachPlans, getOneRepMaxes, getUserWorkouts } from '../lib/firestoreService';
import { formatDurationHuman, formatRelativeTime } from '../lib/utils';
import type { CoachWorkoutPlan, ExerciseCatalogItem, WorkoutSession, WorkoutTemplate } from '../lib/types';
import { useEffect, useMemo, useState } from 'react';
import { COMMON_EXERCISES } from '../lib/constants';
import { BUILT_IN_TEMPLATES, getTemplateCategories } from '../lib/templates';
import { isIronTemplateId, scaleTemplateForUserOneRepMaxes } from '../lib/ironProtocol';
import { searchExerciseCatalog } from '../lib/exerciseCatalog';
import { formatProgressionInsightTarget, getProgressionSuggestionFromWorkouts, type ProgressionInsight } from '../lib/progressionInsights';
import { getWorkoutHeadline } from '../lib/workoutSummary';
import {
    Play, Dumbbell, Clock, Plus, X, Search, History, Calendar, Users, ClipboardList, LayoutGrid, Sparkles, LoaderCircle, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    ActionButton,
    EmptyState,
    MetricCard,
    PageHeader,
    SectionHeader,
    SegmentedControl,
    StatChip,
    WorkoutCard as PlanWorkoutCard,
} from '../components/ui';

const buildCatalogMetaLine = (item: ExerciseCatalogItem): string => {
    return [item.targetMuscle, item.exerciseType, item.difficulty]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .filter((value) => !['general', 'full body'].includes(value.trim().toLowerCase()))
        .join(' • ');
};

const buildCatalogTags = (item: ExerciseCatalogItem): string[] => {
    const tags = [
        item.bodyPart,
        item.targetMuscle,
        item.exerciseType,
        item.difficulty,
        ...(item.equipmentList && item.equipmentList.length > 0 ? item.equipmentList : [item.equipment]),
    ]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .filter((value) => !['general'].includes(value.trim().toLowerCase()))
        .map((value) => value.trim());

    return Array.from(new Set(tags));
};

export default function WorkoutPage() {
    const { user } = useAuthStore();
    const {
        startWorkout, activeSession, addExercise, initPlan,
        isTimerRunning, updateExercisePlan, removeExercise, loadCoachPlan, initFromTemplatePlan, activeTemplate, loadRepeatWorkout,
    } = useWorkoutStore();
    const navigate = useNavigate();

    const [history, setHistory] = useState<WorkoutSession[]>([]);
    const [coachPlans, setCoachPlans] = useState<CoachWorkoutPlan[]>([]);
    const [showPicker, setShowPicker] = useState(false);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [templateCategory, setTemplateCategory] = useState('All');
    const [search, setSearch] = useState('');
    const [custom, setCustom] = useState('');
    const [tab, setTab] = useState<'plan' | 'history'>('plan');
    const [catalogResults, setCatalogResults] = useState<ExerciseCatalogItem[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [selectedCatalogItem, setSelectedCatalogItem] = useState<ExerciseCatalogItem | null>(null);

    // Queue = exercises already in the active session
    const queue = activeSession?.exercises ?? [];
    const todayKey = new Date().toISOString().slice(0, 10);
    const latestWorkout = history[0] ?? null;
    const todayCoachPlans = coachPlans.filter((plan) => plan.scheduledDate === todayKey);
    const loadedCoachPlan = activeSession?.scheduledWorkoutId
        ? coachPlans.find((plan) => plan.id === activeSession.scheduledWorkoutId) ?? null
        : null;

    useEffect(() => {
        if (!user) return;
        Promise.all([
            getUserWorkouts(user.uid, 20),
            getAthleteCoachPlans(user.uid, 30),
        ])
            .then(([workoutHistory, plans]) => {
                if (workoutHistory.length > 0) setHistory(workoutHistory);
                setCoachPlans(plans);
            })
            .catch(console.warn);
    }, [user]);

    // Resume if already live, otherwise start fresh from the plan
    const handleResumeOrStart = () => {
        if (!user) return;
        if (activeSession && isTimerRunning) {
            navigate('/active-workout');
            return;
        }
        if (queue.length === 0) {
            toast('Add at least one exercise first! 💪', { icon: '⚠️' });
            return;
        }
        startWorkout(user.uid);
        navigate('/active-workout');
    };

    const handleAddExercise = (name: string, cue?: string) => {
        if (!user) return;
        if (!activeSession) initPlan(user.uid);
        addExercise(name, cue ? { cue } : undefined);
        setShowPicker(false);
        setSelectedCatalogItem(null);
        setSearch('');
        setCustom('');
    };

    const handleAddCustom = () => {
        if (custom.trim()) handleAddExercise(custom.trim());
    };

    const handleLoadCoachPlan = (plan: CoachWorkoutPlan) => {
        if (!user) return;
        if (activeSession && queue.length > 0 && !confirm('Replace your current plan with this coach-assigned plan?')) {
            return;
        }
        loadCoachPlan(user.uid, plan.id, plan.title, plan.notes, plan.exercises);
        toast.success('Coach plan loaded. Review and tap Start Workout.');
    };

    const handleRepeatLastWorkout = (startImmediately = false) => {
        if (!user || !latestWorkout) return;
        if (activeSession && queue.length > 0 && !confirm('Replace your current plan with your last workout?')) {
            return;
        }

        loadRepeatWorkout(user.uid, latestWorkout, { startImmediately });
        if (startImmediately) {
            toast.success('Last workout loaded and started.');
            navigate('/active-workout');
            return;
        }

        toast.success('Last workout loaded. Review it before starting.');
    };

    const filtered = COMMON_EXERCISES.filter(e =>
        e.toLowerCase().includes(search.toLowerCase())
    );
    const filteredLocalNames = useMemo(() => {
        const catalogNames = new Set(catalogResults.map((item) => item.name.toLowerCase()));
        return filtered.filter((name) => !catalogNames.has(name.toLowerCase()));
    }, [catalogResults, filtered]);

    useEffect(() => {
        if (!showPicker) {
            setCatalogResults([]);
            setCatalogLoading(false);
            return;
        }

        const query = search.trim();
        if (query.length < 2) {
            setCatalogResults([]);
            setCatalogLoading(false);
            return;
        }

        let cancelled = false;
        setCatalogLoading(true);
        const timeout = window.setTimeout(async () => {
            try {
                const results = await searchExerciseCatalog(query, 8);
                if (!cancelled) setCatalogResults(results);
            } catch (error) {
                console.warn('Exercise catalog lookup failed:', error);
                if (!cancelled) setCatalogResults([]);
            } finally {
                if (!cancelled) setCatalogLoading(false);
            }
        }, 400);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [search, showPicker]);

    const templateCategories = useMemo(
        () => ['All', ...getTemplateCategories(BUILT_IN_TEMPLATES)],
        []
    );
    const progressionSuggestions = useMemo<Record<string, ProgressionInsight>>(() => {
        if (queue.length === 0 || history.length === 0) return {};

        return queue.reduce<Record<string, ProgressionInsight>>((acc, exercise) => {
            if (exercise.isWarmup || exercise.phaseType === 'warmup') return acc;
            const suggestion = getProgressionSuggestionFromWorkouts(
                history,
                exercise.name,
                exercise.plannedReps,
                activeTemplate?.progressionRule || 'linear'
            );
            if (suggestion) acc[exercise.id] = suggestion;
            return acc;
        }, {});
    }, [activeTemplate?.progressionRule, history, queue]);
    const planBreakdown = useMemo(() => {
        return queue.reduce(
            (acc, exercise) => {
                if (exercise.phaseType === 'warmup' || exercise.isWarmup) {
                    acc.warmup += 1;
                } else if (exercise.phaseName?.toLowerCase().includes('cooldown')) {
                    acc.cooldown += 1;
                } else {
                    acc.main += 1;
                }
                acc.sets += exercise.plannedSets ?? exercise.sets.length ?? 0;
                return acc;
            },
            { warmup: 0, main: 0, cooldown: 0, sets: 0 }
        );
    }, [queue]);
    const filteredTemplates = useMemo(() => {
        if (templateCategory === 'All') return BUILT_IN_TEMPLATES;
        return BUILT_IN_TEMPLATES.filter((template) => template.category === templateCategory);
    }, [templateCategory]);

    const handleLoadTemplate = async (template: WorkoutTemplate) => {
        if (!user) return;
        if (activeSession && queue.length > 0 && !confirm('Replace your current plan with this template?')) {
            return;
        }

        let selectedTemplate = template;
        if (isIronTemplateId(template.id)) {
            try {
                const maxes = await getOneRepMaxes(user.uid);
                selectedTemplate = scaleTemplateForUserOneRepMaxes(template, user.uid, maxes);
            } catch (error) {
                console.warn('Failed to load 1RMs for template scaling:', error);
            }
        }

        initFromTemplatePlan(user.uid, selectedTemplate);
        setShowTemplatePicker(false);
        toast.success(`${selectedTemplate.title} loaded in planner`);
    };

    return (
        <div className="shell-page pt-6 pb-24 space-y-5">
            <PageHeader
                eyebrow="Today's training"
                title="Plan your session"
                subtitle="Fast lanes first, details when you need them. Bodyweight stays bodyweight when weight is zero."
                action={
                    <ActionButton size="icon" variant="secondary" icon={<Search size={19} />} aria-label="Search exercises" onClick={() => setShowPicker(true)} />
                }
                className="animate-fade-in"
            />

            <SegmentedControl
                ariaLabel="Workout page sections"
                value={tab}
                onChange={setTab}
                options={[
                    { value: 'plan', label: 'Plan', icon: <ClipboardList size={16} /> },
                    { value: 'history', label: 'History', icon: <History size={16} /> },
                ]}
                className="animate-fade-in"
            />

            {tab === 'plan' && (
                <>
                    <section className="grid gap-3 animate-fade-in">
                        <PlanWorkoutCard
                            title={activeSession && isTimerRunning ? 'Workout in progress' : 'Start quick session'}
                            subtitle={activeSession && isTimerRunning ? 'Resume the session already running.' : 'Add one movement, keep it simple, and start moving.'}
                            tone="primary"
                            actionLabel={activeSession && isTimerRunning ? 'Resume workout' : queue.length > 0 ? 'Start planned workout' : 'Add exercise'}
                            onAction={activeSession && isTimerRunning ? () => navigate('/active-workout') : queue.length > 0 ? handleResumeOrStart : () => setShowPicker(true)}
                            meta={[
                                { icon: <Dumbbell size={14} />, label: `${queue.length} exercises` },
                                { icon: <Clock size={14} />, label: `${planBreakdown.sets} sets` },
                            ]}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setShowTemplatePicker(true)}
                                className="pressable premium-card p-4 text-left"
                            >
                                <LayoutGrid size={20} className="text-primary" />
                                <p className="mt-3 font-extrabold text-text-primary">Templates</p>
                                <p className="mt-1 text-xs leading-5 text-text-secondary">Warmup, main work, cooldown.</p>
                            </button>
                            <button
                                type="button"
                                disabled={!latestWorkout}
                                onClick={() => handleRepeatLastWorkout(false)}
                                className="pressable premium-card p-4 text-left disabled:opacity-50"
                            >
                                <History size={20} className="text-tertiary" />
                                <p className="mt-3 font-extrabold text-text-primary">Repeat last</p>
                                <p className="mt-1 text-xs leading-5 text-text-secondary">
                                    {latestWorkout ? formatRelativeTime(latestWorkout.startedAt) : 'After your first session.'}
                                </p>
                            </button>
                        </div>
                    </section>

                    {activeSession?.scheduledWorkoutId && (
                        <div className="glass rounded-2xl p-4 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardList size={15} className="text-accent" />
                                <p className="text-sm font-semibold">Coach Plan Loaded</p>
                            </div>
                            <p className="text-xs text-text-secondary">
                                {loadedCoachPlan?.title || 'Assigned session'} - sets/reps/weight targets are prefilled. You can still adjust before starting.
                            </p>
                            {(activeSession.coachNotes || '').trim().length > 0 && (
                                <div className="mt-2 rounded-lg border border-accent/25 bg-accent/10 p-2">
                                    <p className="text-[10px] uppercase tracking-wide text-accent mb-1">Coach Notes</p>
                                    <p className="text-xs text-text-secondary whitespace-pre-wrap">{activeSession.coachNotes}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {todayCoachPlans.length > 0 && (
                        <div className="glass rounded-2xl p-4 animate-fade-in">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-semibold flex items-center gap-2">
                                    <Users size={15} className="text-accent" />
                                    Today&apos;s coach plan
                                </p>
                                <span className="text-xs text-text-muted">{todayCoachPlans.length} assigned</span>
                            </div>
                            <div className="space-y-2">
                                {todayCoachPlans.map((plan) => (
                                    <div key={plan.id} className="rounded-xl bg-bg-card border border-border p-3">
                                        <p className="text-sm font-semibold">{plan.title}</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            {plan.exercises.length} exercises
                                        </p>
                                        {plan.notes && (
                                            <p className="text-xs text-text-muted mt-1 line-clamp-2">Coach notes: {plan.notes}</p>
                                        )}
                                        <div className="mt-2 space-y-1">
                                            {plan.exercises.slice(0, 2).map((exercise, index) => (
                                                <p key={`${plan.id}-preview-${index}`} className="text-xs text-text-secondary">
                                                    <span className="font-medium text-text-primary">{exercise.name}:</span> {exercise.sets} x {exercise.reps} {exercise.weight > 0 ? `@ ${exercise.weight}kg` : '(bodyweight)'}
                                                </p>
                                            ))}
                                            {plan.exercises.length > 2 && (
                                                <p className="text-xs text-text-muted">+{plan.exercises.length - 2} more exercises</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleLoadCoachPlan(plan)}
                                            className="mt-2 w-full py-2 rounded-lg border border-accent/50 text-accent text-xs font-semibold"
                                        >
                                            Load Coach Plan
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {latestWorkout && !isTimerRunning && (
                        <div className="glass rounded-2xl p-4 animate-fade-in">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan">Last session</p>
                                    <h3 className="text-base font-bold mt-1">Repeat your last workout</h3>
                                    <p className="text-sm text-text-secondary mt-1">{getWorkoutHeadline(latestWorkout)}</p>
                                </div>
                                <div className="rounded-2xl bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan">
                                    {formatRelativeTime(latestWorkout.startedAt)}
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-xl bg-bg-card p-2">
                                    <p className="text-[10px] text-text-muted">Exercises</p>
                                    <p className="text-sm font-semibold">{latestWorkout.exercises.length}</p>
                                </div>
                                <div className="rounded-xl bg-bg-card p-2">
                                    <p className="text-[10px] text-text-muted">Duration</p>
                                    <p className="text-sm font-semibold">{formatDurationHuman(latestWorkout.duration)}</p>
                                </div>
                                <div className="rounded-xl bg-bg-card p-2">
                                    <p className="text-[10px] text-text-muted">Last Done</p>
                                    <p className="text-sm font-semibold">{dayjs(latestWorkout.startedAt).format('MMM D')}</p>
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => handleRepeatLastWorkout(false)}
                                    className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-text-primary"
                                >
                                    Load For Edit
                                </button>
                                <button
                                    onClick={() => handleRepeatLastWorkout(true)}
                                    className="flex-1 py-3 rounded-2xl gradient-primary text-white text-sm font-semibold"
                                >
                                    Start now
                                </button>
                            </div>
                        </div>
                    )}

                    <section className="premium-card p-4 animate-fade-in stagger-1">
                        <SectionHeader
                            title="Session structure"
                            subtitle="Keep warmup, main work, and cooldown visible before you start."
                        />
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <StatChip label="Warmup" value={planBreakdown.warmup} tone={planBreakdown.warmup > 0 ? 'secondary' : 'neutral'} />
                            <StatChip label="Main" value={planBreakdown.main} tone={planBreakdown.main > 0 ? 'primary' : 'neutral'} />
                            <StatChip label="Cooldown" value={planBreakdown.cooldown} tone={planBreakdown.cooldown > 0 ? 'tertiary' : 'neutral'} />
                        </div>
                    </section>

                    {/* Exercise Queue */}
                    <div className="space-y-3 animate-fade-in stagger-1">
                        {queue.length === 0 ? (
                            <EmptyState
                                icon={<Dumbbell size={28} />}
                                title="Build today's plan"
                                description="Add your warm-up, main lifts, and accessories, then move into the session."
                                actionLabel="Add first exercise"
                                onAction={() => setShowPicker(true)}
                                secondaryAction={
                                    <ActionButton variant="secondary" onClick={() => setShowTemplatePicker(true)} icon={<LayoutGrid size={16} />}>
                                        Template
                                    </ActionButton>
                                }
                            />
                        ) : (
                            <>
                                {queue.map((ex, idx) => (
                                    <ExerciseCard
                                        key={ex.id}
                                        index={idx}
                                        name={ex.name}
                                        plannedSets={ex.plannedSets ?? 1}
                                        plannedReps={ex.plannedReps ?? null}
                                        plannedWeight={ex.plannedWeight ?? null}
                                        suggestion={progressionSuggestions[ex.id] ?? null}
                                        phaseLabel={ex.phaseType === 'warmup' || ex.isWarmup ? 'Warmup' : ex.phaseName?.toLowerCase().includes('cooldown') ? 'Cooldown' : 'Main'}
                                        onChange={(patch) => updateExercisePlan(ex.id, patch)}
                                        onRemove={() => removeExercise(ex.id)}
                                    />
                                ))}

                                {/* Add more */}
                                <button
                                    onClick={() => setShowPicker(true)}
                                    className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-text-muted text-sm font-medium flex items-center justify-center gap-2 hover:border-accent/40 hover:text-accent transition-colors"
                                >
                                    <Plus size={18} /> Add Exercise
                                </button>
                                <button
                                    onClick={() => setShowTemplatePicker(true)}
                                    className="w-full py-3 rounded-2xl border border-border text-text-muted text-sm font-medium flex items-center justify-center gap-2 hover:border-accent/40 hover:text-accent transition-colors"
                                >
                                    <LayoutGrid size={16} />
                                    Add From Template
                                </button>
                            </>
                        )}
                    </div>

                    {/* Start / Resume button */}
                    {activeSession && isTimerRunning ? (
                        <button
                            onClick={() => navigate('/active-workout')}
                            className="w-full py-5 rounded-3xl bg-amber text-bg-primary font-bold text-lg flex items-center justify-center gap-3 active:scale-[0.97] transition-transform shadow-lg shadow-amber/20 animate-fade-in stagger-2"
                        >
                            <Play size={24} fill="currentColor" />
                            Resume Workout
                        </button>
                    ) : (
                        <button
                            id="start-workout-btn"
                            onClick={handleResumeOrStart}
                            disabled={queue.length === 0}
                            className="w-full py-5 rounded-3xl gradient-primary text-white font-bold text-lg flex items-center justify-center gap-3 active:scale-[0.97] transition-transform shadow-xl shadow-accent/25 disabled:opacity-40 disabled:scale-100 animate-fade-in stagger-2"
                        >
                            <Play size={24} fill="white" />
                            Start Workout
                            {queue.length > 0 && (
                                <span className="text-sm opacity-80">({queue.length} exercises)</span>
                            )}
                        </button>
                    )}

                    {/* Quick stats */}
                    {history.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 animate-fade-in stagger-3">
                            <MetricCard label="Sessions" value={history.length} className="p-3" />
                            <MetricCard label="Time" value={formatDurationHuman(history.reduce((s, w) => s + w.duration, 0))} className="p-3" />
                            <MetricCard label="Energy" value={Math.round(history.reduce((s, w) => s + w.caloriesEstimate, 0))} helper="kcal" className="p-3" />
                        </div>
                    )}
                </>
            )}

            {tab === 'history' && (
                <div className="space-y-2 animate-fade-in">
                    <button
                        onClick={() => navigate('/history')}
                        className="w-full py-3 rounded-2xl border border-border text-sm text-text-secondary flex items-center justify-center gap-2 mb-2"
                    >
                        <Calendar size={16} />
                        Open Calendar View
                    </button>
                    {history.length === 0 ? (
                        <div className="text-center py-16">
                            <History size={40} className="text-text-muted mx-auto mb-3" />
                            <p className="text-text-secondary text-sm">No workouts yet — start your first!</p>
                        </div>
                    ) : (
                        history.map((w) => (
                            <div key={w.id} className="glass rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
                                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                                    <Dumbbell size={18} className="text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                        {w.exercises.length > 0
                                            ? w.exercises.slice(0, 3).map(e => e.name).join(', ')
                                            : 'Quick Session'}
                                        {w.exercises.length > 3 && ` +${w.exercises.length - 3}`}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-text-muted flex items-center gap-1">
                                            <Clock size={11} /> {formatDurationHuman(w.duration)}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                            {w.exercises.reduce((s, e) => s + e.sets.length, 0)} sets
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs text-text-muted shrink-0">{formatRelativeTime(w.startedAt)}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Exercise Picker Sheet */}
            {showPicker && (
                <div
                    className="fixed inset-0 z-[100] bg-black/60 flex items-end"
                    onClick={() => setShowPicker(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl px-4 pt-3 pb-4 max-h-[88vh] flex flex-col animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-3" />

                        <div className="sticky top-0 z-10 bg-bg-surface pb-3">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold">Add Exercise</h3>
                                    <p className="text-xs text-text-muted mt-1">Search by exercise name or muscle, or add your own.</p>
                                </div>
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
                                    placeholder="Bench press, biceps, shoulders..."
                                    autoFocus
                                    className="w-full bg-bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-accent/50"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr_auto] gap-2">
                                <input
                                    type="text"
                                    value={custom}
                                    onChange={e => setCustom(e.target.value)}
                                    placeholder="Custom exercise name..."
                                    className="min-w-0 bg-bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent/50"
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
                        </div>

                        <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-3">
                            {search.trim().length < 2 && (
                                <div className="rounded-xl bg-bg-card border border-border p-3 text-sm text-text-secondary">
                                    Type at least 2 letters to search the API. The list below is only your quick-add library.
                                </div>
                            )}
                            {search.trim().length >= 2 && (
                                <div>
                                    <div className="flex items-center justify-between px-2 mb-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Exercise Catalog</p>
                                        <span className="text-[11px] text-text-muted">API + local backup</span>
                                    </div>
                                    {catalogLoading ? (
                                        <div className="rounded-xl bg-bg-card border border-border p-3 flex items-center gap-2 text-sm text-text-secondary">
                                            <LoaderCircle size={15} className="animate-spin text-accent" />
                                            Searching exercise catalog...
                                        </div>
                                    ) : catalogResults.length > 0 ? (
                                        <div className="space-y-2">
                                            {catalogResults.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setSelectedCatalogItem(item)}
                                                    className="w-full text-left rounded-xl bg-bg-card border border-border p-3 hover:border-accent/40 transition-colors"
                                                >
                                                    <div className="flex gap-3">
                                                        <ExerciseCatalogMedia item={item} className="w-14 h-14 rounded-xl overflow-hidden bg-bg-input shrink-0" iconSize={16} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-sm font-semibold truncate">{item.name}</p>
                                                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.source === 'api' ? 'bg-cyan/10 text-cyan' : 'bg-bg-input text-text-muted'}`}>
                                                                    {item.source === 'api' ? 'API' : 'Local'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-text-secondary mt-1 truncate">
                                                                {buildCatalogMetaLine(item) || `${item.bodyPart} • ${item.equipment}`}
                                                            </p>
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                {buildCatalogTags(item).slice(0, 3).map((tag) => (
                                                                    <span key={`${item.id}-${tag}`} className="px-2 py-0.5 rounded-full bg-bg-input text-[10px] text-text-muted">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl bg-bg-card border border-border p-3 text-sm text-text-secondary">
                                            No API matches yet. Local exercise names are still available below.
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Quick Add</p>
                                    <span className="text-[11px] text-text-muted">{filteredLocalNames.length} matches</span>
                                </div>
                                {filteredLocalNames.map(name => (
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
                </div>
            )}

            {selectedCatalogItem && (
                <div
                    className="fixed inset-0 z-[120] bg-black/70 flex items-end"
                    onClick={() => setSelectedCatalogItem(null)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl px-4 pt-3 pb-4 max-h-[92vh] flex flex-col animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-3" />

                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                    {selectedCatalogItem.source === 'api' ? 'API Result' : 'Kabunga Library'}
                                </p>
                                <h3 className="text-lg font-bold mt-1">{selectedCatalogItem.name}</h3>
                                <p className="text-xs text-text-secondary mt-1">
                                    {buildCatalogMetaLine(selectedCatalogItem) || `${selectedCatalogItem.bodyPart} • ${selectedCatalogItem.equipment}`}
                                </p>
                            </div>
                            <button onClick={() => setSelectedCatalogItem(null)} className="p-2 text-text-muted">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 -mx-1 px-1 pb-4">
                            <div className="rounded-2xl overflow-hidden bg-bg-input mb-4">
                                <ExerciseCatalogMedia
                                    item={selectedCatalogItem}
                                    className="w-full aspect-[4/3]"
                                    iconSize={26}
                                    showModeBadge
                                />
                            </div>

                            {!selectedCatalogItem.gifUrl && (
                                <p className="text-xs text-text-muted mb-4">
                                    No live demo was returned for this exercise. Kabunga is showing a free local muscle-focus visual instead.
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-4">
                                {buildCatalogTags(selectedCatalogItem).map((tag) => (
                                    <span key={`${selectedCatalogItem.id}-tag-${tag}`} className="px-2.5 py-1 rounded-full bg-bg-card text-xs text-text-secondary">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {selectedCatalogItem.safetyInfo && (
                                <div className="rounded-2xl bg-orange-500/10 border border-orange-500/20 p-4 mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield size={14} className="text-orange-300" />
                                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-200">Safety</p>
                                    </div>
                                    <p className="text-sm text-text-secondary">{selectedCatalogItem.safetyInfo}</p>
                                </div>
                            )}

                            <div className="rounded-2xl bg-bg-card border border-border p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Instructions</p>
                                {selectedCatalogItem.instructions.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedCatalogItem.instructions.map((instruction, index) => (
                                            <p key={`${selectedCatalogItem.id}-step-${index}`} className="text-sm text-text-secondary">
                                                {index + 1}. {instruction}
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-secondary">
                                        No instructions were returned. You can still add the exercise and adjust it manually.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-border pt-4 bg-bg-surface">
                            <button
                                onClick={() => handleAddExercise(
                                    selectedCatalogItem.name,
                                    selectedCatalogItem.instructions.slice(0, 3).join(' ')
                                )}
                                className="w-full py-3 rounded-2xl gradient-primary text-white font-semibold"
                            >
                                Add Exercise
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showTemplatePicker && (
                <div
                    className="fixed inset-0 z-[110] bg-black/60 flex items-end"
                    onClick={() => setShowTemplatePicker(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl p-6 max-h-[85vh] flex flex-col animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Load Template</h3>
                            <button onClick={() => setShowTemplatePicker(false)} className="p-2 text-text-muted">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                            {templateCategories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setTemplateCategory(category)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${templateCategory === category
                                        ? 'bg-accent text-white'
                                        : 'bg-bg-card text-text-secondary border border-border'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                        <div className="overflow-y-auto space-y-2">
                            {filteredTemplates.map((template) => {
                                const exerciseCount = template.phases.reduce((sum, phase) => sum + phase.exercises.length, 0);
                                return (
                                    <button
                                        key={template.id}
                                        onClick={() => { void handleLoadTemplate(template); }}
                                        className="w-full text-left rounded-xl border border-border bg-bg-card p-3 hover:border-accent/40 transition-colors"
                                    >
                                        <p className="text-sm font-semibold">{template.title}</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            {template.category} • {exerciseCount} exercises
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Exercise catalog media preview
// ──────────────────────────────────────────────────────────────────────────────
interface ExerciseCatalogMediaProps {
    item: ExerciseCatalogItem;
    className: string;
    iconSize?: number;
    showModeBadge?: boolean;
}

function ExerciseCatalogMedia({ item, className, iconSize = 20, showModeBadge = false }: ExerciseCatalogMediaProps) {
    const [mode, setMode] = useState<'gif' | 'muscle' | 'fallback'>(() => {
        if (item.gifUrl) return 'gif';
        if (item.muscleImageUrl) return 'muscle';
        return 'fallback';
    });

    useEffect(() => {
        if (item.gifUrl) {
            setMode('gif');
            return;
        }
        if (item.muscleImageUrl) {
            setMode('muscle');
            return;
        }
        setMode('fallback');
    }, [item.gifUrl, item.id, item.muscleImageUrl]);

    const src = mode === 'gif' ? item.gifUrl : (mode === 'muscle' ? item.muscleImageUrl : null);
    const label = mode === 'gif' ? 'Demo' : (mode === 'muscle' ? 'Muscle Map' : null);

    return (
        <div className={`relative ${className}`}>
            {src ? (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={() => {
                        if (mode === 'gif' && item.muscleImageUrl) {
                            setMode('muscle');
                            return;
                        }
                        setMode('fallback');
                    }}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <Sparkles size={iconSize} />
                </div>
            )}

            {showModeBadge && label && (
                <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                    {label}
                </span>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Inline editable exercise card for the Plan tab
// ──────────────────────────────────────────────────────────────────────────────
interface ExerciseCardProps {
    index: number;
    name: string;
    plannedSets: number;
    plannedReps: number | null;
    plannedWeight: number | null;  // null = bodyweight
    suggestion: ProgressionInsight | null;
    phaseLabel: string;
    onChange: (patch: { plannedSets?: number; plannedReps?: number | null; plannedWeight?: number | null }) => void;
    onRemove: () => void;
}

function ExerciseCard({ index, name, plannedSets, plannedReps, plannedWeight, suggestion, phaseLabel, onChange, onRemove }: ExerciseCardProps) {
    return (
        <div className="premium-card p-4 animate-fade-in">
            {/* Top row: number + name + remove */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl bg-primary-container flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{index + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm truncate">{name}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{phaseLabel}</p>
                </div>
                <button
                    onClick={onRemove}
                    className="touch-target p-1.5 text-text-muted hover:text-red active:scale-90 transition-all"
                    aria-label={`Remove ${name}`}
                >
                    <X size={16} />
                </button>
            </div>

            {/* Input row: Sets — Reps — Weight */}
            <div className="grid grid-cols-3 gap-2">
                {/* Sets */}
                <div>
                    <label className="block text-[10px] text-text-muted font-semibold uppercase tracking-wide mb-1 text-center">
                        Sets
                    </label>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onChange({ plannedSets: Math.max(1, plannedSets - 1) })}
                            className="w-8 h-8 rounded-lg bg-bg-input border border-border flex items-center justify-center text-lg font-bold text-text-muted active:scale-90 transition-transform"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={plannedSets}
                            min={1}
                            max={20}
                            onChange={e => {
                                const v = parseInt(e.target.value);
                                if (v >= 1) onChange({ plannedSets: v });
                            }}
                            className="flex-1 min-w-0 bg-bg-input border border-border rounded-xl py-2 text-sm text-center font-bold focus:outline-none focus:border-accent/50"
                        />
                        <button
                            onClick={() => onChange({ plannedSets: Math.min(20, plannedSets + 1) })}
                            className="w-8 h-8 rounded-lg bg-bg-input border border-border flex items-center justify-center text-lg font-bold text-text-muted active:scale-90 transition-transform"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Reps */}
                <div>
                    <label className="block text-[10px] text-text-muted font-semibold uppercase tracking-wide mb-1 text-center">
                        Reps
                    </label>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={plannedReps ?? ''}
                        placeholder="—"
                        onChange={e => {
                            const v = parseInt(e.target.value);
                            onChange({ plannedReps: isNaN(v) ? null : v });
                        }}
                        className="w-full bg-bg-input border border-border rounded-xl py-2 text-sm text-center font-bold focus:outline-none focus:border-accent/50"
                    />
                </div>

                {/* Weight — optional */}
                <div>
                    <label className="block text-[10px] text-text-muted font-semibold uppercase tracking-wide mb-1 text-center">
                        kg <span className="normal-case font-normal">(opt)</span>
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={plannedWeight ?? ''}
                        placeholder="BW"
                        onChange={e => {
                            const raw = e.target.value;
                            onChange({ plannedWeight: raw === '' ? null : parseFloat(raw) || null });
                        }}
                        className="w-full bg-bg-input border border-border rounded-xl py-2 text-sm text-center font-bold focus:outline-none focus:border-accent/50"
                    />
                </div>
            </div>

            {/* Summary line */}
            <p className="text-xs text-text-muted mt-2 text-center">
                {plannedSets} set{plannedSets !== 1 ? 's' : ''}
                {plannedReps ? ` × ${plannedReps} reps` : ''}
                {plannedWeight ? ` @ ${plannedWeight}kg` : ' - bodyweight'}
            </p>

            {suggestion && (
                <div className="mt-3 rounded-xl border border-cyan/20 bg-cyan/10 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-cyan font-semibold">Suggested Next Load</p>
                    <p className="text-sm font-semibold mt-1">{formatProgressionInsightTarget(suggestion)}</p>
                    <p className="text-xs text-text-secondary mt-1">{suggestion.reason}</p>
                </div>
            )}
        </div>
    );
}
