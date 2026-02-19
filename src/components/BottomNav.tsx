import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, LayoutGrid, Trophy, User } from 'lucide-react';

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/workout', icon: Dumbbell, label: 'Workout' },
    { to: '/templates', icon: LayoutGrid, label: 'Templates' },
    { to: '/challenges', icon: Trophy, label: 'Challenges' },
    { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong safe-bottom" id="bottom-nav">
            <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px] ${isActive
                                ? 'text-accent scale-105'
                                : 'text-text-muted hover:text-text-secondary'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                                <span className="text-[10px] font-medium leading-none">{label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
