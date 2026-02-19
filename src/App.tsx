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
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import OfflineBanner from './components/OfflineBanner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, initialized } = useAuthStore();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        // If Firebase Auth hasn't responded in 3 seconds, stop waiting
        const t = setTimeout(() => setTimedOut(true), 3000);
        return () => clearTimeout(t);
    }, []);

    if (!initialized && !timedOut) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-bg-primary">
                <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    const { user, initialized } = useAuthStore();
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

    const showBottomNav = initialized && user && !location.pathname.includes('/login') && !location.pathname.includes('/active-workout');

    return (
        <div className="flex flex-col min-h-screen bg-bg-primary">
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
                    <Route path="/profile" element={
                        <ProtectedRoute><ProfilePage /></ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>

            {showBottomNav && <BottomNav />}
            <InstallPrompt />
        </div>
    );
}
