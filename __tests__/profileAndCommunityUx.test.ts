import {
    buildProfileUpdatePatch,
    getGoogleAuthErrorMessage,
} from '../src/lib/profileEditing.ts';
import { buildCommunityChallengeEntriesScope } from '../src/lib/communityChallengeQueries.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const pass = (result: ValidationResult) => {
    result.passed += 1;
};

const fail = (result: ValidationResult, message: string) => {
    result.failed += 1;
    result.errors.push(message);
};

export function validateProfileAndCommunityUx(): ValidationResult {
    const result: ValidationResult = { passed: 0, failed: 0, errors: [] };

    const patch = buildProfileUpdatePatch({
        displayName: '  Ada Kabunga  ',
        bio: '  Training for consistency.  ',
        bodyWeightKg: '',
    });
    if (
        patch.displayName === 'Ada Kabunga'
        && patch.bio === 'Training for consistency.'
        && patch.bodyWeightKg === null
        && !Object.values(patch).includes(undefined)
    ) {
        pass(result);
    } else {
        fail(result, 'Profile edit patch should trim text and clear body weight without undefined Firestore fields.');
    }

    const longBioPatch = buildProfileUpdatePatch({
        displayName: 'A',
        bio: 'x'.repeat(260),
        bodyWeightKg: 72.5,
    });
    if (longBioPatch.bio.length === 240 && longBioPatch.bodyWeightKg === 72.5) {
        pass(result);
    } else {
        fail(result, 'Profile edit patch should cap bio length and preserve valid body weight.');
    }

    const googleDomainMessage = getGoogleAuthErrorMessage({ code: 'auth/unauthorized-domain' });
    if (
        googleDomainMessage.includes('Firebase Auth')
        && googleDomainMessage.includes('Authorized domains')
    ) {
        pass(result);
    } else {
        fail(result, 'Google unauthorized-domain errors should explain the Firebase authorized-domain fix.');
    }

    const scope = buildCommunityChallengeEntriesScope({
        groupId: 'group-1',
        challengeId: 'challenge-1',
        maxResults: 120,
    });
    if (scope.groupId === 'group-1' && scope.challengeId === 'challenge-1' && scope.maxResults === 120) {
        pass(result);
    } else {
        fail(result, 'Community challenge entry scope should include group and challenge IDs.');
    }

    try {
        buildCommunityChallengeEntriesScope({ groupId: '', challengeId: 'challenge-1' });
        fail(result, 'Community challenge entry scope should reject a missing group ID.');
    } catch {
        pass(result);
    }

    return result;
}

const reportValidationResult = () => {
    const result = validateProfileAndCommunityUx();
    console.log(`Profile & Community UX Validation: ${result.passed} passed, ${result.failed} failed`);
    if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach((error) => console.error(error));
    } else {
        console.log('✓ All validations passed!');
    }
    return result;
};

if (typeof process !== 'undefined' && typeof window === 'undefined') {
    const result = reportValidationResult();
    if (result.failed > 0) process.exitCode = 1;
}
