import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cx } from './utils';

type CoachCardProps = {
    title: ReactNode;
    description?: ReactNode;
    badge?: ReactNode;
    action?: ReactNode;
    privacyNote?: ReactNode;
    className?: string;
};

export function CoachCard({ title, description, badge, action, privacyNote, className }: CoachCardProps) {
    return (
        <article className={cx('premium-card p-5', className)}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    {badge && <div className="mb-3 inline-flex rounded-full bg-tertiary-container px-3 py-1 text-xs font-bold text-tertiary">{badge}</div>}
                    <h3 className="text-lg font-extrabold text-text-primary">{title}</h3>
                    {description && <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>}
                </div>
                {action}
            </div>
            {privacyNote && (
                <div className="mt-4 flex gap-3 rounded-2xl bg-tertiary-container p-3 text-sm leading-5 text-tertiary">
                    <ShieldCheck size={18} className="shrink-0" aria-hidden="true" />
                    <span>{privacyNote}</span>
                </div>
            )}
        </article>
    );
}

