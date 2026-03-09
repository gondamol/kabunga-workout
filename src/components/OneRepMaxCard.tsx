import type { OneRepMaxes } from '../lib/types';
import type { OneRepMaxPromptStatus } from '../lib/oneRepMaxes';
import { formatDate } from '../lib/utils';

interface OneRepMaxCardProps {
    title: string;
    subtitle: string;
    maxes: OneRepMaxes;
    status: OneRepMaxPromptStatus;
    saving: boolean;
    onChange: (key: keyof Omit<OneRepMaxes, 'userId' | 'updatedAt'>, value: number) => void;
    onSave: () => void;
}

const fieldConfig: Array<{
    key: keyof Omit<OneRepMaxes, 'userId' | 'updatedAt'>;
    label: string;
    fullWidth?: boolean;
}> = [
    { key: 'benchPress', label: 'Bench Press' },
    { key: 'backSquat', label: 'Back Squat' },
    { key: 'overheadPress', label: 'Overhead Press' },
    { key: 'bentOverRow', label: 'Bent-Over Row' },
    { key: 'romanianDL', label: 'Romanian Deadlift', fullWidth: true },
];

export default function OneRepMaxCard({
    title,
    subtitle,
    maxes,
    status,
    saving,
    onChange,
    onSave,
}: OneRepMaxCardProps) {
    return (
        <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${status.due ? 'bg-amber/15 text-amber' : 'bg-green/15 text-green'}`}>
                    {status.due ? 'Retest Due' : 'Current'}
                </span>
            </div>

            <div className="rounded-xl border border-border bg-bg-card px-3 py-2">
                <p className="text-xs text-text-secondary">{status.reason}</p>
                <p className="text-[11px] text-text-muted mt-1">
                    {status.lastUpdatedAt
                        ? `Last saved ${formatDate(status.lastUpdatedAt, 'MMM D, YYYY')} • ${status.workoutsSinceUpdate} workout${status.workoutsSinceUpdate === 1 ? '' : 's'} since then`
                        : 'No saved 1RM values yet. Defaults are still being used.'}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {fieldConfig.map((field) => (
                    <label
                        key={field.key}
                        className={`text-xs text-text-secondary ${field.fullWidth ? 'col-span-2' : ''}`}
                    >
                        {field.label}
                        <input
                            type="number"
                            inputMode="decimal"
                            value={maxes[field.key]}
                            onChange={(event) => onChange(field.key, parseFloat(event.target.value) || 0)}
                            className="mt-1 w-full bg-bg-input border border-border rounded-xl py-2 px-3 text-sm text-text-primary"
                        />
                    </label>
                ))}
            </div>

            <button
                onClick={onSave}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-accent text-white font-semibold disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Save 1RMs'}
            </button>
        </div>
    );
}
