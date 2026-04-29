import type { ReactNode } from 'react';
import { cx } from './utils';

type StatChipTone = 'neutral' | 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger';

type StatChipProps = {
    icon?: ReactNode;
    label: ReactNode;
    value?: ReactNode;
    tone?: StatChipTone;
    className?: string;
};

const toneClasses: Record<StatChipTone, string> = {
    neutral: 'bg-bg-card text-text-secondary border-outline',
    primary: 'bg-primary-container text-primary border-primary/15',
    secondary: 'bg-secondary-container text-primary border-secondary/20',
    tertiary: 'bg-tertiary-container text-tertiary border-tertiary/15',
    accent: 'bg-amber/12 text-amber border-amber/20',
    danger: 'bg-red/10 text-danger border-red/20',
};

export function StatChip({ icon, label, value, tone = 'neutral', className }: StatChipProps) {
    return (
        <span className={cx('inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold', toneClasses[tone], className)}>
            {icon}
            <span>{label}</span>
            {value && <span className="text-text-primary">{value}</span>}
        </span>
    );
}

