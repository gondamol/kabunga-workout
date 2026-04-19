import type { HealthCheck, ReadinessScore, ReadinessStatus, WorkoutSession } from './types';

export interface DashboardPrimaryCard {
    eyebrow: string;
    title: string;
    detail: string;
    ctaLabel: string;
}

export interface ReadinessStrip {
    label: string;
    value: string;
    detail: string;
    ctaLabel: string;
    tone: ReadinessStatus | 'empty';
}

export const buildDashboardPrimaryCard = ({
    activeSession,
    latestWorkout,
}: {
    activeSession: WorkoutSession | null;
    latestWorkout: WorkoutSession | null;
}): DashboardPrimaryCard => {
    if (activeSession) {
        return {
            eyebrow: "Today's plan",
            title: "Resume today's workout",
            detail: `${activeSession.exercises.length} exercises ready to continue`,
            ctaLabel: 'Resume workout',
        };
    }

    return {
        eyebrow: "Today's plan",
        title: "Today's plan",
        detail: latestWorkout
            ? `Pick up where you left off with ${latestWorkout.exercises[0]?.name || 'your last session'}`
            : 'Build your next training session and start moving',
        ctaLabel: 'Start workout',
    };
};

export const buildReadinessStrip = ({
    readiness,
    healthCheck,
}: {
    readiness: ReadinessScore | null;
    healthCheck: HealthCheck | null;
}): ReadinessStrip => {
    if (!readiness || !healthCheck) {
        return {
            label: 'Readiness',
            value: 'No check-in yet',
            detail: 'Add a quick recovery check before you train',
            ctaLabel: 'Add check-in',
            tone: 'empty',
        };
    }

    return {
        label: 'Readiness',
        value: `${readiness.score}/10`,
        detail: readiness.warnings[0] || 'Ready for today\'s plan',
        ctaLabel: 'Edit',
        tone: readiness.status,
    };
};
