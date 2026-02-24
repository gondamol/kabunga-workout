import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
    type Firestore,
    initializeFirestore,
    memoryLocalCache,
    persistentLocalCache,
    persistentMultipleTabManager,
} from 'firebase/firestore';

const FALLBACK_FIREBASE_CONFIG = {
    apiKey: 'REDACTED_FIREBASE_API_KEY',
    authDomain: 'kabunga-workout-7e5aa.firebaseapp.com',
    projectId: 'kabunga-workout-7e5aa',
    storageBucket: 'kabunga-workout-7e5aa.firebasestorage.app',
    messagingSenderId: '196886329829',
    appId: '1:196886329829:web:b49ee6e329029f2120170c',
};

const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfig = {
    apiKey: envConfig.apiKey,
    authDomain: envConfig.authDomain,
    projectId: envConfig.projectId,
    storageBucket: envConfig.storageBucket,
    messagingSenderId: envConfig.messagingSenderId,
    appId: envConfig.appId,
};

const isPlaceholderValue = (value: string | undefined): boolean => {
    if (!value) return true;
    const normalized = value.trim().toLowerCase();
    return (
        normalized.length === 0 ||
        normalized.includes('your-project') ||
        normalized.includes('your-api-key') ||
        normalized === 'demo-api-key' ||
        normalized === 'demo-project'
    );
};

const assertFirebaseConfig = (): void => {
    const fallbackUsed: string[] = [];
    const applyConfig = <K extends keyof typeof firebaseConfig>(key: K, envValue: string | undefined): void => {
        const normalized = envValue?.trim();
        if (isPlaceholderValue(normalized)) {
            firebaseConfig[key] = FALLBACK_FIREBASE_CONFIG[key];
            fallbackUsed.push(key);
        } else {
            firebaseConfig[key] = normalized as string;
        }
    };

    applyConfig('apiKey', envConfig.apiKey);
    applyConfig('authDomain', envConfig.authDomain);
    applyConfig('projectId', envConfig.projectId);
    applyConfig('storageBucket', envConfig.storageBucket);
    applyConfig('messagingSenderId', envConfig.messagingSenderId);
    applyConfig('appId', envConfig.appId);

    if (fallbackUsed.length > 0) {
        console.warn(`Firebase env vars missing/invalid. Using built-in fallback config for: ${fallbackUsed.join(', ')}`);
    }

    const missing = [
        ['apiKey', firebaseConfig.apiKey],
        ['authDomain', firebaseConfig.authDomain],
        ['projectId', firebaseConfig.projectId],
        ['storageBucket', firebaseConfig.storageBucket],
        ['appId', firebaseConfig.appId],
    ].filter(([, value]) => isPlaceholderValue(value)).map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(`Invalid Firebase config after fallback. Missing: ${missing.join(', ')}`);
    }
};

assertFirebaseConfig();

declare global {
    interface Window {
        __KABUNGA_FIREBASE__?: {
            projectId: string;
            authDomain: string;
            storageBucket: string;
            appId: string;
            useEmulators: boolean;
        };
    }
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Workout payloads can include optional fields. This prevents writes from failing
// when optional values are left blank (e.g. bodyweight exercises).
const baseSettings = {
    ignoreUndefinedProperties: true,
};

let dbInstance: Firestore;
try {
    dbInstance = initializeFirestore(app, {
        ...baseSettings,
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
        }),
    });
} catch (err: any) {
    console.warn('Firestore persistent cache unavailable, falling back to memory cache:', err?.code || err?.message || err);
    dbInstance = initializeFirestore(app, {
        ...baseSettings,
        localCache: memoryLocalCache(),
    });
}

export const db = dbInstance;

if (typeof window !== 'undefined') {
    window.__KABUNGA_FIREBASE__ = {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        storageBucket: firebaseConfig.storageBucket,
        appId: firebaseConfig.appId,
        useEmulators: import.meta.env.VITE_USE_EMULATORS === 'true',
    };
}

export default app;
