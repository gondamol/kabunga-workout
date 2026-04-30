import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    ArrowRight,
    BatteryCharging,
    CalendarDays,
    Check,
    Dumbbell,
    Flag,
    Flame,
    HeartPulse,
    Home,
    MapPin,
    ShieldCheck,
    Sparkles,
    Timer,
    UserRound,
} from 'lucide-react';
import { updateUserProfile } from '../lib/firestoreService';
import {
    buildCompletedOnboarding,
    COACH_MODE_OPTIONS,
    DEFAULT_USER_ONBOARDING,
    EQUIPMENT_ACCESS_OPTIONS,
    EXPERIENCE_LEVEL_OPTIONS,
    getCoachModeLabel,
    getEquipmentAccessLabel,
    getExperienceLevelLabel,
    getPrimaryGoalLabel,
    getTimeAvailableLabel,
    getTrainingEnvironmentLabel,
    getTrainingStyleLabel,
    PRIMARY_GOAL_OPTIONS,
    TIME_AVAILABLE_OPTIONS,
    TRAINING_STYLE_OPTIONS,
} from '../lib/profileSetup';
import { ActionButton, AppShell, ProgressRing, StatChip, cx } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import type {
    CoachMode,
    EquipmentAccess,
    ExperienceLevel,
    PreferredTrainingStyle,
    PrimaryGoal,
    SupportMode,
    TimeAvailableMinutes,
    TrainingEnvironment,
    UserOnboarding,
    UserProfile,
} from '../lib/types';

const TRAINING_DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;
const TRAINING_CONTEXT_OPTIONS = ['home_bodyweight', 'full_gym', 'outdoor', 'mixed'] as const satisfies readonly TrainingEnvironment[];
const LOCAL_DRAFT_KEY = 'kabunga:onboarding-draft';

type DraftOnboarding = UserOnboarding;
type StepId =
    | 'welcome'
    | 'goal'
    | 'level'
    | 'context'
    | 'equipment'
    | 'time'
    | 'days'
    | 'coach'
    | 'limitation'
    | 'style'
    | 'summary';

type Choice<T extends string | number> = {
    value: T;
    label: string;
    detail: string;
    icon: ReactNode;
};

type OnboardingStep = {
    id: StepId;
    eyebrow: string;
    title: string;
    detail: string;
};

const steps: OnboardingStep[] = [
    {
        id: 'welcome',
        eyebrow: 'Offline-first setup',
        title: 'Welcome to Kabunga',
        detail: 'A few focused choices help Kabunga show the right plan, recovery guidance, and coach-safe summaries.',
    },
    {
        id: 'goal',
        eyebrow: 'Your goal',
        title: 'What should training help with first?',
        detail: 'Pick the direction you want Kabunga to bias toward. You can change this later.',
    },
    {
        id: 'level',
        eyebrow: 'Experience',
        title: 'How much training history do you have?',
        detail: 'This helps tune how much structure, instruction, and progression we surface.',
    },
    {
        id: 'context',
        eyebrow: 'Training context',
        title: 'Where do you usually train?',
        detail: 'Plans should fit real life, whether that is home, gym, outside, or a mix.',
    },
    {
        id: 'equipment',
        eyebrow: 'Equipment',
        title: 'What equipment can you rely on?',
        detail: 'Kabunga keeps workouts useful even when your setup is simple.',
    },
    {
        id: 'time',
        eyebrow: 'Time',
        title: 'How much time do you usually have?',
        detail: 'Short sessions count. We will keep quick options visible.',
    },
    {
        id: 'days',
        eyebrow: 'Weekly rhythm',
        title: 'How many days per week feels realistic?',
        detail: 'Consistency improves when the target is honest.',
    },
    {
        id: 'coach',
        eyebrow: 'Support',
        title: 'How are you training right now?',
        detail: 'Coach mode stays privacy-safe and lightweight.',
    },
    {
        id: 'limitation',
        eyebrow: 'Optional',
        title: 'Any pain, injury, or mobility limitation?',
        detail: 'Keep this private. Coaches only see safe summaries and trends.',
    },
    {
        id: 'style',
        eyebrow: 'Style',
        title: 'What training style should Kabunga favor?',
        detail: 'This shapes the tone of recommendations without locking you in.',
    },
    {
        id: 'summary',
        eyebrow: 'Ready',
        title: 'Your plan is ready',
        detail: 'Kabunga will start simple, adapt around readiness, and keep working when the gym internet does not.',
    },
];

