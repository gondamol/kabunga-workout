import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import type { UserProfile } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

type ResolveProfileLoadStateInput = {
    requestUserUid: string;
    activeUserUid: string | null | undefined;
    loadedProfile: UserProfile | null;
    currentProfile: UserProfile | null;
    fallbackProfile: UserProfile;
};

type ResolveProfileLoadState = (
    input: ResolveProfileLoadStateInput
) => {
    profile: UserProfile;
    profileLoaded: true;
} | null;

const buildProfile = (uid: string, displayName: string): UserProfile => ({
    uid,
    email: `${uid}@example.com`,
    displayName,
    photoURL: null,
    role: 'athlete',
    coachCode: null,
    onboarding: null,
    createdAt: 1,
    updatedAt: 1,
});

async function loadResolveProfileLoadState(): Promise<ResolveProfileLoadState> {
    const source = await readFile(new URL('../src/stores/authStore.ts', import.meta.url), 'utf8');
    const match = source.match(/export function resolveProfileLoadState[\s\S]*?\n}\n/);

    if (!match) {
        throw new Error('Could not find resolveProfileLoadState in src/stores/authStore.ts');
    }

    const compiled = ts.transpileModule(`${match[0]}\nexport default resolveProfileLoadState;`, {
        compilerOptions: {
            module: ts.ModuleKind.ES2020,
            target: ts.ScriptTarget.ES2020,
        },
    }).outputText;

    const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
    const module = await import(moduleUrl);
    return module.default as ResolveProfileLoadState;
}

export async function validateAuthStoreRaceGuard(): Promise<ValidationResult> {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const resolveProfileLoadState = await loadResolveProfileLoadState();

    const requestedUserProfile = buildProfile('user-a', 'Loaded Athlete');
    const existingRequestedProfile = buildProfile('user-a', 'Existing Athlete');
    const activeOtherProfile = buildProfile('user-b', 'Other Athlete');
    const fallbackRequestedProfile = buildProfile('user-a', 'Fallback Athlete');

    const logoutResult = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: null,
        loadedProfile: requestedUserProfile,
        currentProfile: existingRequestedProfile,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (logoutResult === null) {
        passed++;
    } else {
        failed++;
        errors.push('Expected stale profile load to be ignored after logout, but it still returned a store update.');
    }

    const accountSwitchResult = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: 'user-b',
        loadedProfile: requestedUserProfile,
        currentProfile: activeOtherProfile,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (accountSwitchResult === null) {
        passed++;
    } else {
        failed++;
        errors.push('Expected stale profile load to be ignored after an account switch, but it still returned a store update.');
    }

    const successfulLoadResult = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: 'user-a',
        loadedProfile: requestedUserProfile,
        currentProfile: existingRequestedProfile,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (successfulLoadResult?.profile.uid === 'user-a' && successfulLoadResult.profile.displayName === 'Loaded Athlete' && successfulLoadResult.profileLoaded) {
        passed++;
    } else {
        failed++;
        errors.push('Expected active profile load to apply the fetched user profile.');
    }

    const missingDocResult = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: 'user-a',
        loadedProfile: null,
        currentProfile: existingRequestedProfile,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (missingDocResult?.profile.displayName === 'Existing Athlete' && missingDocResult.profileLoaded) {
        passed++;
    } else {
        failed++;
        errors.push('Expected missing-doc profile load to preserve the current matching profile.');
    }

    return { passed, failed, errors };
}

const result = await validateAuthStoreRaceGuard();
console.log(`Auth Store Race Guard Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(`✗ ${error}`));
    process.exitCode = 1;
}
