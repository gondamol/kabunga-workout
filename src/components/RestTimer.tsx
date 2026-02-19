import { useWorkoutStore } from '../stores/workoutStore';
import { formatTimer } from '../lib/timerService';
import { Timer, X, Plus, Minus } from 'lucide-react';

/**
 * Floating rest timer overlay — appears after completing a set
 * Features: countdown, +15s/-15s adjust, skip, visual progress ring
 */
export default function RestTimer() {
    const { isResting, restSeconds, restTarget, stopRest, startRest } = useWorkoutStore();

    if (!isResting) return null;

    const progress = restTarget > 0 ? ((restTarget - restSeconds) / restTarget) * 100 : 0;
    const circumference = 2 * Math.PI * 54; // radius 54
    const strokeOffset = circumference - (progress / 100) * circumference;
    const isWarning = restSeconds <= 5 && restSeconds > 0;

    return (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <div className="text-center space-y-6">
                {/* Phase label */}
                <p className="text-text-secondary text-sm font-medium uppercase tracking-wider">
                    Rest Timer
                </p>

                {/* Circular progress */}
                <div className="relative w-44 h-44 mx-auto">
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                        {/* Background ring */}
                        <circle
                            cx="60" cy="60" r="54"
                            fill="none"
                            stroke="rgba(139,92,246,0.1)"
                            strokeWidth="6"
                        />
                        {/* Progress ring */}
                        <circle
                            cx="60" cy="60" r="54"
                            fill="none"
                            stroke={isWarning ? '#ef4444' : '#8b5cf6'}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeOffset}
                            className="transition-all duration-1000 ease-linear"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-4xl font-black font-mono ${isWarning ? 'text-red animate-pulse' : 'gradient-text'}`}>
                            {formatTimer(restSeconds)}
                        </span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={() => startRest(Math.max(15, restSeconds - 15))}
                        className="w-12 h-12 rounded-xl glass flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
                        aria-label="Minus 15 seconds"
                    >
                        <Minus size={18} />
                    </button>
                    <button
                        onClick={stopRest}
                        className="w-16 h-16 rounded-2xl bg-accent text-white flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-accent/30"
                        aria-label="Skip rest"
                    >
                        <span className="text-sm font-bold">Skip</span>
                    </button>
                    <button
                        onClick={() => startRest(restSeconds + 15)}
                        className="w-12 h-12 rounded-xl glass flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
                        aria-label="Plus 15 seconds"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {/* Quick presets */}
                <div className="flex items-center justify-center gap-2">
                    {[60, 90, 120, 180].map(s => (
                        <button
                            key={s}
                            onClick={() => startRest(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-card text-text-secondary hover:text-accent transition-colors"
                        >
                            {s >= 60 ? `${s / 60}m` : `${s}s`}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
