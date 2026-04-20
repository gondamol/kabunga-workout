import { readFile } from 'node:fs/promises';
import ts from 'typescript';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

type ResolveProtectedRouteState = (input: {
    initialized: boolean;
    timedOut: boolean;
    hasUser: boolean;
    profileLoaded: boolean;
    profileLoadError: string | null;
}) => 'auth-loading' | 'redirect-login' | 'profile-loading' | 'profile-error' | 'render';

async function loadResolveProtectedRouteState(): Promise<ResolveProtectedRouteState> {
    const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const match = source.match(/export function resolveProtectedRouteState[\s\S]*?\n}\n/);

    if (!match) {
        throw new Error('Could not find resolveProtectedRouteState in src/App.tsx');
    }

    const compiled = ts.transpileModule(`${match[0]}\nexport default resolveProtectedRouteState;`, {
        compilerOptions: {
            module: ts.ModuleKind.ES2020,
            target: ts.ScriptTarget.ES2020,
        },
    }).outputText;

    const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
    const module = await import(moduleUrl);
    return module.default as ResolveProtectedRouteState;
}

export async function validateProtectedRouteGate(): Promise<ValidationResult> {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const resolveProtectedRouteState = await loadResolveProtectedRouteState();

    const authLoading = resolveProtectedRouteState({
        initialized: false,
        timedOut: false,
        hasUser: false,
        profileLoaded: false,
        profileLoadError: null,
    });
    if (authLoading === 'auth-loading') {
        passed++;
    } else {
        failed++;
        errors.push(`Expected auth to keep loading before initialization timeout, got ${authLoading}`);
    }

    const redirectLogin = resolveProtectedRouteState({
        initialized: true,
        timedOut: false,
        hasUser: false,
        profileLoaded: false,
        profileLoadError: null,
    });
    if (redirectLogin === 'redirect-login') {
        passed++;
    } else {
        failed++;
        errors.push(`Expected logged-out access to redirect to login, got ${redirectLogin}`);
    }

    const profileLoading = resolveProtectedRouteState({
        initialized: true,
        timedOut: false,
        hasUser: true,
        profileLoaded: false,
        profileLoadError: null,
    });
    if (profileLoading === 'profile-loading') {
        passed++;
    } else {
        failed++;
        errors.push(`Expected authenticated users with an unresolved profile to stay behind a loading gate, got ${profileLoading}`);
    }

    const profileError = resolveProtectedRouteState({
        initialized: true,
        timedOut: false,
        hasUser: true,
        profileLoaded: false,
        profileLoadError: 'network down',
    });
    if (profileError === 'profile-error') {
        passed++;
    } else {
        failed++;
        errors.push(`Expected profile load errors to block protected pages behind an error gate, got ${profileError}`);
    }

    const render = resolveProtectedRouteState({
        initialized: true,
        timedOut: false,
        hasUser: true,
        profileLoaded: true,
        profileLoadError: null,
    });
    if (render === 'render') {
        passed++;
    } else {
        failed++;
        errors.push(`Expected fully loaded authenticated users to render protected pages, got ${render}`);
    }

    return { passed, failed, errors };
}

const result = await validateProtectedRouteGate();
console.log(`Protected Route Gate Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(`✗ ${error}`));
    process.exitCode = 1;
}
