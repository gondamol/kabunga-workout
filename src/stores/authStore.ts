import { create } from 'zustand';
import {
    User, onAuthStateChanged,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, GoogleAuthProvider, signOut, updateProfile, getAdditionalUserInfo,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DEFAULT_USER_ONBOARDING } from '../lib/profileSetup';
import type { UserProfile } from '../lib/types';

interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    profileLoaded: boolean;
    loading: boolean;
    initialized: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
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

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
    profileLoaded: false,
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
            set({ user: cred.user, profile, profileLoaded: true, loading: false });
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
                set({ user: cred.user, profile, profileLoaded: true, loading: false });
                return;
            }

            // Returning Google users should wait for Firestore so existing onboarding state wins.
            set({ user: cred.user, profile: null, profileLoaded: false, loading: false });
        } catch (err) {
            set({ loading: false });
            throw err;
        }
    },

    logout: async () => {
        await signOut(auth);
        set({ user: null, profile: null, profileLoaded: false });
    },
}));

// Auth state listener — runs on page load/refresh
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is logged in — set them immediately without waiting for Firestore
        useAuthStore.setState((state) => ({
            user,
            profile: state.profile?.uid === user.uid ? state.profile : buildFallbackProfile(user),
            initialized: true,
            profileLoaded: false,
        }));

        // Then try to load their profile in the background
        getDoc(doc(db, 'users', user.uid))
            .then((snap) => {
                if (snap.exists()) {
                    useAuthStore.setState({
                        profile: snap.data() as UserProfile,
                        profileLoaded: true,
                    });
                    return;
                }
                const currentProfile = useAuthStore.getState().profile;
                useAuthStore.setState({
                    profile: currentProfile?.uid === user.uid ? currentProfile : buildFallbackProfile(user),
                    profileLoaded: true,
                });
            })
            .catch((err) => {
                console.warn('Could not load user profile:', err.message);
                const currentProfile = useAuthStore.getState().profile;
                useAuthStore.setState({
                    profile: currentProfile?.uid === user.uid ? currentProfile : buildFallbackProfile(user),
                    profileLoaded: true,
                });
            });
    } else {
        useAuthStore.setState({ user: null, profile: null, initialized: true, profileLoaded: false });
    }
});
