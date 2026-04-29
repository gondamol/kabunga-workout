import type { ReactNode } from 'react';
import { cx } from './utils';

type MetricTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

type MetricCardProps = {
    label: string;
    value: ReactNode;
    helper?: ReactNode;
    delta?: ReactNode;
    icon?: ReactNode;
    tone?: MetricTone;
    className?: string;
};

const toneClasses: Record<MetricTone, string> = {
    primary: 'bg-primary-container text-primary',
    secondary: 'bg-secondary-container text-primary',
    tertiary: 'bg-tertiary-container text-tertiary',
    accent: 'bg-amber/12 text-amber',
    success: 'bg-green/12 text-success',
    warning: 'bg-amber/12 text-warning',
    danger: 'bg-red/12 text-danger',
    neutral: 'bg-surface-container text-text-secondary',
};

export function MetricCard({ label, value, helper, delta, icon, tone = 'neutral', className }: MetricCardProps) {
    return (
        <article className={cx('premium-card p-4', className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
                    <div className="mt-2 font-display text-3xl font-extrabold leading-none text-text-primary">{value}</div>
                </div>
                {icon && <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneClasses[tone])}>{icon}</div>}
            </div>
            {(helper || delta) && (
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    {helper && <span className="min-w-0 text-text-secondary">{helper}</span>}
                    {delta && <span className="shrink-0 font-bold text-primary">{delta}</span>}
                </div>
            )}
        </article>
    );
}

