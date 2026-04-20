import { create } from 'zustand';
import {
    User, onAuthStateChanged,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, GoogleAuthProvider, signOut, updateProfile, getAdditionalUserInfo,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DEFAULT_USER_ONBOARDING } from '../lib/profileSetup';
import type { UserProfile } from '../lib/types';

interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    profileLoaded: boolean;
    profileLoadError: string | null;
    loading: boolean;
    initialized: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

export function resolveProfileLoadState({
    requestUserUid,
    activeUserUid,
    requestToken,
    activeRequestToken,
    outcome,
    currentProfile,
    currentProfileLoaded,
    fallbackProfile,
}: {
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
}): { profile: UserProfile | null; profileLoaded: boolean; profileLoadError: string | null } | null {
    if (activeUserUid !== requestUserUid || requestToken !== activeRequestToken) {
        return null;
    }

    if (outcome.status === 'found') {
        return {
            profile: outcome.profile,
            profileLoaded: true,
            profileLoadError: null,
        };
    }

    if (outcome.status === 'missing') {
        return {
            profile: fallbackProfile,
            profileLoaded: true,
            profileLoadError: null,
        };
    }

    const hasCurrentProfile = currentProfileLoaded && currentProfile?.uid === requestUserUid;

    return {
        profile: hasCurrentProfile ? currentProfile : null,
        profileLoaded: Boolean(hasCurrentProfile),
        profileLoadError: outcome.errorMessage,
    };
}

export function buildInitialUserProfileWrite({
    user,
    overrides = {},
}: {
    user: {
        uid: string;
        email: string | null;
        displayName: string | null;
        photoURL: string | null;
        metadata: {
            creationTime?: string | null;
        };
    };
    overrides?: Partial<{
        uid: string;
        email: string;
        displayName: string;
        photoURL: string | null;
        createdAt: number;
    }>;
}): {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    createdAt: number;
} {
    const parsedCreationTime = user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : NaN;
    const createdAt = overrides.createdAt ?? (Number.isFinite(parsedCreationTime) ? parsedCreationTime : Date.now());

    return {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName || 'Athlete',
        photoURL: user.photoURL,
        createdAt,
        ...overrides,
    };
}

const parseAuthTimestamp = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const buildFallbackProfile = (
    user: User,
    overrides: Partial<UserProfile> = {}
): UserProfile => {
    const createdAt = overrides.createdAt ?? parseAuthTimestamp(user.metadata.creationTime) ?? Date.now();
    const updatedAt = overrides.updatedAt ?? Date.now();

    return {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName || 'Athlete',
        photoURL: user.photoURL,
        role: 'athlete',
        coachCode: null,
        onboarding: DEFAULT_USER_ONBOARDING,
        createdAt,
        updatedAt,
        ...overrides,
    };
};

let activeProfileLoadRequestToken = 0;

const beginProfileLoadRequest = (): number => {
    activeProfileLoadRequestToken += 1;
    return activeProfileLoadRequestToken;
};

const persistInitialUserProfileWrite = (
    user: User,
    overrides: Partial<ReturnType<typeof buildInitialUserProfileWrite>> = {}
): void => {
    const payload = buildInitialUserProfileWrite({ user, overrides });

    void setDoc(doc(db, 'users', user.uid), payload, { merge: true })
        .catch((err) => {
            console.warn('Could not seed initial user profile:', err?.message ?? err);
        });
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
    profileLoaded: false,
    profileLoadError: null,
    loading: false,
    initialized: false,

    signIn: async (email, password) => {
        set({ loading: true });
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle setting user state
        } finally {
            set({ loading: false });
        }
    },

    signUp: async (email, password, name) => {
        set({ loading: true });
        try {
            // Step 1: Create the Firebase Auth account (fast)
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: name });

            const now = Date.now();
            const profile = buildFallbackProfile(cred.user, {
                displayName: name,
                photoURL: null,
                createdAt: now,
                updatedAt: now,
            });

            // Step 2: Set user immediately so the app navigates right away
            set({ user: cred.user, profile, profileLoaded: true, profileLoadError: null, loading: false });
            persistInitialUserProfileWrite(cred.user, {
                displayName: name,
                photoURL: null,
                createdAt: now,
            });
        } catch (err) {
            set({ loading: false });
            throw err;
        }
    },

    signInWithGoogle: async () => {
        set({ loading: true });
        try {
            const provider = new GoogleAuthProvider();
            const cred = await signInWithPopup(auth, provider);
            const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;

            const profile = buildFallbackProfile(cred.user, {
                displayName: cred.user.displayName || 'User',
                photoURL: cred.user.photoURL,
            });

            if (isNewUser) {
                // New Google users can onboard immediately using the optimistic local profile.
                // We intentionally do not persist this incomplete onboarding state here.
                set({ user: cred.user, profile, profileLoaded: true, profileLoadError: null, loading: false });
                persistInitialUserProfileWrite(cred.user, {
                    displayName: cred.user.displayName || 'User',
                    photoURL: cred.user.photoURL,
                });
                return;
            }

            // Returning Google users should wait for Firestore so existing onboarding state wins.
            set({ user: cred.user, profile: null, profileLoaded: false, profileLoadError: null, loading: false });
        } catch (err) {
            set({ loading: false });
            throw err;
        }
    },

    logout: async () => {
        beginProfileLoadRequest();
        await signOut(auth);
        set({ user: null, profile: null, profileLoaded: false, profileLoadError: null });
    },
}));

// Auth state listener — runs on page load/refresh
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const requestToken = beginProfileLoadRequest();
        // User is logged in — set them immediately without waiting for Firestore
        useAuthStore.setState((state) => ({
            user,
            profile: state.profileLoaded && state.profile?.uid === user.uid ? state.profile : null,
            initialized: true,
            profileLoaded: state.profileLoaded && state.profile?.uid === user.uid,
            profileLoadError: null,
        }));

        // Then try to load their profile in the background
        getDoc(doc(db, 'users', user.uid))
            .then((snap) => {
                const currentState = useAuthStore.getState();
                const nextProfileState = resolveProfileLoadState({
                    requestUserUid: user.uid,
                    activeUserUid: currentState.user?.uid,
                    requestToken,
                    activeRequestToken: activeProfileLoadRequestToken,
                    outcome: snap.exists()
                        ? { status: 'found', profile: snap.data() as UserProfile }
                        : { status: 'missing' },
                    currentProfile: currentState.profile,
                    currentProfileLoaded: currentState.profileLoaded,
                    fallbackProfile: buildFallbackProfile(user),
                });

                if (nextProfileState) {
                    useAuthStore.setState(nextProfileState);
                }
            })
            .catch((err) => {
                console.warn('Could not load user profile:', err.message);
                const currentState = useAuthStore.getState();
                const nextProfileState = resolveProfileLoadState({
                    requestUserUid: user.uid,
                    activeUserUid: currentState.user?.uid,
                    requestToken,
                    activeRequestToken: activeProfileLoadRequestToken,
                    outcome: {
                        status: 'error',
                        errorMessage: err?.message ?? 'Could not load user profile.',
                    },
                    currentProfile: currentState.profile,
                    currentProfileLoaded: currentState.profileLoaded,
                    fallbackProfile: buildFallbackProfile(user),
                });

                if (nextProfileState) {
                    useAuthStore.setState(nextProfileState);
                }
            });
    } else {
        beginProfileLoadRequest();
        useAuthStore.setState({
            user: null,
            profile: null,
            initialized: true,
            profileLoaded: false,
            profileLoadError: null,
        });
    }
});
