import { useAuthStore } from '../stores/authStore';
import { formatDate } from '../lib/utils';
import toast from 'react-hot-toast';
import { User, LogOut, Shield, Smartphone, Moon, Bell, ChevronRight, Github } from 'lucide-react';

export default function ProfilePage() {
    const { user, profile, logout } = useAuthStore();

    const handleLogout = async () => {
        try {
            await logout();
            toast.success('Signed out');
        } catch {
            toast.error('Failed to sign out');
        }
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6">
            <h1 className="text-2xl font-bold animate-fade-in">Profile</h1>

            {/* Avatar & Info */}
            <div className="glass rounded-2xl p-6 flex items-center gap-4 animate-fade-in stagger-1">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-black shrink-0">
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

            {/* Settings */}
            <div className="space-y-1 animate-fade-in stagger-2">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">Settings</h3>

                <SettingRow icon={<Moon size={18} />} label="Dark Mode" sub="Always on">
                    <div className="w-10 h-6 rounded-full bg-accent flex items-center justify-end px-0.5">
                        <div className="w-5 h-5 rounded-full bg-white" />
                    </div>
                </SettingRow>

                <SettingRow icon={<Bell size={18} />} label="Notifications" sub="Reminder alerts" action>
                    <ChevronRight size={16} className="text-text-muted" />
                </SettingRow>

                <SettingRow icon={<Smartphone size={18} />} label="Install App" sub="Add to home screen" action onClick={() => {
                    toast('Look for the install banner at the top!', { icon: '📲' });
                }}>
                    <ChevronRight size={16} className="text-text-muted" />
                </SettingRow>
            </div>

            {/* About */}
            <div className="space-y-1 animate-fade-in stagger-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">About</h3>

                <SettingRow icon={<Shield size={18} />} label="Privacy" sub="Your data stays private">
                    <ChevronRight size={16} className="text-text-muted" />
                </SettingRow>

                <SettingRow icon={<Github size={18} />} label="Kabunga Workout" sub="v1.0.0 — Built with ❤️">
                    <span className="text-xs text-accent font-medium">PWA</span>
                </SettingRow>
            </div>

            {/* Logout */}
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
            className={`w-full glass rounded-xl p-4 flex items-center gap-3 ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
                }`}
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
