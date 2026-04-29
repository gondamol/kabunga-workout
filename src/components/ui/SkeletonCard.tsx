import { cx } from './utils';

type SkeletonCardProps = {
    lines?: number;
    className?: string;
};

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
    return (
        <div className={cx('premium-card animate-pulse p-5', className)} aria-hidden="true">
            <div className="h-4 w-1/3 rounded-full bg-surface-container-high" />
            <div className="mt-4 h-8 w-2/3 rounded-2xl bg-surface-container-high" />
            <div className="mt-5 space-y-3">
                {Array.from({ length: lines }).map((_, index) => (
                    <div key={index} className="h-3 rounded-full bg-surface-container" style={{ width: `${88 - index * 13}%` }} />
                ))}
            </div>
        </div>
    );
}

