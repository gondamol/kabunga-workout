import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { updateUserProfile } from '../lib/firestoreService';
import {
    buildCompletedOnboarding,
    DEFAULT_USER_ONBOARDING,
    EXPERIENCE_LEVEL_OPTIONS,
    getExperienceLevelLabel,
    getPrimaryGoalLabel,
    getSupportModeLabel,
    getTrainingEnvironmentLabel,
    PRIMARY_GOAL_OPTIONS,
    SUPPORT_MODE_OPTIONS,
    TRAINING_ENVIRONMENT_OPTIONS,
} from '../lib/profileSetup';
import { useAuthStore } from '../stores/authStore';
import type {
    ExperienceLevel,
    PrimaryGoal,
    SupportMode,
    TrainingEnvironment,
    UserOnboarding,
    UserProfile,
} from '../lib/types';

const TRAINING_DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;

type ChoiceButtonProps = {
    label: string;
    selected: boolean;
    onClick: () => void;
};

function ChoiceButton({ label, selected, onClick }: ChoiceButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition-all ${
                selected
                    ? 'border-accent bg-accent text-white shadow-lg shadow-accent/20'
                    : 'border-border bg-white text-text-primary hover:border-accent/35 hover:bg-accent/5'
            }`}
        >
            {label}
        </button>
    );
}

type SectionProps = {
    title: string;
    description: string;
    children: ReactNode;
};

function OnboardingSection({ title, description, children }: SectionProps) {
    return (
        <section className="glass rounded-[28px] p-5 space-y-4">
            <div>
                <h2 className="text-base font-semibold text-text-primary">{title}</h2>
                <p className="mt-1 text-sm text-text-secondary">{description}</p>
            </div>
            {children}
        </section>
    );
}

const buildFallbackProfile = (
    user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
    onboarding: UserOnboarding
): UserProfile => ({
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName || 'Athlete',
    photoURL: user.photoURL,
    role: 'athlete',
    coachCode: null,
    onboarding,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuthStore();
    const [draft, setDraft] = useState<UserOnboarding>(profile?.onboarding ?? DEFAULT_USER_ONBOARDING);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(profile?.onboarding ?? DEFAULT_USER_ONBOARDING);
    }, [profile?.onboarding]);

    const readyToFinish = useMemo(() => (
        Boolean(
            draft.primaryGoal &&
            draft.trainingEnvironment &&
            draft.supportMode &&
            draft.experienceLevel &&
            draft.trainingDaysPerWeek
        )
    ), [draft]);

    const handleFinish = async () => {
        if (!user || !readyToFinish) return;

        setSaving(true);
        try {
            const onboarding = buildCompletedOnboarding({
                primaryGoal: draft.primaryGoal!,
                trainingEnvironment: draft.trainingEnvironment!,
                supportMode: draft.supportMode!,
                experienceLevel: draft.experienceLevel!,
                trainingDaysPerWeek: draft.trainingDaysPerWeek!,
            });

            await updateUserProfile(user.uid, { onboarding });

            useAuthStore.setState((state) => {
                const nextProfile = state.profile
                    ? { ...state.profile, onboarding, updatedAt: Date.now() }
                    : buildFallbackProfile(user, onboarding);

                return { profile: nextProfile };
            });

            toast.success('Your training path is ready');
            navigate('/', { replace: true });
        } catch (error) {
            console.error('Failed to save onboarding:', error);
            toast.error('We could not save your setup yet');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="shell-page pt-8 pb-10 space-y-6">
            <section className="glass rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-[0_24px_64px_rgba(23,33,25,0.08)]">
                <div className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                    Build your training path
                </div>
                <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-text-primary">
                    Tell Kabunga how you train
                </h1>
                <p className="mt-2 max-w-xl text-sm text-text-secondary">
                    We&apos;ll shape your home screen around your goal, setup, and the kind of support you want.
                </p>
            </section>

            <OnboardingSection
                title="Primary goal"
                description="Pick the outcome you want the app to bias toward first."
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {PRIMARY_GOAL_OPTIONS.map((goal) => (
                        <ChoiceButton
                            key={goal}
                            label={getPrimaryGoalLabel(goal)}
                            selected={draft.primaryGoal === goal}
                            onClick={() => setDraft((current) => ({ ...current, primaryGoal: goal as PrimaryGoal }))}
                        />
                    ))}
                </div>
            </OnboardingSection>

            <OnboardingSection
                title="Training environment"
                description="This helps us lean toward plans that fit the equipment you actually have."
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {TRAINING_ENVIRONMENT_OPTIONS.map((environment) => (
                        <ChoiceButton
                            key={environment}
                            label={getTrainingEnvironmentLabel(environment)}
                            selected={draft.trainingEnvironment === environment}
                            onClick={() => setDraft((current) => ({
                                ...current,
                                trainingEnvironment: environment as TrainingEnvironment,
                            }))}
                        />
                    ))}
                </div>
            </OnboardingSection>

            <OnboardingSection
                title="Support style"
                description="Choose whether you want Kabunga to feel more self-directed or more connected."
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {SUPPORT_MODE_OPTIONS.map((supportMode) => (
                        <ChoiceButton
                            key={supportMode}
                            label={getSupportModeLabel(supportMode)}
                            selected={draft.supportMode === supportMode}
                            onClick={() => setDraft((current) => ({ ...current, supportMode: supportMode as SupportMode }))}
                        />
                    ))}
                </div>
            </OnboardingSection>

            <OnboardingSection
                title="Experience level"
                description="We&apos;ll use this to calibrate pacing and how much guidance to surface."
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {EXPERIENCE_LEVEL_OPTIONS.map((level) => (
                        <ChoiceButton
                            key={level}
                            label={getExperienceLevelLabel(level)}
                            selected={draft.experienceLevel === level}
                            onClick={() => setDraft((current) => ({ ...current, experienceLevel: level as ExperienceLevel }))}
                        />
                    ))}
                </div>
            </OnboardingSection>

            <OnboardingSection
                title="Training days"
                description="Set a realistic weekly rhythm so your dashboard starts from a plan you can sustain."
            >
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {TRAINING_DAYS_OPTIONS.map((days) => (
                        <button
                            key={days}
                            type="button"
                            onClick={() => setDraft((current) => ({ ...current, trainingDaysPerWeek: days }))}
                            className={`rounded-2xl border px-4 py-4 text-center text-base font-semibold transition-all ${
                                draft.trainingDaysPerWeek === days
                                    ? 'border-accent bg-accent text-white shadow-lg shadow-accent/20'
                                    : 'border-border bg-white text-text-primary hover:border-accent/35 hover:bg-accent/5'
                            }`}
                        >
                            {days}
                        </button>
                    ))}
                </div>
            </OnboardingSection>

            <button
                type="button"
                onClick={handleFinish}
                disabled={!readyToFinish || saving}
                className="w-full rounded-2xl gradient-primary px-4 py-4 text-base font-semibold text-white shadow-lg shadow-accent/15 disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Open my dashboard'}
            </button>
        </div>
    );
}
