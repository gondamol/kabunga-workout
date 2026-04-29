import type { ReactNode } from 'react';
import { cx } from './utils';

type AppShellProps = {
    children: ReactNode;
    className?: string;
    width?: 'mobile' | 'wide';
};

export function AppShell({ children, className, width = 'mobile' }: AppShellProps) {
    return (
        <main className={cx('min-h-dvh pb-28 safe-top', className)}>
            <div className={cx('mx-auto w-full px-4 py-5 sm:px-6', width === 'mobile' ? 'max-w-lg' : 'max-w-6xl')}>{children}</div>
        </main>
    );
}

