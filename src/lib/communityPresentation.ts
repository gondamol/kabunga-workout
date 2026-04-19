import type { CommunityGroupKind, UserRole } from './types';

export interface CommunityKindOption {
    value: CommunityGroupKind;
    label: string;
}

export interface CommunityCreationConfig {
    title: string;
    description: string;
    ctaLabel: string;
    defaultKind: CommunityGroupKind;
    namePlaceholder: string;
    descriptionPlaceholder: string;
    kindOptions: CommunityKindOption[];
}

const ATHLETE_KIND_OPTIONS: CommunityKindOption[] = [
    { value: 'mixed', label: 'Training Circle' },
    { value: 'women', label: 'Women' },
    { value: 'men', label: 'Men' },
];

const COACH_KIND_OPTIONS: CommunityKindOption[] = [
    { value: 'coach', label: 'Coach Group' },
    { value: 'women', label: 'Women' },
    { value: 'men', label: 'Men' },
    { value: 'mixed', label: 'Mixed' },
];

export const buildCommunityCreationConfig = (role: UserRole): CommunityCreationConfig => {
    if (role === 'coach') {
        return {
            title: 'Create Coach Group',
            description: 'Build a private group for selected athletes, or make it public for wider community.',
            ctaLabel: 'Create Group',
            defaultKind: 'coach',
            namePlaceholder: 'Amollo Strength Circle',
            descriptionPlaceholder: 'Weekly check-ins, accountability, and session prep',
            kindOptions: COACH_KIND_OPTIONS,
        };
    }

    return {
        title: 'Create Training Circle',
        description: 'Start a private group for gym friends, training partners, or your lifting crew.',
        ctaLabel: 'Create Circle',
        defaultKind: 'mixed',
        namePlaceholder: 'Kabunga Morning Crew',
        descriptionPlaceholder: 'Saturday lift club, accountability, and session recaps',
        kindOptions: ATHLETE_KIND_OPTIONS,
    };
};

export const buildCommunityInviteShareMessage = ({
    groupName,
    inviteCode,
    ownerName,
}: {
    groupName: string;
    inviteCode: string;
    ownerName: string;
}): string => {
    return [
        `${ownerName} invited you to join "${groupName}" on Kabunga Workout.`,
        `Open the Community tab and enter invite code ${inviteCode} to join.`,
        'Track sessions together, compare progress, and keep each other accountable.',
    ].join('\n');
};
