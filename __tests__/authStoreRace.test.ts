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
    requestToken: number;
    activeRequestToken: number;
    outcome:
        | { status: 'found'; profile: UserProfile }
        | { status: 'missing' }
        | { status: 'error'; errorMessage: string };
    currentProfile: UserProfile | null;
    currentProfileLoaded: boolean;
    fallbackProfile: UserProfile;
};

type ResolveProfileLoadState = (
    input: ResolveProfileLoadStateInput
) => {
    profile: UserProfile | null;
    profileLoaded: boolean;
    profileLoadError: string | null;
} | null;

type InitialUserProfileWrite = {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    createdAt: number;
};

type BuildInitialUserProfileWrite = (input: {
    user: {
        uid: string;
        email: string | null;
        displayName: string | null;
        photoURL: string | null;
        metadata: {
            creationTime?: string | null;
        };
    };
    overrides?: Partial<InitialUserProfileWrite>;
}) => InitialUserProfileWrite;

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

async function loadNamedExport<T>(exportName: string): Promise<T> {
    const source = await readFile(new URL('../src/stores/authStore.ts', import.meta.url), 'utf8');
    const pattern = new RegExp(`export function ${exportName}[\\s\\S]*?\\n}\\n`);
    const match = source.match(pattern);

    if (!match) {
        throw new Error(`Could not find ${exportName} in src/stores/authStore.ts`);
    }

    const compiled = ts.transpileModule(`${match[0]}\nexport default ${exportName};`, {
        compilerOptions: {
            module: ts.ModuleKind.ES2020,
            target: ts.ScriptTarget.ES2020,
        },
    }).outputText;

    const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
    const module = await import(moduleUrl);
    return module.default as T;
}

export async function validateAuthStoreRaceGuard(): Promise<ValidationResult> {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const resolveProfileLoadState = await loadNamedExport<ResolveProfileLoadState>('resolveProfileLoadState');
    const buildInitialUserProfileWrite = await loadNamedExport<BuildInitialUserProfileWrite>('buildInitialUserProfileWrite');

    const requestedUserProfile = buildProfile('user-a', 'Loaded Athlete');
    const existingRequestedProfile = buildProfile('user-a', 'Existing Athlete');
    const activeOtherProfile = buildProfile('user-b', 'Other Athlete');
    const fallbackRequestedProfile = buildProfile('user-a', 'Fallback Athlete');

    const logoutResult = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: null,
        requestToken: 1,
        activeRequestToken: 1,
        outcome: { status: 'found', profile: requestedUserProfile },
        currentProfile: existingRequestedProfile,
        currentProfileLoaded: true,
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
        requestToken: 1,
        activeRequestToken: 1,
        outcome: { status: 'found', profile: requestedUserProfile },
        currentProfile: activeOtherProfile,
        currentProfileLoaded: true,
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
        requestToken: 1,
        activeRequestToken: 1,
        outcome: { status: 'found', profile: requestedUserProfile },
        currentProfile: existingRequestedProfile,
        currentProfileLoaded: true,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (
        successfulLoadResult?.profile?.uid === 'user-a' &&
        successfulLoadResult.profile.displayName === 'Loaded Athlete' &&
        successfulLoadResult.profileLoaded &&
        successfulLoadResult.profileLoadError === null
    ) {
        passed++;
    } else {
        failed++;
        errors.push('Expected active profile load to apply the fetched user profile.');
    }

    const missingDocResult = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: 'user-a',
        requestToken: 1,
        activeRequestToken: 1,
        outcome: { status: 'missing' },
        currentProfile: existingRequestedProfile,
        currentProfileLoaded: true,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (
        missingDocResult?.profile?.displayName === 'Fallback Athlete' &&
        missingDocResult.profileLoaded &&
        missingDocResult.profileLoadError === null
    ) {
        passed++;
    } else {
        failed++;
        errors.push('Expected confirmed missing-doc loads to use the fallback profile path.');
    }

    const readErrorWithoutCurrentProfile = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: 'user-a',
        requestToken: 1,
        activeRequestToken: 1,
        outcome: { status: 'error', errorMessage: 'network down' },
        currentProfile: null,
        currentProfileLoaded: false,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (
        readErrorWithoutCurrentProfile?.profile === null &&
        readErrorWithoutCurrentProfile.profileLoaded === false &&
        readErrorWithoutCurrentProfile.profileLoadError === 'network down'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('Expected read errors without an authoritative current profile to avoid fallback data and remain not-loaded.');
    }

    const readErrorWithCurrentProfile = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: 'user-a',
        requestToken: 1,
        activeRequestToken: 1,
        outcome: { status: 'error', errorMessage: 'temporary outage' },
        currentProfile: existingRequestedProfile,
        currentProfileLoaded: true,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (
        readErrorWithCurrentProfile?.profile?.displayName === 'Existing Athlete' &&
        readErrorWithCurrentProfile.profileLoaded === true &&
        readErrorWithCurrentProfile.profileLoadError === 'temporary outage'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('Expected read errors with an authoritative current profile to preserve that profile instead of synthesizing fallback data.');
    }

    const sameUidStaleRequestResult = resolveProfileLoadState({
        requestUserUid: 'user-a',
        activeUserUid: 'user-a',
        requestToken: 1,
        activeRequestToken: 2,
        outcome: { status: 'found', profile: requestedUserProfile },
        currentProfile: existingRequestedProfile,
        currentProfileLoaded: true,
        fallbackProfile: fallbackRequestedProfile,
    });
    if (sameUidStaleRequestResult === null) {
        passed++;
    } else {
        failed++;
        errors.push('Expected an older same-UID profile request to be ignored once a newer auth-session request is active.');
    }

    const initialUserProfileWrite = buildInitialUserProfileWrite({
        user: {
            uid: 'new-user',
            email: 'new-user@example.com',
            displayName: 'New Athlete',
            photoURL: 'https://example.com/avatar.png',
            metadata: {
                creationTime: '2026-04-20T10:00:00.000Z',
            },
        },
    });
    if (
        initialUserProfileWrite.uid === 'new-user' &&
        initialUserProfileWrite.email === 'new-user@example.com' &&
        initialUserProfileWrite.displayName === 'New Athlete' &&
        initialUserProfileWrite.photoURL === 'https://example.com/avatar.png' &&
        typeof initialUserProfileWrite.createdAt === 'number' &&
        !('role' in initialUserProfileWrite) &&
        !('coachCode' in initialUserProfileWrite) &&
        !('updatedAt' in initialUserProfileWrite) &&
        !('onboarding' in initialUserProfileWrite)
    ) {
        passed++;
    } else {
        failed++;
        errors.push('Expected the initial new-account user-doc seed to contain only stable core identity fields, plus createdAt, and omit onboarding defaults.');
    }

    return { passed, failed, errors };
}

const result = await validateAuthStoreRaceGuard();
console.log(`Auth Store Race Guard Validation: ${result.passed} passed, ${result.failed} failed`);
if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(`✗ ${error}`));
    process.exitCode = 1;
}
