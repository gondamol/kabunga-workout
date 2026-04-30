import type { ReadinessStatus } from '../../lib/types';

type ReadinessBadgeProps = {
    status: ReadinessStatus | null | undefined;
    score?: number | null;
    showScore?: boolean;
};

const TONE: Record<ReadinessStatus, { pill: string; label: string }> = {
    excellent: { pill: 'bg-green/15 text-green border-green/25', label: 'Ready' },
    good: { pill: 'bg-cyan/15 text-cyan border-cyan/25', label: 'Solid' },
    moderate: { pill: 'bg-amber/15 text-amber border-amber/25', label: 'Caution' },
    poor: { pill: 'bg-red/15 text-red border-red/25', label: 'Recovery' },
};

export function ReadinessBadge({ status, score, showScore = true }: ReadinessBadgeProps) {
    if (!status) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-surface px-3 py-1 text-[11px] font-semibold text-text-muted">
                Not checked in
            </span>
        );
    }
    const tone = TONE[status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${tone.pill}`}>
            {tone.label}
            {showScore && score !== undefined && score !== null && (
                <span className="opacity-80">· {Math.round(score)}/10</span>
            )}
        </span>
    );
}
