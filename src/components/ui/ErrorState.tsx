import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { cx } from './utils';

type ErrorStateProps = {
    title?: ReactNode;
    description: ReactNode;
    retryLabel?: string;
    onRetry?: () => void;
    isOffline?: boolean;
    className?: string;
};

export function ErrorState({
    title = 'Something needs attention',
    description,
    retryLabel = 'Try again',
    onRetry,
    isOffline = false,
    className,
}: ErrorStateProps) {
    return (
        <div className={cx('premium-card border-danger/20 bg-red/5 p-5', className)} role="alert">
            <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red/10 text-danger">
                    <AlertTriangle size={21} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-extrabold text-text-primary">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
                    {isOffline && <p className="mt-2 text-xs font-semibold text-danger">You appear to be offline. Saved changes will sync when connection returns.</p>}
                    {onRetry && (
                        <ActionButton className="mt-4" variant="secondary" size="sm" onClick={onRetry}>
                            {retryLabel}
                        </ActionButton>
                    )}
                </div>
            </div>
        </div>
    );
}

