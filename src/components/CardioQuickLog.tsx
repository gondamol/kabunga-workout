import { useMemo, useState } from 'react';
import { Footprints, Bike, Mountain, Activity, X, Check, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { saveWorkout } from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import {
    buildCardioWorkoutSession,
    computeCardioSummary,
    computeHeartPointsForCardio,
    estimateCardioCalories,
    formatPace,
} from '../lib/heartPoints';
import type { CardioActivityType, WorkoutSession } from '../lib/types';

const ACTIVITY_OPTIONS: Array<{
    id: CardioActivityType;
    label: string;
    Icon: typeof Footprints;
    accent: string;
    iconBg: string;
}> = [
    { id: 'run', label: 'Run', Icon: Footprints, accent: 'text-secondary', iconBg: 'bg-secondary-container' },
    { id: 'walk', label: 'Walk', Icon: Activity, accent: 'text-tertiary', iconBg: 'bg-tertiary-container' },
    { id: 'cycle', label: 'Cycle', Icon: Bike, accent: 'text-amber', iconBg: 'bg-amber/15' },
    { id: 'hike', label: 'Hike', Icon: Mountain, accent: 'text-primary', iconBg: 'bg-primary-container' },
];

type CardioQuickLogProps = {
    open: boolean;
    onClose: () => void;
    onSaved?: (session: WorkoutSession) => void;
    initialActivity?: CardioActivityType;
};

export function CardioQuickLog({ open, onClose, onSaved, initialActivity = 'run' }: CardioQuickLogProps) {
    const { user } = useAuthStore();
    const [activity, setActivity] = useState<CardioActivityType>(initialActivity);
    const [minutes, setMinutes] = useState(30);
    const [distanceKm, setDistanceKm] = useState<number | ''>('');
    const [saving, setSaving] = useState(false);

    const durationSec = minutes * 60;
    const summary = useMemo(
        () => computeCardioSummary(activity, durationSec, typeof distanceKm === 'number' ? distanceKm : undefined),
        [activity, durationSec, distanceKm],
    );
    const calories = useMemo(
        () => estimateCardioCalories(activity, durationSec),
        [activity, durationSec],
    );
    const heartPoints = useMemo(
        () => computeHeartPointsForCardio(durationSec, summary.intensity ?? 'moderate'),
        [durationSec, summary.intensity],
    );

    const reset = () => {
        setActivity(initialActivity);
        setMinutes(30);
        setDistanceKm('');
    };

    const handleSave = async () => {
        if (!user) {
            toast.error('Sign in to log cardio');
            return;
        }
        if (minutes <= 0) {
            toast.error('Enter a duration');
            return;
        }
        setSaving(true);
        const session = buildCardioWorkoutSession({
            userId: user.uid,
            activity,
            durationSeconds: durationSec,
            distanceKm: typeof distanceKm === 'number' ? distanceKm : undefined,
        });
        try {
            await saveWorkout(session);
            toast.success(`${ACTIVITY_OPTIONS.find((o) => o.id === activity)?.label ?? 'Cardio'} logged · ${heartPoints} heart pts`);
        } catch {
            try {
                await enqueueAction({ type: 'workout', action: 'create', data: session });
                toast('Saved offline — will sync when online', { icon: '📴' });
            } catch (err) {
                console.warn('Failed to save cardio session:', err);
                toast.error('Could not save. Try again.');
                setSaving(false);
                return;
            }
        }
        setSaving(false);
        onSaved?.(session);
        onClose();
        reset();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[120] bg-black/55 flex items-end animate-fade-in" onClick={onClose}>
            <div
                className="w-full max-w-lg mx-auto bg-bg-card rounded-t-[2rem] px-5 pt-4 pb-7 max-h-[88vh] overflow-y-auto shadow-lifted"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-4" />
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-display text-xl font-extrabold text-text-primary">Log a Cardio Session</h3>
                        <p className="text-xs text-text-muted mt-0.5">Earn heart points and track recovery</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full bg-bg-surface text-text-muted">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-5">
                    {ACTIVITY_OPTIONS.map((opt) => {
                        const Icon = opt.Icon;
                        const selected = activity === opt.id;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => setActivity(opt.id)}
                                className={`rounded-2xl p-3 flex flex-col items-center gap-2 border transition-colors ${
                                    selected ? 'border-primary bg-primary-container/40' : 'border-border bg-bg-surface'
                                }`}
                            >
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center ${opt.iconBg}`}>
                                    <Icon size={18} className={opt.accent} strokeWidth={2.4} />
                                </span>
                                <span className={`text-[11px] font-bold ${selected ? 'text-primary' : 'text-text-secondary'}`}>
                                    {opt.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <label className="block mb-4">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Duration · minutes</span>
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMinutes((m) => Math.max(5, m - 5))}
                            className="w-10 h-10 rounded-xl bg-bg-surface text-text-secondary border border-border font-bold"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            min={1}
                            max={300}
                            value={minutes}
                            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 0))}
                            className="flex-1 rounded-xl border border-border bg-bg-input px-4 py-2.5 text-center font-display text-2xl font-extrabold text-text-primary"
                        />
                        <button
                            type="button"
                            onClick={() => setMinutes((m) => Math.min(300, m + 5))}
                            className="w-10 h-10 rounded-xl bg-bg-surface text-text-secondary border border-border font-bold"
                        >
                            +
                        </button>
                    </div>
                </label>

                <label className="block mb-5">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Distance · km (optional)</span>
                    <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        placeholder="e.g. 5.2"
                        className="mt-2 w-full rounded-xl border border-border bg-bg-input px-4 py-3 text-base font-semibold text-text-primary"
                    />
                </label>

                <div className="grid grid-cols-3 gap-3 mb-5">
                    <Stat label="Heart pts" value={String(heartPoints)} accent="text-red" iconBg="bg-red/10" Icon={Heart} />
                    <Stat label="Calories" value={String(calories)} accent="text-amber" iconBg="bg-amber/15" />
                    <Stat label="Pace" value={formatPace(summary.avgPaceMinPerKm)} accent="text-primary" iconBg="bg-primary-container" />
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    <Check size={18} strokeWidth={2.6} />
                    {saving ? 'Saving…' : 'Save Cardio'}
                </button>
            </div>
        </div>
    );
}

function Stat({
    label, value, accent, iconBg, Icon,
}: {
    label: string;
    value: string;
    accent: string;
    iconBg: string;
    Icon?: typeof Heart;
}) {
    return (
        <div className="rounded-2xl bg-bg-surface p-3 text-center">
            {Icon && (
                <span className={`inline-flex w-7 h-7 rounded-full ${iconBg} items-center justify-center mb-1`}>
                    <Icon size={14} className={accent} fill="currentColor" />
                </span>
            )}
            <p className={`font-display text-lg font-extrabold ${accent} leading-none`}>{value}</p>
            <p className="mt-1 text-[10px] font-semibold text-text-muted uppercase tracking-wide">{label}</p>
        </div>
    );
}
