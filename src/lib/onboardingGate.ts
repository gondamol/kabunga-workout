type ResolveOnboardingRedirectInput = {
    pathname: string;
    isAuthenticated: boolean;
    profileLoaded: boolean;
    isProfileComplete: boolean;
};

export const resolveOnboardingRedirect = ({
    pathname,
    isAuthenticated,
    profileLoaded,
    isProfileComplete,
}: ResolveOnboardingRedirectInput): string | null => {
    if (!isAuthenticated || !profileLoaded) return null;
    if (!isProfileComplete && pathname !== '/onboarding') return '/onboarding';
    if (isProfileComplete && pathname === '/onboarding') return '/';
    return null;
};
