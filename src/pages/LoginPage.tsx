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
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-bg-primary relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute top-[-20%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-accent/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan/10 blur-3xl pointer-events-none" />

            <div className="w-full max-w-sm relative z-10 animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-primary mb-4 shadow-lg shadow-accent/30">
                        <Dumbbell size={36} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black gradient-text">Kabunga</h1>
                    <p className="text-text-secondary text-sm mt-1">Your pocket gym companion</p>
                </div>

                {/* Form */}
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
                                className="w-full bg-bg-input border border-border rounded-2xl py-4 px-12 text-text-primary placeholder:text-text-muted text-base focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
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
                            className="w-full bg-bg-input border border-border rounded-2xl py-4 px-12 text-text-primary placeholder:text-text-muted text-base focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
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
                            className="w-full bg-bg-input border border-border rounded-2xl py-4 px-12 text-text-primary placeholder:text-text-muted text-base focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted p-1"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <button
                        id="auth-submit"
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl gradient-primary text-white font-bold text-base active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Loading...
                            </span>
                        ) : (
                            isSignUp ? 'Create Account' : 'Sign In'
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-text-muted text-xs">or</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Google */}
                <button
                    id="google-signin"
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-bg-card border border-border text-text-primary font-semibold text-base active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 hover:bg-bg-card-hover"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                {/* Toggle */}
                <p className="text-center mt-6 text-text-secondary text-sm">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                        id="toggle-auth-mode"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-accent font-semibold hover:underline"
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </div>
        </div>
    );
}
