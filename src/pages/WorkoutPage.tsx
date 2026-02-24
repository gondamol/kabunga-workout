import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { getAthleteCoachPlans, getOneRepMaxes, getUserWorkouts } from '../lib/firestoreService';
import { formatDurationHuman, formatRelativeTime } from '../lib/utils';
import type { CoachWorkoutPlan, WorkoutSession, WorkoutTemplate } from '../lib/types';
import { useEffect, useMemo, useState } from 'react';
import { COMMON_EXERCISES } from '../lib/constants';
import { BUILT_IN_TEMPLATES, getTemplateCategories } from '../lib/templates';
import { isIronTemplateId, normalizeOneRepMaxes, scaleTemplateForOneRepMaxes } from '../lib/ironProtocol';
import {
    Play, Dumbbell, Clock, Plus, X, Search, History, Calendar, Users, ClipboardList, LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkoutPage() {
    const { user } = useAuthStore();
    const {
        startWorkout, activeSession, addExercise, initPlan,
        isTimerRunning, updateExercisePlan, removeExercise, loadCoachPlan, initFromTemplatePlan,
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

    // Queue = exercises already in the active session
    const queue = activeSession?.exercises ?? [];
    const todayKey = new Date().toISOString().slice(0, 10);
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

    const handleAddExercise = (name: string) => {
        if (!user) return;
        if (!activeSession) initPlan(user.uid);
        addExercise(name);
        setShowPicker(false);
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

    const filtered = COMMON_EXERCISES.filter(e =>
        e.toLowerCase().includes(search.toLowerCase())
    );

    const templateCategories = useMemo(
        () => ['All', ...getTemplateCategories(BUILT_IN_TEMPLATES)],
        []
    );
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
                selectedTemplate = scaleTemplateForOneRepMaxes(
                    template,
                    normalizeOneRepMaxes(user.uid, maxes)
                );
            } catch (error) {
                console.warn('Failed to load 1RMs for template scaling:', error);
            }
        }

        initFromTemplatePlan(user.uid, selectedTemplate);
        setShowTemplatePicker(false);
        toast.success(`${selectedTemplate.title} loaded in planner`);
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in">
                <h1 className="text-2xl font-bold">Workout</h1>
                <div className="flex gap-1 bg-bg-card rounded-xl p-1">
                    <button
                        onClick={() => setTab('plan')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'plan' ? 'bg-accent text-white' : 'text-text-muted'}`}
                    >
                        Plan
                    </button>
                    <button
                        onClick={() => setTab('history')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'history' ? 'bg-accent text-white' : 'text-text-muted'}`}
                    >
                        History
                    </button>
                </div>
            </div>

            {tab === 'plan' && (
                <>
                    {/* Tip banner */}
                    <p className="text-xs text-text-muted px-1">
                        Set up your exercises below — sets, reps, weight — then tap <strong className="text-text-primary">Start Workout</strong>. You'll move straight to doing them one by one.
                    </p>

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
                                    Coach Plan For Today
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

                    {/* Exercise Queue */}
                    <div className="space-y-3 animate-fade-in stagger-1">
                        {queue.length === 0 ? (
                            <div className="glass rounded-3xl p-8 text-center border-2 border-dashed border-border">
                                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                    <Dumbbell size={28} className="text-accent" />
                                </div>
                                <h3 className="font-bold text-base mb-1">Build your workout</h3>
                                <p className="text-sm text-text-secondary mb-5">
                                    Add your warmup, main lifts and cooldown — then hit Start
                                </p>
                                <button
                                    onClick={() => setShowPicker(true)}
                                    className="px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                                >
                                    + Add First Exercise
                                </button>
                                <button
                                    onClick={() => setShowTemplatePicker(true)}
                                    className="mt-2 px-6 py-3 rounded-xl border border-border text-text-secondary font-semibold text-sm active:scale-[0.97] transition-transform"
                                >
                                    <LayoutGrid size={14} className="inline mr-1" />
                                    Add From Template
                                </button>
                            </div>
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
                        <div className="glass rounded-2xl p-4 flex items-center justify-around animate-fade-in stagger-3">
                            <div className="text-center">
                                <p className="text-lg font-bold">{history.length}</p>
                                <p className="text-xs text-text-muted">Sessions</p>
                            </div>
                            <div className="w-px h-7 bg-border" />
                            <div className="text-center">
                                <p className="text-lg font-bold">
                                    {formatDurationHuman(history.reduce((s, w) => s + w.duration, 0))}
                                </p>
                                <p className="text-xs text-text-muted">Total Time</p>
                            </div>
                            <div className="w-px h-7 bg-border" />
                            <div className="text-center">
                                <p className="text-lg font-bold">
                                    {Math.round(history.reduce((s, w) => s + w.caloriesEstimate, 0))}
                                </p>
                                <p className="text-xs text-text-muted">Calories</p>
                            </div>
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
                                placeholder="Custom exercise name..."
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
// Inline editable exercise card for the Plan tab
// ──────────────────────────────────────────────────────────────────────────────
interface ExerciseCardProps {
    index: number;
    name: string;
    plannedSets: number;
    plannedReps: number | null;
    plannedWeight: number | null;  // null = bodyweight
    onChange: (patch: { plannedSets?: number; plannedReps?: number | null; plannedWeight?: number | null }) => void;
    onRemove: () => void;
}

function ExerciseCard({ index, name, plannedSets, plannedReps, plannedWeight, onChange, onRemove }: ExerciseCardProps) {
    return (
        <div className="glass rounded-2xl p-4 animate-fade-in">
            {/* Top row: number + name + remove */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-accent">{index + 1}</span>
                </div>
                <p className="flex-1 font-semibold text-sm truncate">{name}</p>
                <button
                    onClick={onRemove}
                    className="p-1.5 text-text-muted hover:text-red active:scale-90 transition-all"
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
                {plannedWeight ? ` @ ${plannedWeight}kg` : ' — bodyweight'}
            </p>
        </div>
    );
}
