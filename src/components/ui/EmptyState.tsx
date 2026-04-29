import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { cx } from './utils';

type EmptyStateProps = {
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    secondaryAction?: ReactNode;
    className?: string;
};

export function EmptyState({ icon, title, description, actionLabel, onAction, secondaryAction, className }: EmptyStateProps) {
    return (
        <div className={cx('premium-card p-6 text-center', className)}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-secondary-container text-primary">
                {icon ?? <Sparkles size={24} aria-hidden="true" />}
            </div>
            <h3 className="mt-4 text-xl font-extrabold text-text-primary">{title}</h3>
            {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>}
            {(actionLabel || secondaryAction) && (
                <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    {actionLabel && onAction && <ActionButton onClick={onAction}>{actionLabel}</ActionButton>}
                    {secondaryAction}
                </div>
            )}
        </div>
    );
}

