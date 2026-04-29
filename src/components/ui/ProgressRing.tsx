import type { ReactNode } from 'react';
import { cx } from './utils';

type RingTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'success' | 'warning' | 'danger' | 'muted';

type ProgressRingProps = {
    value: number;
    max?: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
    helperText?: string;
    tone?: RingTone;
    showValue?: boolean;
    children?: ReactNode;
    className?: string;
};

const toneClasses: Record<RingTone, string> = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
    accent: 'text-amber',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    muted: 'text-text-muted',
};

export function ProgressRing({
    value,
    max = 100,
    size = 132,
    strokeWidth = 10,
    label,
    helperText,
    tone = 'secondary',
    showValue = true,
    children,
    className,
}: ProgressRingProps) {
    const normalized = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
    const radius = 50 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - normalized * circumference;
    const displayValue = Math.round(normalized * 100);

    return (
        <div
            className={cx('relative inline-flex shrink-0 items-center justify-center', toneClasses[tone], className)}
            style={{ width: size, height: size }}
            role={label ? 'img' : undefined}
            aria-label={label ? `${label}: ${displayValue}%` : undefined}
        >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.14"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center text-center">
                {children ?? (
                    <>
                        {showValue && <span className="font-display text-3xl font-extrabold text-text-primary">{displayValue}</span>}
                        {label && <span className="text-[0.68rem] font-bold uppercase leading-none text-text-muted">{label}</span>}
                        {helperText && <span className="mt-1 text-[0.68rem] font-semibold text-text-secondary">{helperText}</span>}
                    </>
                )}
            </div>
        </div>
    );
}