const goalChoices: Array<Choice<PrimaryGoal>> = PRIMARY_GOAL_OPTIONS
    .filter((goal) => goal !== 'muscle')
    .map((goal) => ({
        value: goal,
        label: getPrimaryGoalLabel(goal),
        detail: {
            strength: 'Increase muscle mass, get stronger, and feel powerful.',
            fat_loss: 'Reduce body fat and improve overall health.',
            general_fitness: 'Improve fitness, boost energy, feel your best.',
            mobility: 'Move better, reduce stiffness, and prevent injuries.',
            consistency: 'Build healthy habits and stay consistent.',
            mental_wellness: 'Reduce stress, improve mood, and feel balanced.',
        }[goal] ?? 'Build lean muscle with steady training.',
        icon: {
            strength: <Dumbbell size={21} />,
            fat_loss: <Flame size={21} />,
            general_fitness: <BatteryCharging size={21} />,
            mobility: <Sparkles size={21} />,
            consistency: <CalendarDays size={21} />,
            mental_wellness: <HeartPulse size={21} />,
        }[goal] ?? <Flag size={21} />,
    }));

const levelChoices: Array<Choice<ExperienceLevel>> = EXPERIENCE_LEVEL_OPTIONS.map((level) => ({
    value: level,
    label: getExperienceLevelLabel(level),
    detail: {
        beginner: 'Clear guidance and smaller decisions.',
        intermediate: 'Structure with room to adjust.',
        advanced: 'Progression details stay close.',
    }[level],
    icon: <BatteryCharging size={21} />,
}));

const contextChoices: Array<Choice<TrainingEnvironment>> = TRAINING_CONTEXT_OPTIONS.map((context) => ({
    value: context,
    label: context === 'home_bodyweight' ? 'Home' : getTrainingEnvironmentLabel(context),
    detail: {
        home_bodyweight: 'Bodyweight or simple home setup.',
        full_gym: 'Gym access and heavier lifts.',
        outdoor: 'Walking, running, mobility, and field work.',
        mixed: 'A flexible plan for changing weeks.',
    }[context],
    icon: context === 'home_bodyweight' ? <Home size={21} /> : context === 'outdoor' ? <MapPin size={21} /> : <Dumbbell size={21} />,
}));

const equipmentChoices: Array<Choice<EquipmentAccess>> = EQUIPMENT_ACCESS_OPTIONS.map((equipment) => ({
    value: equipment,
    label: getEquipmentAccessLabel(equipment),
    detail: {
        none: 'No equipment required.',
        dumbbells: 'Simple strength work at home or gym.',
        bands: 'Portable resistance and mobility support.',
        barbell_gym: 'Full strength progression available.',
        mixed: 'Kabunga can adapt session by session.',
    }[equipment],
    icon: <Dumbbell size={21} />,
}));

const timeChoices: Array<Choice<TimeAvailableMinutes>> = TIME_AVAILABLE_OPTIONS.map((time) => ({
    value: time,
    label: getTimeAvailableLabel(time),
    detail: time <= 10 ? 'Quick session fast lane.' : time >= 45 ? 'Full training blocks.' : 'Balanced daily sessions.',
    icon: <Timer size={21} />,
}));

const coachChoices: Array<Choice<CoachMode>> = COACH_MODE_OPTIONS.map((mode) => ({
    value: mode,
    label: getCoachModeLabel(mode),
    detail: {
        training_alone: 'Fast solo planning and repeat workouts.',
        training_with_coach: 'Coach assignments and safe readiness summaries.',
        i_am_coach: 'Lightweight remote planning and athlete check-ins.',
    }[mode],
    icon: mode === 'training_alone' ? <UserRound size={21} /> : <ShieldCheck size={21} />,
}));

