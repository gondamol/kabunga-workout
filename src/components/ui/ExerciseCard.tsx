import type { ReactNode } from 'react';
import { Dumbbell } from 'lucide-react';
import { StatChip } from './StatChip';
import { cx } from './utils';

type ExerciseCardProps = {
    name: ReactNode;
    details?: ReactNode;
    stats?: Array<{ label: ReactNode; value?: ReactNode; icon?: ReactNode }>;
    action?: ReactNode;
    modification?: ReactNode;
    className?: string;
};

export function ExerciseCard({ name, details, stats = [], action, modification, className }: ExerciseCardProps) {
    return (
        <article className={cx('premium-card p-4', className)}>
            <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-primary">
                    <Dumbbell size={22} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="font-extrabold leading-tight text-text-primary">{name}</h3>
                            {details && <p className="mt-1 text-sm leading-5 text-text-secondary">{details}</p>}
                        </div>
                        {action}
                    </div>
                    {stats.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {stats.map((stat, index) => (
                                <StatChip key={index} icon={stat.icon} label={stat.label} value={stat.value} />
                            ))}
                        </div>
                    )}
                    {modification && <div className="mt-3 rounded-2xl bg-tertiary-container px-3 py-2 text-xs font-semibold leading-5 text-tertiary">{modification}</div>}
                </div>
            </div>
        </article>
    );
}

