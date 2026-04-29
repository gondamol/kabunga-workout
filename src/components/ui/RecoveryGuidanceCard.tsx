import type { ReactNode } from 'react';
import { HeartPulse } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { cx } from './utils';

type RecoveryGuidanceCardProps = {
    title?: ReactNode;
    description: ReactNode;
    options?: ReactNode[];
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
};

export function RecoveryGuidanceCard({
    title = 'Recovery still counts',
    description,
    options = [],
    actionLabel,
    onAction,
    className,
}: RecoveryGuidanceCardProps) {
    return (
        <article className={cx('rounded-[1.5rem] border border-tertiary/20 bg-tertiary-container p-5', className)}>
            <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bg-card/80 text-tertiary">
                    <HeartPulse size={21} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-extrabold text-text-primary">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
                    {options.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {options.map((option, index) => (
                                <span key={index} className="rounded-full bg-bg-card/80 px-3 py-1.5 text-xs font-bold text-tertiary">
                                    {option}
                                </span>
                            ))}
                        </div>
                    )}
                    {actionLabel && onAction && (
                        <ActionButton className="mt-4" size="sm" variant="tertiary" onClick={onAction}>
                            {actionLabel}
                        </ActionButton>
                    )}
                </div>
            </div>
        </article>
    );
}

