import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { getUserWorkouts } from '../lib/firestoreService';
import { formatDurationHuman, formatRelativeTime } from '../lib/utils';
import type { WorkoutSession } from '../lib/types';
import { useEffect, useState } from 'react';
import { COMMON_EXERCISES } from '../lib/constants';
import {
    Play, Dumbbell, Clock, Plus, X, Search,
    GripVertical, ChevronRight, Trash2, History,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkoutPage() {
    const { user } = useAuthStore();
    const { startWorkout, activeSession, addExercise, initPlan, isTimerRunning } = useWorkoutStore();
    const navigate = useNavigate();

    const [history, setHistory] = useState<WorkoutSession[]>([]);
    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState('');
    const [custom, setCustom] = useState('');
    const [tab, setTab] = useState<'plan' | 'history'>('plan');

    // Queue = exercises already in the active session
    const queue = activeSession?.exercises ?? [];

    useEffect(() => {
        if (!user) return;
        getUserWorkouts(user.uid, 20)
            .then((data) => { if (data.length > 0) setHistory(data); })
            .catch(console.warn);
    }, [user]);

    // If there's an active session with a timer running, go straight to it
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
        // If no session yet, initialise a planning session (no timer)
        if (!activeSession) initPlan(user.uid);
        addExercise(name);
        setShowPicker(false);
        setSearch('');
        setCustom('');
    };

    const handleAddCustom = () => {
        if (custom.trim()) handleAddExercise(custom.trim());
    };

    const handleRemoveExercise = (id: string) => {
        useWorkoutStore.getState().removeExercise(id);
    };

    const filtered = COMMON_EXERCISES.filter(e =>
        e.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-5">
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
                    {/* Exercise Queue */}
                    <div className="space-y-2 animate-fade-in stagger-1">
                        {queue.length === 0 ? (
                            <div className="glass rounded-3xl p-8 text-center border-2 border-dashed border-border">
                                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                    <Dumbbell size={28} className="text-accent" />
                                </div>
                                <h3 className="font-bold text-base mb-1">Build your workout</h3>
                                <p className="text-sm text-text-secondary mb-5">
                                    Add exercises below, then hit Start when ready
                                </p>
                                <button
                                    onClick={() => setShowPicker(true)}
                                    className="px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                                >
                                    + Add First Exercise
                                </button>
                            </div>
                        ) : (
                            <>
                                {queue.map((ex, idx) => (
                                    <div
                                        key={ex.id}
                                        className="glass rounded-2xl p-4 flex items-center gap-3 animate-fade-in"
                                    >
                                        {/* Order number */}
                                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                            <span className="text-xs font-bold text-accent">{idx + 1}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{ex.name}</p>
                                            {ex.plannedSets && (
                                                <p className="text-xs text-text-muted mt-0.5">
                                                    {ex.plannedSets} sets × {ex.plannedReps} reps
                                                    {ex.plannedWeight ? ` @ ${ex.plannedWeight}kg` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveExercise(ex.id)}
                                            className="p-2 text-text-muted active:scale-90 transition-transform"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}

                                {/* Add more button */}
                                <button
                                    onClick={() => setShowPicker(true)}
                                    className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-text-muted text-sm font-medium flex items-center justify-center gap-2 hover:border-accent/40 hover:text-accent transition-colors"
                                >
                                    <Plus size={18} /> Add Exercise
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

                    {/* Quick stats row */}
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

                        {/* Search */}
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

                        {/* Custom */}
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

                        {/* List */}
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
