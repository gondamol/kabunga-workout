import { resolveOnboardingRedirect } from '../src/lib/onboardingGate.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

export function validateOnboardingGate(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const redirectForIncomplete = resolveOnboardingRedirect({
        pathname: '/',
        isAuthenticated: true,
        profileLoaded: true,
        isProfileComplete: false,
    });
    if (redirectForIncomplete === '/onboarding') {
        passed++;
    } else {
        failed++;
        errors.push(`Expected incomplete profile to redirect to /onboarding, got ${redirectForIncomplete}`);
    }

    const redirectForComplete = resolveOnboardingRedirect({
        pathname: '/onboarding',
        isAuthenticated: true,
        profileLoaded: true,
        isProfileComplete: true,
    });
    if (redirectForComplete === '/') {
        passed++;
    } else {
        failed++;
        errors.push(`Expected complete profile to leave /onboarding, got ${redirectForComplete}`);
    }

    const noRedirectWhileLoading = resolveOnboardingRedirect({
        pathname: '/',
        isAuthenticated: true,
        profileLoaded: false,
        isProfileComplete: false,
    });
    if (noRedirectWhileLoading === null) {
        passed++;
    } else {
        failed++;
        errors.push(`Expected no redirect while profile is loading, got ${noRedirectWhileLoading}`);
    }

    const noRedirectWhenLoggedOut = resolveOnboardingRedirect({
        pathname: '/',
        isAuthenticated: false,
        profileLoaded: true,
        isProfileComplete: false,
    });
    if (noRedirectWhenLoggedOut === null) {
        passed++;
    } else {
        failed++;
        errors.push(`Expected unauthenticated users to receive no redirect, got ${noRedirectWhenLoggedOut}`);
    }

    return { passed, failed, errors };
}

const result = validateOnboardingGate();
console.log(`Onboarding Gate Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(`✗ ${error}`));
    process.exitCode = 1;
}
