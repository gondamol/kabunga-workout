import { useEffect, useState } from 'react';
import type { HealthCheck, HealthMood } from '../lib/types';

interface HealthCheckFormProps {
    athleteId: string;
    date: string;
    initialValue?: HealthCheck | null;
    saving?: boolean;
    onComplete: (check: HealthCheck) => Promise<void> | void;
    onCancel?: () => void;
}

const createInitialCheck = (
    athleteId: string,
    date: string,
    initialValue?: HealthCheck | null
): HealthCheck => {
    const now = Date.now();
    return {
        athleteId,
        date,
        sleepQuality: initialValue?.sleepQuality ?? 3,
        soreness: initialValue?.soreness ?? 3,
        mood: initialValue?.mood ?? 'normal',
        bodyWeightKg: initialValue?.bodyWeightKg,
        bodyFatPercent: initialValue?.bodyFatPercent,
        painNotes: initialValue?.painNotes ?? null,
        createdAt: initialValue?.createdAt ?? now,
        updatedAt: now,
    };
};

const sorenessLabel = (value: number): string => {
    if (value >= 8) return 'High';
    if (value >= 5) return 'Moderate';
    return 'Low';
};

export function HealthCheckForm({
    athleteId,
    date,
    initialValue,
    saving = false,
    onComplete,
    onCancel,
}: HealthCheckFormProps) {
    const [check, setCheck] = useState<HealthCheck>(() => createInitialCheck(athleteId, date, initialValue));

    useEffect(() => {
        setCheck(createInitialCheck(athleteId, date, initialValue));
    }, [athleteId, date, initialValue]);

    const setMood = (mood: HealthMood) => {
        setCheck((current) => ({ ...current, mood }));
    };

    const handleSubmit = async () => {
        await onComplete({
            ...check,
            athleteId,
            date,
            updatedAt: Date.now(),
        });
    };

    return (
        <div className="rounded-[28px] border border-border bg-bg-card p-5 shadow-sm space-y-5">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan">Daily check-in</p>
                <h3 className="text-lg font-bold mt-1">Update readiness</h3>
                <p className="text-sm text-text-secondary mt-1">
                    Quick recovery context before training. Optional body metrics stay athlete-only.
                </p>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-semibold">Sleep quality</p>
                <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setCheck((current) => ({ ...current, sleepQuality: value as HealthCheck['sleepQuality'] }))}
                            className={`rounded-2xl px-2 py-3 text-sm font-semibold border transition-colors ${
                                check.sleepQuality === value
                                    ? 'border-cyan bg-cyan/15 text-cyan'
                                    : 'border-border bg-bg-input text-text-secondary'
                            }`}
                        >
                            {value}
                        </button>
                    ))}
                </div>
                <p className="text-[11px] text-text-muted">1 = rough night, 5 = excellent sleep</p>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Soreness</p>
                    <span className="text-xs text-text-muted">{check.soreness}/10 • {sorenessLabel(check.soreness)}</span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="10"
                    value={check.soreness}
                    onChange={(event) => setCheck((current) => ({
                        ...current,
                        soreness: Number(event.target.value) as HealthCheck['soreness'],
                    }))}
                    className="w-full accent-cyan"
                />
            </div>

            <div className="space-y-2">
                <p className="text-sm font-semibold">Mood</p>
                <div className="grid grid-cols-3 gap-2">
                    {(['energetic', 'normal', 'tired'] as HealthMood[]).map((mood) => (
                        <button
                            key={mood}
                            type="button"
                            onClick={() => setMood(mood)}
                            className={`rounded-2xl px-3 py-3 text-sm font-semibold border capitalize transition-colors ${
                                check.mood === mood
                                    ? 'border-cyan bg-cyan/15 text-cyan'
                                    : 'border-border bg-bg-input text-text-secondary'
                            }`}
                        >
                            {mood}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-text-secondary">
                    Body weight (kg)
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={check.bodyWeightKg ?? ''}
                        onChange={(event) => setCheck((current) => ({
                            ...current,
                            bodyWeightKg: event.target.value ? Number(event.target.value) : undefined,
                        }))}
                        placeholder="Optional"
                        className="mt-1 w-full bg-bg-input border border-border rounded-2xl py-3 px-3"
                    />
                </label>
                <label className="text-sm text-text-secondary">
                    Body fat %
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={check.bodyFatPercent ?? ''}
                        onChange={(event) => setCheck((current) => ({
                            ...current,
                            bodyFatPercent: event.target.value ? Number(event.target.value) : undefined,
                        }))}
                        placeholder="Optional"
                        className="mt-1 w-full bg-bg-input border border-border rounded-2xl py-3 px-3"
                    />
                </label>
            </div>

            <label className="block text-sm text-text-secondary">
                Pain or injury notes
                <textarea
                    rows={3}
                    value={check.painNotes ?? ''}
                    onChange={(event) => setCheck((current) => ({
                        ...current,
                        painNotes: event.target.value,
                    }))}
                    placeholder="Optional. Example: left shoulder feels tight."
                    className="mt-1 w-full bg-bg-input border border-border rounded-2xl py-3 px-3"
                />
            </label>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={saving}
                    className="flex-1 py-3 rounded-2xl gradient-primary text-white font-semibold shadow-lg shadow-accent/15 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : initialValue ? 'Update Check-In' : 'Save Check-In'}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={saving}
                        className="px-4 py-3 rounded-2xl border border-border bg-white text-text-secondary disabled:opacity-50"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}

export default HealthCheckForm;
