import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { cx } from './utils';

type BottomSheetProps = {
    open: boolean;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
    className?: string;
};

export function BottomSheet({ open, title, description, children, footer, onClose, className }: BottomSheetProps) {
    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 px-3 pb-3 backdrop-blur-sm" role="presentation" onClick={onClose}>
            <section
                className={cx('safe-bottom w-full max-w-lg rounded-[2rem] border border-outline bg-bg-card p-5 shadow-lifted animate-slide-up', className)}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : 'Bottom sheet'}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface-container-high" />
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-xl font-extrabold text-text-primary">{title}</h2>
                        {description && <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>}
                    </div>
                    <ActionButton aria-label="Close sheet" size="icon" variant="ghost" onClick={onClose} icon={<X size={20} />} />
                </div>
                <div className="mt-5">{children}</div>
                {footer && <div className="mt-5">{footer}</div>}
            </section>
        </div>
    );
}

