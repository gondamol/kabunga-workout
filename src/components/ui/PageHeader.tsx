import type { ReactNode } from 'react';
import { cx } from './utils';

type PageHeaderProps = {
    eyebrow?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    action?: ReactNode;
    leading?: ReactNode;
    className?: string;
};

type SectionHeaderProps = {
    eyebrow?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    action?: ReactNode;
    className?: string;
};

export function PageHeader({ eyebrow, title, subtitle, action, leading, className }: PageHeaderProps) {
    return (
        <header className={cx('flex items-start justify-between gap-4', className)}>
            <div className="min-w-0">
                {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
                <div className="flex items-center gap-3">
                    {leading}
                    <h1 className="font-display text-3xl font-extrabold leading-tight text-text-primary">{title}</h1>
                </div>
                {subtitle && <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{subtitle}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </header>
    );
}

export function SectionHeader({ eyebrow, title, subtitle, action, className }: SectionHeaderProps) {
    return (
        <div className={cx('flex items-end justify-between gap-4', className)}>
            <div className="min-w-0">
                {eyebrow && <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
                <h2 className="text-lg font-extrabold leading-tight text-text-primary">{title}</h2>
                {subtitle && <p className="mt-1 text-sm leading-5 text-text-secondary">{subtitle}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

