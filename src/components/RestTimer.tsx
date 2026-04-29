import { useWorkoutStore } from '../stores/workoutStore';
import { formatTimer } from '../lib/timerService';
import { Plus, Minus } from 'lucide-react';
import { ActionButton, ProgressRing } from './ui';

/**
 * Floating rest timer overlay — appears after completing a set
 * Features: countdown, +15s/-15s adjust, skip, visual progress ring
 */
export default function RestTimer() {
    const { isResting, restSeconds, restTarget, stopRest, startRest } = useWorkoutStore();

    if (!isResting) return null;

    const progress = restTarget > 0 ? restTarget - restSeconds : 0;
    const isWarning = restSeconds <= 5 && restSeconds > 0;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-5 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-bg-card p-6 text-center shadow-lifted">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">Rest timer</p>
                <h2 className="mt-2 text-2xl font-extrabold text-text-primary">Breathe. Next set soon.</h2>

                <div className="mt-6 flex justify-center">
                    <ProgressRing
                        value={progress}
                        max={restTarget || 1}
                        size={184}
                        strokeWidth={7}
                        tone={isWarning ? 'danger' : 'secondary'}
                        label="Rest progress"
                        showValue={false}
                    >
                        <span className={`font-display text-5xl font-extrabold tabular-nums ${isWarning ? 'text-danger animate-pulse' : 'text-text-primary'}`}>
                            {formatTimer(restSeconds)}
                        </span>
                    </ProgressRing>
                </div>

                <div className="mt-7 flex items-center justify-center gap-4">
                    <ActionButton
                        onClick={() => startRest(Math.max(15, restSeconds - 15))}
                        size="icon"
                        variant="secondary"
                        aria-label="Minus 15 seconds"
                        icon={<Minus size={18} />}
                    />
                    <ActionButton
                        onClick={stopRest}
                        size="lg"
                        className="h-16 rounded-3xl px-8"
                        aria-label="Skip rest"
                    >
                        Skip
                    </ActionButton>
                    <ActionButton
                        onClick={() => startRest(restSeconds + 15)}
                        size="icon"
                        variant="secondary"
                        aria-label="Plus 15 seconds"
                        icon={<Plus size={18} />}
                    />
                </div>

                <div className="mt-5 flex items-center justify-center gap-2">
                    {[60, 90, 120, 180].map(s => (
                        <button
                            key={s}
                            onClick={() => startRest(s)}
                            className="touch-target pressable rounded-full bg-surface-container px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-primary"
                        >
                            {s >= 60 ? `${s / 60}m` : `${s}s`}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
