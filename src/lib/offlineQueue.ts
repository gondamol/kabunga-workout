import type { QueuedAction } from './types';
import {
    saveChallenge,
    saveFitnessDailyConfig,
    saveFitnessDailyLog,
    saveMeal,
    saveOneRepMaxes,
    saveWorkout,
} from './firestoreService';
import { saveHealthCheck } from './healthCheckService';
import type { HealthCheck } from './types';
import { runQueuedAction } from './offlineQueueRunner';

const DB_NAME = 'kabunga-offline';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

export const enqueueAction = async (action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item: QueuedAction = {
        ...action,
        id: Math.random().toString(36).slice(2) + Date.now(),
        timestamp: Date.now(),
        retries: 0,
    };
    store.put(item);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getQueuedActions = async (): Promise<QueuedAction[]> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

const removeAction = async (id: string): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

type QueueActionHandlers = {
    saveWorkout: typeof saveWorkout;
    saveMeal: typeof saveMeal;
    saveChallenge: typeof saveChallenge;
    saveOneRepMaxes: typeof saveOneRepMaxes;
    saveFitnessDailyConfig: typeof saveFitnessDailyConfig;
    saveFitnessDailyLog: typeof saveFitnessDailyLog;
    saveHealthCheck: (check: HealthCheck) => Promise<void>;
};

const defaultQueueHandlers: QueueActionHandlers = {
    saveWorkout,
    saveMeal,
    saveChallenge,
    saveOneRepMaxes,
    saveFitnessDailyConfig,
    saveFitnessDailyLog,
    saveHealthCheck,
};

export const processQueue = async (): Promise<number> => {
    const actions = await getQueuedActions();
    let processed = 0;

    for (const action of actions) {
        try {
            await runQueuedAction(action, defaultQueueHandlers);
            await removeAction(action.id);
            processed++;
        } catch (err) {
            console.warn('Failed to process queued action:', action.id, err);
            // Will retry on next sync
        }
    }

    return processed;
};

// Auto-sync when back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        processQueue().then((count) => {
            if (count > 0) console.log(`Synced ${count} offline actions`);
        });
    });
}
