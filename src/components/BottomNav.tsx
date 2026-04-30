import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    Home, ClipboardList, BarChart3, Users, User,
    Dumbbell, Apple, GraduationCap, Trophy, History, FlaskConical, X,
} from 'lucide-react';
import { cx } from './ui';

const navItems = [
    { to: '/', icon: Home, label: 'Today' },
    { to: '/workout', icon: ClipboardList, label: 'Plan' },
    { to: '/history', icon: BarChart3, label: 'Progress' },
    { to: '/community', icon: Users, label: 'Community' },
    { to: '/profile', icon: User, label: 'Profile' },
];

const moreItems = [
    { to: '/iron-protocol', icon: Dumbbell, label: 'Iron Protocol', description: 'PPL plan auto-loaded from your 1RM' },
    { to: '/coach', icon: GraduationCap, label: 'Coach Hub', description: 'Athletes & readiness summaries' },
    { to: '/nutrition', icon: Apple, label: 'Nutrition', description: 'Meals, water, macros' },
    { to: '/challenges', icon: Trophy, label: 'Challenges', description: 'Active competitions' },
    { to: '/history', icon: History, label: 'History', description: 'All sessions and PRs' },
    { to: '/science', icon: FlaskConical, label: 'Science', description: 'How Kabunga works' },
];

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);

    const handleMore = (to: string) => {
        setMoreOpen(false);
        navigate(to);
    };

    const isMoreActive = moreItems.some(item => location.pathname.startsWith(item.to)) && location.pathname !== '/';

    return (
        <>
            <nav
                className="fixed inset-x-0 bottom-0 z-50 safe-bottom"
                id="bottom-nav"
                aria-label="Primary navigation"
            >
                <div className="mx-auto max-w-lg px-3 pb-1">
                    <div className="grid grid-cols-6 gap-0.5 rounded-[1.75rem] border border-outline/60 bg-bg-card/95 p-2 shadow-lifted backdrop-blur-xl">
                        {navItems.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/'}
                                className={({ isActive }) =>
                                    cx(
                                        'touch-target pressable flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 transition-colors',
                                        isActive ? 'bg-primary text-text-inverse shadow-card' : 'text-text-muted hover:bg-surface-container hover:text-text-primary',
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
                                        <span className="truncate text-[10px] font-bold leading-none">{label}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                        <button
                            type="button"
                            onClick={() => setMoreOpen(true)}
                            className={cx(
                                'touch-target pressable flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 transition-colors',
                                isMoreActive ? 'bg-primary text-text-inverse shadow-card' : 'text-text-muted hover:bg-surface-container hover:text-text-primary',
                            )}
                            aria-label="More menu"
                        >
                            <div className="flex flex-col gap-[3px]" aria-hidden="true">
                                <span className="block h-[2.5px] w-5 rounded-full bg-current" />
                                <span className="block h-[2.5px] w-5 rounded-full bg-current" />
                                <span className="block h-[2.5px] w-5 rounded-full bg-current" />
                            </div>
                            <span className="truncate text-[10px] font-bold leading-none">More</span>
                        </button>
                    </div>
                </div>
            </nav>

            {moreOpen && (
                <div
                    className="fixed inset-0 z-[120] bg-black/50 flex items-end animate-fade-in"
                    onClick={() => setMoreOpen(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-card rounded-t-[2rem] px-5 pt-4 pb-8 max-h-[78vh] overflow-y-auto shadow-lifted"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-4" />
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-lg font-extrabold text-text-primary">More</h3>
                                <p className="text-xs text-text-muted mt-0.5">All Kabunga modules</p>
                            </div>
                            <button onClick={() => setMoreOpen(false)} className="p-2 rounded-full bg-bg-surface text-text-muted">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {moreItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.to}
                                        onClick={() => handleMore(item.to)}
                                        className="text-left rounded-2xl bg-bg-surface border border-border p-3.5 hover:border-primary/40 transition-colors"
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-primary mb-2.5">
                                            <Icon size={18} />
                                        </div>
                                        <p className="text-sm font-bold text-text-primary leading-tight">{item.label}</p>
                                        <p className="text-[11px] text-text-muted mt-1 leading-snug">{item.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
