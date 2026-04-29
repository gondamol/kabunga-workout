import { NavLink } from 'react-router-dom';
import { Home, Play, Dumbbell, User, MessagesSquare } from 'lucide-react';
import { cx } from './ui';

const navItems = [
    { to: '/', icon: Home, label: 'Today' },
    { to: '/workout', icon: Play, label: 'Plan' },
    { to: '/community', icon: MessagesSquare, label: 'Circle' },
    { to: '/iron-protocol', icon: Dumbbell, label: 'Iron' },
    { to: '/profile', icon: User, label: 'You' },
];

export default function BottomNav() {
    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 safe-bottom"
            id="bottom-nav"
            aria-label="Primary navigation"
        >
            <div className="mx-auto max-w-lg px-3 pb-1">
                <div className="grid grid-cols-5 gap-1 rounded-[1.75rem] border border-outline/80 bg-bg-card/95 p-2 shadow-lifted backdrop-blur-xl">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            cx(
                                'touch-target pressable flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2',
                                isActive ? 'bg-primary text-text-inverse shadow-card' : 'text-text-muted hover:bg-surface-container hover:text-text-primary',
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className="relative flex items-center justify-center" aria-hidden="true">
                                    <Icon size={22} strokeWidth={isActive ? 2.3 : 1.9} />
                                </div>
                                <span className="truncate text-[10px] font-bold leading-none">{label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
                </div>
            </div>
        </nav>
    );
}
