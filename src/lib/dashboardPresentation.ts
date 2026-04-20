import { getSupportModeLabel } from './profileSetup.ts';
import type { HealthCheck, ReadinessScore, ReadinessStatus, UserProfile, WorkoutSession } from './types';

export interface DashboardPrimaryCard {
    eyebrow: string;
    title: string;
    detail: string;
    ctaLabel: string;
}

export interface DashboardGoalHero {
    eyebrow: string;
    title: string;
    detail: string;
    ctaLabel: string;
}

export interface DashboardCircleShortcut {
    title: string;
    detail: string;
    ctaLabel: string;
}

export interface DashboardEmptyState {
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

const buildGoalEyebrow = (profile: UserProfile | null): string => {
    const goal = profile?.onboarding?.primaryGoal;

    if (goal === 'strength') {
        return 'Strength block';
    }

    if (goal === 'muscle') {
        return 'Muscle block';
    }

    if (goal === 'fat_loss') {
        return 'Fat-loss block';
    }

    return 'Training block';
};

const buildGoalFocus = (profile: UserProfile | null): string => {
    const goal = profile?.onboarding?.primaryGoal;

    if (goal === 'strength') {
        return 'strength';
    }

    if (goal === 'muscle') {
        return 'muscle';
    }

    if (goal === 'fat_loss') {
        return 'fat-loss';
    }

    return 'general fitness';
};

export const buildDashboardGoalHero = ({
    profile,
    activeSession,
    latestWorkout,
}: {
    profile: UserProfile | null;
    activeSession: WorkoutSession | null;
    latestWorkout: WorkoutSession | null;
}): DashboardGoalHero => {
    const eyebrow = buildGoalEyebrow(profile);
    const goalFocus = buildGoalFocus(profile);

    if (activeSession) {
        return {
            eyebrow,
            title: "Resume today's session",
            detail: `${activeSession.exercises.length} exercises ready to continue`,
            ctaLabel: 'Resume workout',
        };
    }

    if (!latestWorkout) {
        return {
            eyebrow,
            title: `Start your ${goalFocus} block`,
            detail: "We'll tailor your first session around the path you selected.",
            ctaLabel: 'Build first session',
        };
    }

    return {
        eyebrow,
        title: `Stay on your ${goalFocus} block`,
        detail: `Pick up where you left off with ${latestWorkout.exercises[0]?.name || 'your last session'}`,
        ctaLabel: 'Start workout',
    };
};

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

export const buildDashboardProgressEmptyState = ({
    profile,
    workoutCount,
}: {
    profile: UserProfile | null;
    workoutCount: number;
}): DashboardEmptyState => {
    const goalFocus = buildGoalFocus(profile);

    if (workoutCount === 0) {
        return {
            title: `Complete your first ${goalFocus} session`,
            detail: 'Your progress cards unlock once you log your first real workout.',
            ctaLabel: 'Start workout',
        };
    }

    return {
        title: 'Progress is building',
        detail: 'Keep training this week to unlock deeper trends and PR callouts.',
        ctaLabel: 'View history',
    };
};

export const buildCircleShortcutCard = ({
    profile,
    hasCircle,
}: {
    profile: UserProfile | null;
    hasCircle: boolean;
}): DashboardCircleShortcut => {
    const supportMode = profile?.onboarding?.supportMode || 'solo';

    if (hasCircle) {
        return {
            title: 'Your circle',
            detail: 'Check invites, sync challenge progress, and keep your crew moving.',
            ctaLabel: 'Open circle',
        };
    }

    return {
        title: supportMode === 'with_friends' ? 'Bring your training circle in' : 'Add accountability when you want it',
        detail: `Kabunga is set to ${getSupportModeLabel(supportMode).toLowerCase()} mode right now.`,
        ctaLabel: 'Create or join a circle',
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
