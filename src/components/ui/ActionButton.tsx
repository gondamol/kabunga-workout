import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './utils';

type ActionButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'tonal';
type ActionButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ActionButtonVariant;
    size?: ActionButtonSize;
    icon?: ReactNode;
    trailingIcon?: ReactNode;
    isLoading?: boolean;
    fullWidth?: boolean;
};

const variantClasses: Record<ActionButtonVariant, string> = {
    primary: 'bg-primary text-text-inverse shadow-card hover:bg-accent-light',
    secondary: 'border border-outline bg-bg-card text-text-primary shadow-card hover:bg-bg-card-hover',
    tertiary: 'bg-tertiary-container text-tertiary hover:bg-tertiary-container/80',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-container',
    danger: 'bg-danger text-white shadow-card hover:bg-red-light',
    tonal: 'bg-secondary-container text-primary hover:bg-secondary-container/80',
};

const sizeClasses: Record<ActionButtonSize, string> = {
    sm: 'min-h-11 px-4 py-2 text-sm',
    md: 'min-h-12 px-5 py-3 text-sm',
    lg: 'min-h-14 px-6 py-4 text-base',
    icon: 'h-11 w-11 p-0',
};

export function ActionButton({
    variant = 'primary',
    size = 'md',
    icon,
    trailingIcon,
    isLoading = false,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...props
}: ActionButtonProps) {
    const isIconOnly = size === 'icon';

    return (
        <button
            type={type}
            disabled={disabled || isLoading}
            className={cx(
                'touch-target pressable inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-bold leading-none disabled:opacity-55',
                variantClasses[variant],
                sizeClasses[size],
                fullWidth && 'w-full',
                isIconOnly && 'rounded-full',
                className,
            )}
            {...props}
        >
            {isLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : icon}
            {!isIconOnly && children}
            {!isLoading && trailingIcon}
        </button>
    );
}

