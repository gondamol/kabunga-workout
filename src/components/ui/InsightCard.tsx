import type { ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { cx } from './utils';

type InsightTone = 'primary' | 'recovery' | 'progress' | 'warning';

type InsightCardProps = {
    title: ReactNode;
    description: ReactNode;
    source?: ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    icon?: ReactNode;
    tone?: InsightTone;
    className?: string;
};

const toneClasses: Record<InsightTone, string> = {
    primary: 'border-primary/15 bg-primary-container/55 text-primary',
    recovery: 'border-tertiary/15 bg-tertiary-container/65 text-tertiary',
    progress: 'border-amber/20 bg-amber/10 text-amber',
    warning: 'border-red/20 bg-red/10 text-danger',
};

export function InsightCard({ title, description, source, actionLabel, onAction, icon, tone = 'primary', className }: InsightCardProps) {
    return (
        <article className={cx('rounded-[1.5rem] border p-5', toneClasses[tone], className)}>
            <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bg-card/75">
                    {icon ?? <Lightbulb size={21} aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                    <h3 className="font-extrabold text-text-primary">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
                    {source && <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{source}</p>}
                    {actionLabel && onAction && (
                        <ActionButton className="mt-4" size="sm" variant="secondary" onClick={onAction}>
                            {actionLabel}
                        </ActionButton>
                    )}
                </div>
            </div>
        </article>
    );
}

