import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Bell,
    ChevronRight,
    FlaskConical,
    Github,
    LogOut,
    Moon,
    Shield,
    Smartphone,
    Users,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { formatDate } from '../lib/utils';
import { getOneRepMaxes, getUserWorkouts, saveOneRepMaxes, updateUserProfile } from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import type { OneRepMaxes, WorkoutSession } from '../lib/types';
import { normalizeOneRepMaxes } from '../lib/ironProtocol';
import { getOneRepMaxPromptStatus } from '../lib/oneRepMaxes';
import OneRepMaxCard from '../components/OneRepMaxCard';

const ONE_REP_MAX_FOCUS_PARAM = 'one-rep-maxes';

export default function ProfilePage() {
    const { user, profile, logout } = useAuthStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const oneRepMaxSectionRef = useRef<HTMLDivElement | null>(null);

    const [savedOneRepMaxes, setSavedOneRepMaxes] = useState<OneRepMaxes | null>(null);
    const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxes | null>(null);
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [savingMaxes, setSavingMaxes] = useState(false);
    const [highlightOneRepMaxes, setHighlightOneRepMaxes] = useState(false);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;

        setOneRepMaxes((current) => current ?? normalizeOneRepMaxes(user.uid, null));

        const loadProfileData = async () => {
            try {
                const [maxes, workoutHistory] = await Promise.all([
                    getOneRepMaxes(user.uid),
                    getUserWorkouts(user.uid, 120),
                ]);
                if (cancelled) return;

                setSavedOneRepMaxes(maxes);
                setOneRepMaxes(normalizeOneRepMaxes(user.uid, maxes));
                setWorkouts(workoutHistory);
            } catch (error) {
                console.warn('Failed to load profile performance data:', error);
                if (cancelled) return;
                setSavedOneRepMaxes(null);
                setOneRepMaxes(normalizeOneRepMaxes(user.uid, null));
            }
        };

        void loadProfileData();

        return () => {
            cancelled = true;
        };
    }, [user]);

    useEffect(() => {
        if (searchParams.get('focus') !== ONE_REP_MAX_FOCUS_PARAM) return;
        const node = oneRepMaxSectionRef.current;
        if (!node) return;

        setHighlightOneRepMaxes(true);
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const timeout = window.setTimeout(() => setHighlightOneRepMaxes(false), 2200);
        return () => window.clearTimeout(timeout);
    }, [searchParams]);

    const promptStatus = useMemo(() => {
        return getOneRepMaxPromptStatus(savedOneRepMaxes, workouts, profile);
    }, [profile, savedOneRepMaxes, workouts]);

    const handleLogout = async () => {
        try {
            await logout();
            toast.success('Signed out');
        } catch {
            toast.error('Failed to sign out');
        }
    };

    const updateMax = (key: keyof Omit<OneRepMaxes, 'userId' | 'updatedAt'>, value: number) => {
        setOneRepMaxes((current) => {
            if (!current) return current;
            return { ...current, [key]: Math.max(0, value) };
        });
    };

    const handleSaveOneRepMaxes = async () => {
        if (!user || !oneRepMaxes) return;

        setSavingMaxes(true);
        const payload: OneRepMaxes = {
            ...oneRepMaxes,
            userId: user.uid,
            updatedAt: Date.now(),
        };

        setSavedOneRepMaxes(payload);
        setOneRepMaxes(payload);
        useAuthStore.setState((state) => {
            if (!state.profile) return state;
            return {
                ...state,
                profile: {
                    ...state.profile,
                    oneRepMaxPromptSnoozeUntil: null,
                    oneRepMaxPromptLastShownAt: Date.now(),
                },
            };
        });

        try {
            await saveOneRepMaxes(user.uid, payload);
            await updateUserProfile(user.uid, {
                oneRepMaxPromptSnoozeUntil: null,
                oneRepMaxPromptLastShownAt: Date.now(),
            });
            toast.success('1RMs updated');
        } catch (error) {
            await enqueueAction({
                type: 'oneRepMaxes',
                action: 'update',
                data: { uid: user.uid, maxes: payload },
            });
            void updateUserProfile(user.uid, {
                oneRepMaxPromptSnoozeUntil: null,
                oneRepMaxPromptLastShownAt: Date.now(),
            }).catch((profileError) => {
                console.warn('Failed to clear 1RM prompt snooze:', profileError);
            });
            toast('Saved offline - will sync when online', { icon: '📴' });
            console.warn('Failed to save 1RMs:', error);
        } finally {
            setSavingMaxes(false);
        }
    };

    return (
        <div className="shell-page pt-6 pb-4 space-y-6">
            <div className="animate-fade-in">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Account</p>
                <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Profile</h1>
            </div>

            <div className="glass rounded-2xl p-6 flex items-center gap-4 animate-fade-in stagger-1">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center text-2xl font-black shrink-0 overflow-hidden">
                    {profile?.photoURL ? (
                        <img src={profile.photoURL} alt="" className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                        (profile?.displayName?.[0] || 'K').toUpperCase()
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-lg truncate">{profile?.displayName || 'Athlete'}</h2>
                    <p className="text-sm text-text-secondary truncate">{user?.email}</p>
                    <p className="text-xs text-text-muted mt-1">
                        Joined {profile?.createdAt ? formatDate(profile.createdAt) : 'recently'}
                    </p>
                </div>
            </div>

            {oneRepMaxes && (
                <div
                    ref={oneRepMaxSectionRef}
                    className={`animate-fade-in stagger-2 rounded-[22px] transition-all ${highlightOneRepMaxes ? 'ring-2 ring-amber/60 ring-offset-2 ring-offset-bg-primary' : ''}`}
                >
                    <OneRepMaxCard
                        title="Performance / 1RM"
                        subtitle="Keep these current so Iron sessions scale to your actual strength."
                        maxes={oneRepMaxes}
                        status={promptStatus}
                        saving={savingMaxes}
                        onChange={updateMax}
                        onSave={handleSaveOneRepMaxes}
                    />
                </div>
            )}

            <div className="space-y-1 animate-fade-in stagger-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">Settings</h3>

                <SettingRow icon={<Moon size={18} />} label="Dark Mode" sub="Always on">
                    <div className="w-10 h-6 rounded-full bg-accent flex items-center justify-end px-0.5">
                        <div className="w-5 h-5 rounded-full bg-white" />
                    </div>
                </SettingRow>

                <SettingRow icon={<Bell size={18} />} label="Notifications" sub="Reminder alerts" action>
                    <ChevronRight size={16} className="text-text-muted" />
                </SettingRow>

                <SettingRow
                    icon={<Smartphone size={18} />}
                    label="Install App"
                    sub="Add to home screen"
                    action
                    onClick={() => {
                        toast('Look for the install banner at the top!', { icon: '📲' });
                    }}
                >
                    <ChevronRight size={16} className="text-text-muted" />
                </SettingRow>

                <SettingRow
                    icon={<Users size={18} />}
                    label="Coaching & Athletes"
                    sub={profile?.role === 'coach' ? 'Manage athletes and plans' : 'Connect with your coach'}
                    action
                    onClick={() => navigate('/coach')}
                >
                    {profile?.role === 'coach' ? (
                        <span className="text-[11px] font-semibold text-accent">Coach mode</span>
                    ) : (
                        <ChevronRight size={16} className="text-text-muted" />
                    )}
                </SettingRow>

                <SettingRow
                    icon={<FlaskConical size={18} />}
                    label="Training Science"
                    sub="Evidence behind Kabunga plans"
                    action
                    onClick={() => navigate('/science')}
                >
                    <ChevronRight size={16} className="text-text-muted" />
                </SettingRow>
            </div>

            <div className="space-y-1 animate-fade-in stagger-4">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">About</h3>

                <SettingRow icon={<Shield size={18} />} label="Privacy" sub="Your data stays private">
                    <ChevronRight size={16} className="text-text-muted" />
                </SettingRow>

                <SettingRow icon={<Github size={18} />} label="Kabunga Workout" sub="v1.0.0 - Built for training">
                    <span className="text-xs text-accent font-medium">PWA</span>
                </SettingRow>
            </div>

            <button
                id="logout-btn"
                onClick={handleLogout}
                className="w-full py-4 rounded-2xl bg-red/10 border border-red/20 text-red font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform animate-fade-in stagger-4"
            >
                <LogOut size={18} />
                Sign Out
            </button>
        </div>
    );
}

function SettingRow({
    icon,
    label,
    sub,
    children,
    action,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    sub: string;
    children?: React.ReactNode;
    action?: boolean;
    onClick?: () => void;
}) {
    const Wrapper = onClick || action ? 'button' : 'div';
    return (
        <Wrapper
            onClick={onClick}
            className={`w-full glass rounded-xl p-4 flex items-center gap-3 ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
        >
            <span className="text-text-muted">{icon}</span>
            <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-text-muted">{sub}</p>
            </div>
            {children}
        </Wrapper>
    );
}
