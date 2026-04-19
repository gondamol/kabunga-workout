import { NavLink } from 'react-router-dom';
import { Home, Play, Dumbbell, User, MessagesSquare } from 'lucide-react';

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/workout', icon: Play, label: 'Workout' },
    { to: '/community', icon: MessagesSquare, label: 'Community' },
    { to: '/iron-protocol', icon: Dumbbell, label: 'Iron' },
    { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-white/95 backdrop-blur-xl safe-bottom"
            id="bottom-nav"
        >
            <div className="max-w-lg mx-auto flex items-center justify-around px-3 pt-3 pb-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `flex min-w-[58px] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all duration-200 ${isActive
                                ? 'bg-accent/8 text-accent'
                                : 'text-text-muted hover:text-text-secondary'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className="relative flex items-center justify-center">
                                    <Icon size={22} strokeWidth={isActive ? 2.3 : 1.9} />
                                    {isActive && (
                                        <span className="absolute -bottom-2 h-1.5 w-1.5 rounded-full bg-accent" />
                                    )}
                                </div>
                                <span className={`text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
