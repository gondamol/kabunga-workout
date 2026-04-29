import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { processQueue } from './lib/offlineQueue';

import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import UpdateBanner from './components/UpdateBanner';
import { isProfileSetupComplete } from './lib/profileSetup';
import { resolveOnboardingRedirect } from './lib/onboardingGate';
import { ErrorState, LoadingScreen } from './components/ui';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
const ActiveWorkoutPage = lazy(() => import('./pages/ActiveWorkoutPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const ChallengesPage = lazy(() => import('./pages/ChallengesPage'));
const NutritionPage = lazy(() => import('./pages/NutritionPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const IronProtocolPage = lazy(() => import('./pages/IronProtocolPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage'));
const CoachHubPage = lazy(() => import('./pages/CoachHubPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const SciencePage = lazy(() => import('./pages/SciencePage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

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
        return <LoadingScreen label={routeState === 'auth-loading' ? 'Checking session' : 'Loading your profile'} className="min-h-screen bg-bg-primary" />;
    }

    if (routeState === 'redirect-login') return <Navigate to="/login" replace />;

    if (routeState === 'profile-error') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
                <ErrorState
                    title="We couldn't load your profile"
                    description="Please refresh to try again. Protected pages stay paused until account data is available."
                    retryLabel="Refresh"
                    onRetry={() => window.location.reload()}
                    isOffline={typeof navigator !== 'undefined' && !navigator.onLine}
                />
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
                <Suspense fallback={<LoadingScreen label="Loading page" />}>
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
                </Suspense>
            </main>

            {showBottomNav && <BottomNav />}
            <InstallPrompt />
        </div>
    );
}