const styleChoices: Array<Choice<PreferredTrainingStyle>> = TRAINING_STYLE_OPTIONS.map((style) => ({
    value: style,
    label: getTrainingStyleLabel(style),
    detail: {
        simple: 'Few decisions, clear next step.',
        structured: 'Planned blocks and visible progress.',
        intense: 'More challenge when readiness supports it.',
        gentle: 'Lower pressure, recovery-aware guidance.',
        progressive: 'Small increases over time.',
    }[style],
    icon: <Sparkles size={21} />,
}));

const supportModeFromCoachMode = (coachMode: CoachMode): SupportMode => {
    if (coachMode === 'training_with_coach') return 'with_coach';
    if (coachMode === 'i_am_coach') return 'with_coach';
    return 'solo';
};

const readStoredDraft = (): DraftOnboarding | null => {
    if (typeof window === 'undefined') return null;
    try {
        const value = window.localStorage.getItem(LOCAL_DRAFT_KEY);
        return value ? ({ ...DEFAULT_USER_ONBOARDING, ...JSON.parse(value) } as DraftOnboarding) : null;
    } catch {
        return null;
    }
};

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

function ChoiceCard<T extends string | number>({
    choice,
    selected,
    onSelect,
}: {
    choice: Choice<T>;
    selected: boolean;
    onSelect: (value: T) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onSelect(choice.value)}
            className={cx(
                'pressable touch-target flex w-full items-start gap-3 rounded-[1.5rem] border p-4 text-left',
                selected ? 'border-primary bg-primary text-text-inverse shadow-soft' : 'border-outline bg-bg-card text-text-primary shadow-card hover:bg-bg-card-hover',
            )}
        >
            <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', selected ? 'bg-white/16 text-text-inverse' : 'bg-primary-container text-primary')}>
                {choice.icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className={cx('block text-base font-extrabold', selected ? 'text-text-inverse' : 'text-text-primary')}>{choice.label}</span>
                <span className={cx('mt-1 block text-sm leading-5', selected ? 'text-white/78' : 'text-text-secondary')}>{choice.detail}</span>
            </span>
            {selected && <Check size={20} className="shrink-0" aria-hidden="true" />}
        </button>
    );
}

const GOAL_TONES: Record<string, { iconBg: string; iconColor: string }> = {
    strength: { iconBg: 'bg-primary-container', iconColor: 'text-primary' },
    fat_loss: { iconBg: 'bg-amber/15', iconColor: 'text-amber' },
    general: { iconBg: 'bg-tertiary-container', iconColor: 'text-tertiary' },
    mobility: { iconBg: 'bg-secondary-container', iconColor: 'text-primary' },
    consistency: { iconBg: 'bg-amber/15', iconColor: 'text-amber' },
    mental: { iconBg: 'bg-tertiary-container', iconColor: 'text-tertiary' },
};

