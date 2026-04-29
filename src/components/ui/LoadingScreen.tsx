import { Dumbbell } from 'lucide-react';
import { cx } from './utils';

type LoadingScreenProps = {
    label?: string;
    className?: string;
};

export function LoadingScreen({ label = 'Loading Kabunga', className }: LoadingScreenProps) {
    return (
        <div className={cx('flex min-h-[60dvh] items-center justify-center px-6 text-center', className)} role="status" aria-live="polite">
            <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-primary text-text-inverse shadow-soft">
                    <Dumbbell size={28} aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-bold text-text-primary">{label}</p>
                <div className="mx-auto mt-4 h-2 w-28 overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-secondary" />
                </div>
            </div>
        </div>
    );
}

