import type { ReactNode } from 'react';
import { cx } from './utils';

type SegmentedOption<T extends string> = {
    value: T;
    label: ReactNode;
    icon?: ReactNode;
};

type SegmentedControlProps<T extends string> = {
    options: Array<SegmentedOption<T>>;
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
    className?: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className }: SegmentedControlProps<T>) {
    return (
        <div
            className={cx('grid gap-1 rounded-[1.25rem] bg-surface-container p-1', className)}
            style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
            role="radiogroup"
            aria-label={ariaLabel}
        >
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onChange(option.value)}
                        className={cx(
                            'touch-target pressable flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold',
                            isActive ? 'bg-bg-card text-primary shadow-card' : 'text-text-muted hover:text-text-primary',
                        )}
                    >
                        {option.icon}
                        <span className="truncate">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

