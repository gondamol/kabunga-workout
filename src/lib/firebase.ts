import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
    type Firestore,
    initializeFirestore,
    memoryLocalCache,
    persistentLocalCache,
    persistentMultipleTabManager,
} from 'firebase/firestore';

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

const requireFirebaseEnv = (key: keyof typeof envConfig): string => {
    const value = envConfig[key]?.trim();
    if (isPlaceholderValue(value)) {
        throw new Error(
            `Missing Firebase config: ${key}. Set VITE_FIREBASE_* values in .env (local) and hosting environment variables (deployment).`
        );
    }
    return value;
};

const assertFirebaseConfig = (): void => {
    firebaseConfig.apiKey = requireFirebaseEnv('apiKey');
    firebaseConfig.authDomain = requireFirebaseEnv('authDomain');
    firebaseConfig.projectId = requireFirebaseEnv('projectId');
    firebaseConfig.storageBucket = requireFirebaseEnv('storageBucket');
    firebaseConfig.messagingSenderId = requireFirebaseEnv('messagingSenderId');
    firebaseConfig.appId = requireFirebaseEnv('appId');
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
