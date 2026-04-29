import type { HealthCheck, QueuedAction } from './types';

export type QueueActionHandlers = {
    saveWorkout: (data: any) => Promise<void>;
    saveMeal: (data: any) => Promise<void>;
    saveChallenge: (data: any) => Promise<void>;
    saveOneRepMaxes: (uid: string, maxes: any) => Promise<void>;
    saveFitnessDailyConfig: (uid: string, config: any) => Promise<void>;
    saveFitnessDailyLog: (uid: string, date: string, log: any) => Promise<void>;
    saveHealthCheck: (check: HealthCheck) => Promise<void>;
};

export const runQueuedAction = async (
    action: QueuedAction,
    handlers: QueueActionHandlers
): Promise<void> => {
    switch (action.type) {
        case 'workout':
            await handlers.saveWorkout(action.data);
            return;
        case 'meal':
            await handlers.saveMeal(action.data);
            return;
        case 'challenge':
            await handlers.saveChallenge(action.data);
            return;
        case 'oneRepMaxes':
            await handlers.saveOneRepMaxes(action.data.uid, action.data.maxes);
            return;
        case 'fitnessDailyConfig':
            await handlers.saveFitnessDailyConfig(action.data.uid, action.data.config);
            return;
        case 'fitnessDaily':
            await handlers.saveFitnessDailyLog(action.data.uid, action.data.date, action.data.log);
            return;
        case 'healthCheck':
            await handlers.saveHealthCheck(action.data);
            return;
    }
};
