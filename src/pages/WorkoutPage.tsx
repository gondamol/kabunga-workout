import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { getUserWorkouts } from '../lib/firestoreService';
import { formatDurationHuman, formatRelativeTime } from '../lib/utils';
import type { WorkoutSession } from '../lib/types';
import { useEffect, useState } from 'react';
import { Play, Dumbbell, Clock } from 'lucide-react';

export default function WorkoutPage() {
    const { user } = useAuthStore();
    const { startWorkout, activeSession } = useWorkoutStore();
    const navigate = useNavigate();
    const [history, setHistory] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(false); // Start false — no blocking spinner

    useEffect(() => {
        if (!user) return;

        // Load from Firestore in background — no spinner blocking the UI
        getUserWorkouts(user.uid, 20)
            .then((data) => {
                if (data.length > 0) setHistory(data);
            })
            .catch(console.warn)
            .finally(() => setLoading(false));
    }, [user]);

    const handleStart = () => {
        if (!user) return;
        if (activeSession) {
            navigate('/active-workout');
            return;
        }
        startWorkout(user.uid);
        navigate('/active-workout');
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6">
            <h1 className="text-2xl font-bold animate-fade-in">Workout</h1>

            {/* Start button */}
            <button
                id="start-new-workout"
                onClick={handleStart}
                className="w-full py-6 rounded-3xl gradient-primary text-white font-bold text-xl flex items-center justify-center gap-3 active:scale-[0.97] transition-transform shadow-xl shadow-accent/25 animate-fade-in"
            >
                <Play size={28} fill="white" />
                {activeSession ? 'Resume Workout' : 'Start New Workout'}
            </button>

            {/* Quick stats */}
            <div className="glass rounded-2xl p-4 flex items-center justify-around animate-fade-in stagger-1">
                <div className="text-center">
                    <p className="text-xl font-bold">{history.length}</p>
                    <p className="text-xs text-text-muted">Total</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                    <p className="text-xl font-bold">
                        {formatDurationHuman(history.reduce((s, w) => s + w.duration, 0))}
                    </p>
                    <p className="text-xs text-text-muted">Time</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                    <p className="text-xl font-bold">
                        {Math.round(history.reduce((s, w) => s + w.caloriesEstimate, 0))}
                    </p>
                    <p className="text-xs text-text-muted">Calories</p>
                </div>
            </div>

            {/* History */}
            <div className="animate-fade-in stagger-2">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Workout History</h3>
                {history.length === 0 ? (
                    <div className="text-center py-12">
                        <Dumbbell size={40} className="text-text-muted mx-auto mb-3" />
                        <p className="text-text-secondary text-sm">No workouts yet. Start your first!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {history.map((w) => (
                            <div key={w.id} className="glass rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
                                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                                    <Dumbbell size={18} className="text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {w.exercises.length > 0
                                            ? w.exercises.slice(0, 3).map((e) => e.name).join(', ')
                                            : 'Quick Session'}
                                        {w.exercises.length > 3 && ` +${w.exercises.length - 3}`}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-text-muted flex items-center gap-1">
                                            <Clock size={12} /> {formatDurationHuman(w.duration)}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                            {w.exercises.reduce((s, e) => s + e.sets.length, 0)} sets
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs text-text-muted shrink-0">
                                    {formatRelativeTime(w.startedAt)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
