import type { UserProfile } from './types';

export class ProfileEditValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProfileEditValidationError';
    }
}

type ProfileEditInput = {
    displayName: string;
    bio: string;
    bodyWeightKg: number | string | '';
};

export type ProfileUpdatePatch = {
    displayName: UserProfile['displayName'];
    bio: NonNullable<UserProfile['bio']>;
    bodyWeightKg: number | null;
};

export const buildProfileUpdatePatch = ({
    displayName,
    bio,
    bodyWeightKg,
}: ProfileEditInput): ProfileUpdatePatch => {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 1) {
        throw new ProfileEditValidationError('Name cannot be empty');
    }
    if (trimmedName.length > 60) {
        throw new ProfileEditValidationError('Name must be 60 characters or fewer');
    }

    const trimmedBio = bio.trim().slice(0, 240);
    const parsedWeight = bodyWeightKg === '' ? null : Number(bodyWeightKg);
    if (parsedWeight !== null && (Number.isNaN(parsedWeight) || parsedWeight < 0 || parsedWeight > 400)) {
        throw new ProfileEditValidationError('Body weight should be between 0 and 400 kg');
    }

    return {
        displayName: trimmedName,
        bio: trimmedBio,
        bodyWeightKg: parsedWeight,
    };
};

export const getGoogleAuthErrorMessage = (error: unknown): string => {
    const candidate = error as { code?: string; message?: string } | null;
    const code = candidate?.code || '';

    if (code === 'auth/unauthorized-domain' || code === 'auth/authorized-domain') {
        return 'Google sign-in is blocked for this app domain. Add the deployed domain in Firebase Auth > Settings > Authorized domains, then sign in again.';
    }
    if (code === 'auth/popup-blocked') {
        return 'Google sign-in popup was blocked. Allow popups for this site, or open Kabunga in your browser and try again.';
    }
    if (code === 'auth/network-request-failed') {
        return 'Google sign-in needs a connection. Check your internet and try again.';
    }
    return `Google error: ${code || candidate?.message || 'Unknown'}`;
};
