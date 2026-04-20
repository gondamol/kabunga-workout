import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { processQueue } from './lib/offlineQueue';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkoutPage from './pages/WorkoutPage';
import ActiveWorkoutPage from './pages/ActiveWorkoutPage';
import TemplatesPage from './pages/TemplatesPage';
import ChallengesPage from './pages/ChallengesPage';
import NutritionPage from './pages/NutritionPage';
import ProfilePage from './pages/ProfilePage';
import IronProtocolPage from './pages/IronProtocolPage';
import HistoryPage from './pages/HistoryPage';
import SessionDetailPage from './pages/SessionDetailPage';
import CoachHubPage from './pages/CoachHubPage';
import CommunityPage from './pages/CommunityPage';
import SciencePage from './pages/SciencePage';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import UpdateBanner from './components/UpdateBanner';
import OnboardingPage from './pages/OnboardingPage';
import { isProfileSetupComplete } from './lib/profileSetup';
import { resolveOnboardingRedirect } from './lib/onboardingGate';

export function resolveProtectedRouteState({
    initialized,
    timedOut,
    hasUser,
    profileLoaded,
    profileLoadError,
}: {
    initialized: boolean;
    timedOut: boolean;
    hasUser: boolean;
    profileLoaded: boolean;
    profileLoadError: string | null;
}): 'auth-loading' | 'redirect-login' | 'profile-loading' | 'profile-error' | 'render' {
    if (!initialized && !timedOut) return 'auth-loading';
    if (!hasUser) return 'redirect-login';
    if (!profileLoaded) return profileLoadError ? 'profile-error' : 'profile-loading';
    return 'render';
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, initialized, profileLoaded, profileLoadError } = useAuthStore();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        // If Firebase Auth hasn't responded in 3 seconds, stop waiting
        const t = setTimeout(() => setTimedOut(true), 3000);
        return () => clearTimeout(t);
    }, []);

    const routeState = resolveProtectedRouteState({
        initialized,
        timedOut,
        hasUser: Boolean(user),
        profileLoaded,
        profileLoadError,
    });

    if (routeState === 'auth-loading' || routeState === 'profile-loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-bg-primary">
                <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (routeState === 'redirect-login') return <Navigate to="/login" replace />;

    if (routeState === 'profile-error') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
                <div className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-lg backdrop-blur">
                    <h1 className="text-lg font-semibold text-text-primary">We couldn&apos;t load your profile</h1>
                    <p className="mt-2 text-sm text-text-secondary">
                        Please refresh to try again. Your protected pages will stay paused until your account data is available.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-4 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

export default function App() {
    const { user, profile, initialized, profileLoaded } = useAuthStore();
    const location = useLocation();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); processQueue(); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Sync queue on app start
    useEffect(() => {
        if (isOnline && user) processQueue();
    }, [isOnline, user]);

    const onboardingRedirect = resolveOnboardingRedirect({
        pathname: location.pathname,
        isAuthenticated: Boolean(user),
        profileLoaded,
        isProfileComplete: isProfileSetupComplete(profile),
    });

    if (onboardingRedirect) {
        return <Navigate to={onboardingRedirect} replace />;
    }

    const showBottomNav = initialized &&
        user &&
        location.pathname !== '/login' &&
        location.pathname !== '/active-workout' &&
        location.pathname !== '/onboarding';

    return (
        <div className="flex flex-col min-h-screen bg-bg-primary">
            <UpdateBanner />
            <OfflineBanner isOnline={isOnline} />

            <main className={`flex-1 ${showBottomNav ? 'pb-20' : ''}`}>
                <Routes>
                    <Route path="/login" element={
                        initialized && user ? <Navigate to="/" replace /> : <LoginPage />
                    } />
                    <Route path="/" element={
                        <ProtectedRoute><DashboardPage /></ProtectedRoute>
                    } />
                    <Route path="/workout" element={
                        <ProtectedRoute><WorkoutPage /></ProtectedRoute>
                    } />
                    <Route path="/active-workout" element={
                        <ProtectedRoute><ActiveWorkoutPage /></ProtectedRoute>
                    } />
                    <Route path="/templates" element={
                        <ProtectedRoute><TemplatesPage /></ProtectedRoute>
                    } />
                    <Route path="/challenges" element={
                        <ProtectedRoute><ChallengesPage /></ProtectedRoute>
                    } />
                    <Route path="/nutrition" element={
                        <ProtectedRoute><NutritionPage /></ProtectedRoute>
                    } />
                    <Route path="/iron-protocol" element={
                        <ProtectedRoute><IronProtocolPage /></ProtectedRoute>
                    } />
                    <Route path="/history" element={
                        <ProtectedRoute><HistoryPage /></ProtectedRoute>
                    } />
                    <Route path="/history/:id" element={
                        <ProtectedRoute><SessionDetailPage /></ProtectedRoute>
                    } />
                    <Route path="/coach" element={
                        <ProtectedRoute><CoachHubPage /></ProtectedRoute>
                    } />
                    <Route path="/community" element={
                        <ProtectedRoute><CommunityPage /></ProtectedRoute>
                    } />
                    <Route path="/science" element={
                        <ProtectedRoute><SciencePage /></ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                        <ProtectedRoute><ProfilePage /></ProtectedRoute>
                    } />
                    <Route path="/onboarding" element={
                        <ProtectedRoute><OnboardingPage /></ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>

            {showBottomNav && <BottomNav />}
            <InstallPrompt />
        </div>
    );
}
