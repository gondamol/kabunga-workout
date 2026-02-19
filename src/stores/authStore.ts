import { create } from 'zustand';
import {
    User, onAuthStateChanged,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, GoogleAuthProvider, signOut, updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../lib/types';

interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    initialized: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

// Helper: save profile to Firestore with a 5-second timeout
// If it times out, we still let the user in — profile saves later
const saveProfileWithTimeout = async (profile: UserProfile): Promise<void> => {
    const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore timeout')), 5000)
    );
    await Promise.race([
        setDoc(doc(db, 'users', profile.uid), profile),
        timeout,
    ]);
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
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

            const profile: UserProfile = {
                uid: cred.user.uid,
                email: cred.user.email!,
                displayName: name,
                photoURL: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            // Step 2: Set user immediately so the app navigates right away
            set({ user: cred.user, profile, loading: false });

            // Step 3: Save to Firestore in background — don't block login
            saveProfileWithTimeout(profile).catch((err) => {
                console.warn('Profile save failed (will retry on next login):', err.message);
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

            const profile: UserProfile = {
                uid: cred.user.uid,
                email: cred.user.email!,
                displayName: cred.user.displayName || 'User',
                photoURL: cred.user.photoURL,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            // Set user immediately
            set({ user: cred.user, profile, loading: false });

            // Save/update profile in background
            saveProfileWithTimeout(profile).catch((err) => {
                console.warn('Google profile save failed:', err.message);
            });
        } catch (err) {
            set({ loading: false });
            throw err;
        }
    },

    logout: async () => {
        await signOut(auth);
        set({ user: null, profile: null });
    },
}));

// Auth state listener — runs on page load/refresh
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is logged in — set them immediately without waiting for Firestore
        useAuthStore.setState({ user, initialized: true });

        // Then try to load their profile in the background
        getDoc(doc(db, 'users', user.uid))
            .then((snap) => {
                if (snap.exists()) {
                    useAuthStore.setState({ profile: snap.data() as UserProfile });
                }
            })
            .catch((err) => {
                console.warn('Could not load user profile:', err.message);
            });
    } else {
        useAuthStore.setState({ user: null, profile: null, initialized: true });
    }
});
