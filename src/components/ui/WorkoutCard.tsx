import type { ReactNode } from 'react';
import { ArrowRight, Dumbbell } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { StatChip } from './StatChip';
import { cx } from './utils';

type WorkoutCardProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    meta?: Array<{ label: ReactNode; icon?: ReactNode }>;
    progress?: ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    tone?: 'primary' | 'coach' | 'repeat' | 'neutral';
    className?: string;
};

const toneClasses = {
    primary: 'border-primary/15 bg-primary text-text-inverse',
    coach: 'border-tertiary/20 bg-tertiary-container text-text-primary',
    repeat: 'border-secondary/25 bg-secondary-container text-text-primary',
    neutral: 'border-outline bg-bg-card text-text-primary',
};

export function WorkoutCard({ title, subtitle, meta = [], progress, actionLabel, onAction, tone = 'neutral', className }: WorkoutCardProps) {
    const isPrimary = tone === 'primary';

    return (
        <article className={cx('rounded-[1.5rem] border p-5 shadow-card', toneClasses[tone], className)}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className={cx('mb-3 flex h-11 w-11 items-center justify-center rounded-2xl', isPrimary ? 'bg-white/14' : 'bg-primary-container text-primary')}>
                        <Dumbbell size={21} aria-hidden="true" />
                    </div>
                    <h3 className={cx('text-xl font-extrabold leading-tight', isPrimary ? 'text-text-inverse' : 'text-text-primary')}>{title}</h3>
                    {subtitle && <p className={cx('mt-2 text-sm leading-6', isPrimary ? 'text-white/78' : 'text-text-secondary')}>{subtitle}</p>}
                </div>
                {progress && <div className="shrink-0">{progress}</div>}
            </div>
            {meta.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {meta.map((item, index) => (
                        <StatChip key={index} icon={item.icon} label={item.label} tone={isPrimary ? 'secondary' : 'neutral'} />
                    ))}
                </div>
            )}
            {actionLabel && onAction && (
                <ActionButton
                    className="mt-5"
                    fullWidth
                    variant={isPrimary ? 'tonal' : 'primary'}
                    trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
                    onClick={onAction}
                >
                    {actionLabel}
                </ActionButton>
            )}
        </article>
    );
}

