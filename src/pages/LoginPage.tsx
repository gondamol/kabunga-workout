import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Dumbbell, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const { signIn, signUp, signInWithGoogle, loading } = useAuthStore();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isSignUp) {
                if (!name.trim()) { toast.error('Name is required'); return; }
                await signUp(email, password, name);
                toast.success('Welcome to Kabunga! 💪');
            } else {
                await signIn(email, password);
                toast.success('Welcome back! 🔥');
            }
        } catch (err: any) {
            const code = err?.code || '';
            const msg = code === 'auth/user-not-found' ? 'No account found. Please sign up first.'
                : code === 'auth/invalid-credential' ? 'Wrong email or password'
                    : code === 'auth/wrong-password' ? 'Wrong password'
                        : code === 'auth/email-already-in-use' ? 'Email already registered — try signing in'
                            : code === 'auth/weak-password' ? 'Password too weak (min 6 chars)'
                                : code === 'auth/invalid-email' ? 'Invalid email address'
                                    : code === 'auth/network-request-failed' ? 'Network error — check your connection'
                                        : `Error: ${code || err?.message || 'Unknown error'}`;
            toast.error(msg, { duration: 5000 });
            console.error('Auth error:', err);
        }
    };

    const handleGoogle = async () => {
        try {
            await signInWithGoogle();
            toast.success('Welcome! 💪');
        } catch (err: any) {
            if (err?.code !== 'auth/popup-closed-by-user') {
                toast.error(`Google error: ${err?.code || err?.message || 'Unknown'}`, { duration: 6000 });
                console.error('Google auth error:', err);
            }
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden shell-aurora px-6 py-12">
            <div className="pointer-events-none absolute right-[-18%] top-[-10%] h-[52vw] w-[52vw] rounded-full bg-cyan/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-14%] left-[-12%] h-[42vw] w-[42vw] rounded-full bg-accent/10 blur-3xl" />

            <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-sm items-center">
                <div className="premium-hero-card w-full p-6 shadow-[0_28px_72px_rgba(23,33,25,0.10)] animate-fade-in">
                    <div className="mb-8">
                        <div className="mb-4 inline-flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-accent/10 text-accent shadow-[0_14px_32px_rgba(30,88,50,0.12)]">
                            <Dumbbell size={34} />
                        </div>
                        <div className="mb-4 flex flex-wrap gap-2">
                            <span className="floating-stat-chip text-[11px] font-semibold text-text-primary">Today&apos;s plan</span>
                            <span className="floating-stat-chip text-[11px] font-semibold text-text-primary">Progress</span>
                            <span className="floating-stat-chip text-[11px] font-semibold text-text-primary">Circle</span>
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Performance-first training</p>
                        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">Kabunga</h1>
                        <p className="mt-2 text-sm text-text-secondary">
                            Serious workout tracking, clearer progress, and accountability when you want it.
                        </p>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="soft-panel px-3 py-3 text-center">
                                <p className="text-[10px] uppercase tracking-wide text-text-muted">Focus</p>
                                <p className="mt-1 text-sm font-bold text-text-primary">Goal-led</p>
                            </div>
                            <div className="soft-panel px-3 py-3 text-center">
                                <p className="text-[10px] uppercase tracking-wide text-text-muted">Flow</p>
                                <p className="mt-1 text-sm font-bold text-text-primary">Fast start</p>
                            </div>
                            <div className="soft-panel px-3 py-3 text-center">
                                <p className="text-[10px] uppercase tracking-wide text-text-muted">Support</p>
                                <p className="mt-1 text-sm font-bold text-text-primary">Readiness</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div className="relative animate-fade-in">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    id="name-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    className="w-full rounded-2xl border border-border bg-bg-input py-4 px-12 text-base text-text-primary placeholder:text-text-muted focus:border-accent/35 focus:outline-none focus:ring-2 focus:ring-accent/10 transition-all"
                                />
                            </div>
                        )}

                        <div className="relative">
                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                id="email-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                                required
                                className="w-full rounded-2xl border border-border bg-bg-input py-4 px-12 text-base text-text-primary placeholder:text-text-muted focus:border-accent/35 focus:outline-none focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                        </div>

                        <div className="relative">
                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                id="password-input"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                minLength={6}
                                className="w-full rounded-2xl border border-border bg-bg-input py-4 px-12 text-base text-text-primary placeholder:text-text-muted focus:border-accent/35 focus:outline-none focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-text-muted"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <button
                            id="auth-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-2xl gradient-primary py-4 text-base font-bold text-white shadow-lg shadow-accent/15 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    Loading...
                                </span>
                            ) : (
                                isSignUp ? 'Create account' : 'Sign in'
                            )}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-text-muted">or</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    <button
                        id="google-signin"
                        onClick={handleGoogle}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white py-4 text-base font-semibold text-text-primary transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-bg-card-hover"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>

                    <p className="mt-6 text-center text-sm text-text-secondary">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            id="toggle-auth-mode"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="font-semibold text-accent hover:underline"
                        >
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </button>
                    </p>

                    <div className="mt-5 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-green" />
                        Train
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                        Track
                        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                        Recover
                    </div>
                </div>
            </div>
        </div>
    );
}
