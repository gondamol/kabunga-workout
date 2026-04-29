import type { ReactNode } from 'react';
import { BatteryCharging } from 'lucide-react';
import { ProgressRing } from './ProgressRing';
import { StatChip } from './StatChip';
import { cx } from './utils';

type ReadinessCardProps = {
    score?: number | null;
    status?: ReactNode;
    guidance?: ReactNode;
    contributors?: Array<{ label: ReactNode; value: ReactNode }>;
    action?: ReactNode;
    className?: string;
};

export function ReadinessCard({ score, status, guidance, contributors = [], action, className }: ReadinessCardProps) {
    const displayScore = typeof score === 'number' ? Math.round(score) : 0;
    const tone = displayScore >= 75 ? 'secondary' : displayScore >= 50 ? 'tertiary' : 'warning';

    return (
        <article className={cx('premium-card-high p-5', className)}>
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary-container text-primary">
                        <BatteryCharging size={21} aria-hidden="true" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Readiness</p>
                    <h3 className="mt-1 text-2xl font-extrabold text-text-primary">{status ?? 'No wearable needed'}</h3>
                    {guidance && <p className="mt-2 text-sm leading-6 text-text-secondary">{guidance}</p>}
                </div>
                <ProgressRing value={displayScore} tone={tone} label="Readiness" size={116} />
            </div>
            {contributors.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                    {contributors.map((item, index) => (
                        <StatChip key={index} label={item.label} value={item.value} tone="neutral" />
                    ))}
                </div>
            )}
            {action && <div className="mt-5">{action}</div>}
        </article>
    );
}

