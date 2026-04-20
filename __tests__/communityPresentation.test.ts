import {
    buildCommunityCreationConfig,
    buildCommunityInviteShareMessage,
    buildCommunityLandingEmptyState,
} from '../src/lib/communityPresentation.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

export function validateCommunityPresentation(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const athleteConfig = buildCommunityCreationConfig('athlete');
    if (
        athleteConfig.title === 'Create Training Circle'
        && athleteConfig.ctaLabel === 'Create Circle'
        && athleteConfig.defaultKind === 'mixed'
        && athleteConfig.kindOptions.every((option) => option.value !== 'coach')
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Athlete creation config was wrong: ${JSON.stringify(athleteConfig)}`);
    }

    const coachConfig = buildCommunityCreationConfig('coach');
    if (
        coachConfig.title === 'Create Coach Group'
        && coachConfig.ctaLabel === 'Create Group'
        && coachConfig.defaultKind === 'coach'
        && coachConfig.kindOptions.some((option) => option.value === 'coach')
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Coach creation config was wrong: ${JSON.stringify(coachConfig)}`);
    }

    const inviteMessage = buildCommunityInviteShareMessage({
        groupName: 'Kabunga Morning Crew',
        inviteCode: 'KBG9A7X2',
        ownerName: 'Aurel',
    });
    if (
        inviteMessage.includes('Kabunga Morning Crew')
        && inviteMessage.includes('KBG9A7X2')
        && inviteMessage.includes('Aurel')
        && inviteMessage.includes('Kabunga Workout')
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Invite share message was wrong: ${inviteMessage}`);
    }

    const landingEmptyState = buildCommunityLandingEmptyState({
        hasGroups: false,
        supportMode: 'with_friends',
    });

    if (
        landingEmptyState.title === 'Create your training circle'
        && landingEmptyState.ctaLabel === 'Create or join a circle'
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Community landing empty state was wrong: ${JSON.stringify(landingEmptyState)}`);
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateCommunityPresentation();
    console.log(`Community Presentation Validation: ${result.passed} passed, ${result.failed} failed`);
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