function GoalCard<T extends string | number>({
    choice,
    selected,
    onSelect,
}: {
    choice: Choice<T>;
    selected: boolean;
    onSelect: (value: T) => void;
}) {
    const toneKey = String(choice.value);
    const tone = GOAL_TONES[toneKey] ?? GOAL_TONES.strength;
    return (
        <button
            type="button"
            onClick={() => onSelect(choice.value)}
            className={cx(
                'pressable relative w-full rounded-[1.5rem] border-2 p-4 text-left transition-colors',
                selected ? 'border-primary bg-primary-container/40 shadow-soft' : 'border-border bg-bg-card shadow-card hover:border-primary/40',
            )}
        >
            <span className={cx('flex h-12 w-12 items-center justify-center rounded-full mb-3', tone.iconBg, tone.iconColor)}>
                {choice.icon}
            </span>
            <span className="block text-base font-extrabold text-text-primary leading-tight">
                {choice.label}
            </span>
            <span className="mt-1.5 block text-xs leading-snug text-text-secondary">
                {choice.detail}
            </span>
            <span
                className={cx(
                    'absolute top-3.5 right-3.5 flex h-5 w-5 items-center justify-center rounded-full border-2',
                    selected ? 'border-primary bg-primary' : 'border-border-light bg-transparent',
                )}
                aria-hidden="true"
            >
                {selected && <Check size={11} strokeWidth={3.5} className="text-white" />}
            </span>
        </button>
    );
}

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuthStore();
    const [stepIndex, setStepIndex] = useState(0);
    const [draft, setDraft] = useState<DraftOnboarding>(() => profile?.onboarding ?? readStoredDraft() ?? DEFAULT_USER_ONBOARDING);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(profile?.onboarding ?? readStoredDraft() ?? DEFAULT_USER_ONBOARDING);
    }, [profile?.onboarding]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
    }, [draft]);

    const currentStep = steps[stepIndex];
    const progress = ((stepIndex + 1) / steps.length) * 100;
    const isSummary = currentStep.id === 'summary';

    const readyToFinish = useMemo(() => (
        Boolean(
            draft.primaryGoal &&
            draft.trainingEnvironment &&
            draft.supportMode &&
            draft.experienceLevel &&
            draft.trainingDaysPerWeek &&
            draft.equipmentAccess &&
            draft.timeAvailableMinutes &&
            draft.coachMode &&
            draft.preferredTrainingStyle
        )
    ), [draft]);

    const setChoice = <K extends keyof DraftOnboarding>(key: K, value: DraftOnboarding[K]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const nextStep = () => setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    const previousStep = () => setStepIndex((current) => Math.max(current - 1, 0));

    const handleCoachMode = (coachMode: CoachMode) => {
        setDraft((current) => ({
            ...current,
            coachMode,
            supportMode: supportModeFromCoachMode(coachMode),
        }));
    };

    const handleFinish = async () => {
        if (!user || !readyToFinish) return;

        setSaving(true);
        try {
            const now = Date.now();
            const onboarding = buildCompletedOnboarding({
                primaryGoal: draft.primaryGoal!,
                trainingEnvironment: draft.trainingEnvironment!,
                supportMode: draft.supportMode!,
                experienceLevel: draft.experienceLevel!,
                trainingDaysPerWeek: draft.trainingDaysPerWeek!,
                equipmentAccess: draft.equipmentAccess,
                timeAvailableMinutes: draft.timeAvailableMinutes,
                coachMode: draft.coachMode,
                limitationNote: draft.limitationNote,
                preferredTrainingStyle: draft.preferredTrainingStyle,
            });

            const currentProfile = useAuthStore.getState().profile;
            const nextProfile = currentProfile
                ? { ...currentProfile, onboarding, updatedAt: now }
                : buildFallbackProfile(user, onboarding);

            await updateUserProfile(user.uid, { onboarding });

            if (typeof window !== 'undefined') window.localStorage.removeItem(LOCAL_DRAFT_KEY);
            useAuthStore.setState({ profile: nextProfile, profileLoaded: true, profileLoadError: null });

            toast.success('Your training path is ready');
            navigate('/', { replace: true });
        } catch (error) {
            console.error('Failed to save onboarding:', error);
            toast.error('We could not save your setup yet');
        } finally {
            setSaving(false);
        }
    };

    const renderStep = () => {
        switch (currentStep.id) {
            case 'welcome':
                return (
                    <div className="space-y-4">
                        <div className="rounded-[2rem] bg-primary p-6 text-text-inverse shadow-lifted">
                            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-white/14">
                                <Dumbbell size={30} aria-hidden="true" />
                            </div>
                            <h2 className="mt-8 font-display text-4xl font-extrabold leading-tight">Simple training. Built around you.</h2>
                            <p className="mt-4 text-sm leading-6 text-white/78">
                                Kabunga connects workouts, readiness, recovery, coaches, and community without requiring expensive wearables.
                            </p>
                        </div>
                        <div className="grid gap-3">
                            <StatChip tone="secondary" icon={<ShieldCheck size={16} />} label="Works offline" value="Syncs later" />
                            <StatChip tone="tertiary" icon={<BatteryCharging size={16} />} label="No wearable needed" value="Quick check-ins" />
                            <StatChip tone="accent" icon={<CalendarDays size={16} />} label="Coach-safe" value="Summaries only" />
                        </div>
                    </div>
                );
            case 'goal':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        {goalChoices.map((choice) => (
                            <GoalCard
                                key={choice.value}
                                choice={choice}
                                selected={draft.primaryGoal === choice.value}
                                onSelect={(value) => setChoice('primaryGoal', value)}
                            />
                        ))}
                    </div>
                );
            case 'level':
                return <div className="grid gap-3">{levelChoices.map((choice) => <ChoiceCard key={choice.value} choice={choice} selected={draft.experienceLevel === choice.value} onSelect={(value) => setChoice('experienceLevel', value)} />)}</div>;
            case 'context':
                return <div className="grid gap-3">{contextChoices.map((choice) => <ChoiceCard key={choice.value} choice={choice} selected={draft.trainingEnvironment === choice.value} onSelect={(value) => setChoice('trainingEnvironment', value)} />)}</div>;
            case 'equipment':
                return <div className="grid gap-3">{equipmentChoices.map((choice) => <ChoiceCard key={choice.value} choice={choice} selected={draft.equipmentAccess === choice.value} onSelect={(value) => setChoice('equipmentAccess', value)} />)}</div>;
            case 'time':
                return <div className="grid grid-cols-2 gap-3">{timeChoices.map((choice) => <ChoiceCard key={choice.value} choice={choice} selected={draft.timeAvailableMinutes === choice.value} onSelect={(value) => setChoice('timeAvailableMinutes', value)} />)}</div>;
            case 'days':
                return (
                    <div className="grid grid-cols-3 gap-3">
                        {TRAINING_DAYS_OPTIONS.map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => setChoice('trainingDaysPerWeek', days)}
                                className={cx(
                                    'pressable touch-target rounded-[1.5rem] border p-5 text-center shadow-card',
                                    draft.trainingDaysPerWeek === days ? 'border-primary bg-primary text-text-inverse' : 'border-outline bg-bg-card text-text-primary',
                                )}
                            >
                                <span className="font-display text-4xl font-extrabold">{days}</span>
                                <span className={cx('mt-1 block text-xs font-bold uppercase', draft.trainingDaysPerWeek === days ? 'text-white/76' : 'text-text-muted')}>days</span>
                            </button>
                        ))}
                    </div>
                );
            case 'coach':
                return <div className="grid gap-3">{coachChoices.map((choice) => <ChoiceCard key={choice.value} choice={choice} selected={draft.coachMode === choice.value} onSelect={handleCoachMode} />)}</div>;
            case 'limitation':
                return (
                    <div className="space-y-4">
                        <textarea
                            value={draft.limitationNote ?? ''}
                            onChange={(event) => setChoice('limitationNote', event.target.value)}
                            rows={5}
                            className="w-full rounded-[1.5rem] border border-outline bg-bg-card px-4 py-4 text-base text-text-primary shadow-card outline-none placeholder:text-text-muted"
                            placeholder="Example: sore knee when jumping, limited shoulder mobility, lower back discomfort"
                            aria-label="Optional pain, injury, or mobility limitation"
                        />
                        <div className="rounded-[1.5rem] bg-tertiary-container p-4 text-sm leading-6 text-tertiary">
                            Coaches see readiness summaries and trends. They do not see raw private pain notes.
                        </div>
                    </div>
                );
            case 'style':
                return <div className="grid gap-3">{styleChoices.map((choice) => <ChoiceCard key={choice.value} choice={choice} selected={draft.preferredTrainingStyle === choice.value} onSelect={(value) => setChoice('preferredTrainingStyle', value)} />)}</div>;
            case 'summary':
                return (
                    <div className="space-y-4">
                        <div className="premium-card-high p-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Today starts here</p>
                                    <h2 className="mt-2 text-2xl font-extrabold text-text-primary">Keep it simple. Build consistency.</h2>
                                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                                        Your dashboard will prioritize the fastest useful next action, readiness, and repeatable progress.
                                    </p>
                                </div>
                                <ProgressRing value={100} size={110} tone="secondary" label="Setup complete" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            {draft.primaryGoal && <StatChip label="Goal" value={getPrimaryGoalLabel(draft.primaryGoal)} tone="secondary" />}
                            {draft.trainingEnvironment && <StatChip label="Context" value={getTrainingEnvironmentLabel(draft.trainingEnvironment)} tone="primary" />}
                            {draft.equipmentAccess && <StatChip label="Equipment" value={getEquipmentAccessLabel(draft.equipmentAccess)} tone="neutral" />}
                            {draft.timeAvailableMinutes && <StatChip label="Time" value={getTimeAvailableLabel(draft.timeAvailableMinutes)} tone="tertiary" />}
                            {draft.trainingDaysPerWeek && <StatChip label="Weekly rhythm" value={`${draft.trainingDaysPerWeek} days`} tone="accent" />}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    // Group steps into 4 phases for the phase indicator
    const phaseMap: Record<StepId, number> = {
        welcome: 1, goal: 1,
        level: 2, context: 2, equipment: 2,
        time: 3, days: 3, coach: 3, limitation: 3, style: 3,
        summary: 4,
    };
    const phaseLabels = ['Goal', 'Profile', 'Experience', 'Plan'];
    const currentPhase = phaseMap[currentStep.id] ?? 1;

    return (
        <AppShell className="bg-transparent">
            <div className="space-y-5">
                <header>
                    {/* Logo + Skip */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                                <Dumbbell size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-primary leading-none">KABUNGA</p>
                                <p className="text-[9px] text-text-muted leading-none">WORKOUT</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="rounded-full px-3 py-1.5 text-sm font-bold text-text-muted border border-border"
                            onClick={() => setStepIndex(steps.length - 1)}
                        >
                            Skip
                        </button>
                    </div>

                    {/* Phase pills */}
                    <div className="flex items-center gap-1">
                        {phaseLabels.map((label, idx) => {
                            const phase = idx + 1;
                            const isActive = phase === currentPhase;
                            const isDone = phase < currentPhase;
                            return (
                                <div key={label} className="flex items-center gap-1 flex-1">
                                    <div className="flex items-center gap-1.5 flex-1">
                                        <div
                                            className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0"
                                            style={{
                                                width: 22,
                                                height: 22,
                                                background: isActive ? '#17452a' : isDone ? '#9bd93c' : '#e9f0e3',
                                                color: isActive ? 'white' : isDone ? '#17452a' : '#748177',
                                            }}
                                        >
                                            {isDone ? '✓' : phase}
                                        </div>
                                        <span className={`text-[11px] font-bold truncate ${isActive ? 'text-primary' : isDone ? 'text-green' : 'text-text-muted'}`}>
                                            {label}
                                        </span>
                                    </div>
                                    {idx < 3 && <div className="w-4 h-px bg-border shrink-0" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Back button */}
                    {stepIndex > 0 && (
                        <button
                            type="button"
                            onClick={previousStep}
                            className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-text-muted"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>
                    )}
                </header>

                <section>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{currentStep.eyebrow}</p>
                    <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-text-primary">
                        {currentStep.id === 'goal' ? 'What brings you here? 👋' : currentStep.title}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{currentStep.detail}</p>
                </section>

                <section className="animate-slide-up">{renderStep()}</section>

                {currentStep.id === 'goal' && (
                    <p className="text-center text-xs text-text-muted">
                        ℹ️ You can change your goal anytime in your profile settings.
                    </p>
                )}

                <div className="sticky bottom-4 z-10 rounded-[1.75rem] border border-outline/80 bg-bg-card/92 p-3 shadow-lifted backdrop-blur-xl">
                    {isSummary ? (
                        <ActionButton fullWidth size="lg" onClick={handleFinish} disabled={!readyToFinish || saving} isLoading={saving}>
                            Open my dashboard
                        </ActionButton>
                    ) : (
                        <ActionButton
                            fullWidth
                            size="lg"
                            onClick={nextStep}
                            trailingIcon={<ArrowRight size={19} />}
                        >
                            Continue
                        </ActionButton>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
