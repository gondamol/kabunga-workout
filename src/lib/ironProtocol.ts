import dayjs, { type Dayjs } from 'dayjs';
import type { IronSetType, OneRepMaxes, WorkoutTemplate } from './types';
import { BUILT_IN_TEMPLATES } from './templates';

export type OneRepMaxKey = keyof Omit<OneRepMaxes, 'userId' | 'updatedAt'>;

export const DEFAULT_ONE_REP_MAXES: Omit<OneRepMaxes, 'userId' | 'updatedAt'> = {
    benchPress: 80,
    backSquat: 140,
    overheadPress: 40,
    bentOverRow: 140,
    romanianDL: 120,
};

export const IRON_TEMPLATE_IDS = [
    'tpl_iron_push1',
    'tpl_iron_pull1',
    'tpl_iron_legs1',
    'tpl_iron_push2',
    'tpl_iron_pull2',
    'tpl_iron_legs2',
] as const;

export const IRON_TEMPLATE_MAX_KEY: Record<string, OneRepMaxKey> = {
    tpl_iron_push1: 'benchPress',
    tpl_iron_pull1: 'bentOverRow',
    tpl_iron_legs1: 'backSquat',
    tpl_iron_push2: 'overheadPress',
    tpl_iron_pull2: 'bentOverRow',
    tpl_iron_legs2: 'romanianDL',
};

type SessionType = 'primary' | 'secondary' | 'rest';

export interface IronScheduleDay {
    weekday: number; // 0=Sun ... 6=Sat
    shortLabel: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
    sessionType: SessionType;
    title: string;
    primaryLift: string;
    templateId: string | null;
}

export const IRON_WEEKLY_SCHEDULE: IronScheduleDay[] = [
    { weekday: 1, shortLabel: 'Mon', sessionType: 'primary', title: 'Push 1 (Bench)', primaryLift: 'Flat Bench Press', templateId: 'tpl_iron_push1' },
    { weekday: 2, shortLabel: 'Tue', sessionType: 'secondary', title: 'Pull 1 (Rows)', primaryLift: 'Bent-Over BB Rows', templateId: 'tpl_iron_pull1' },
    { weekday: 3, shortLabel: 'Wed', sessionType: 'primary', title: 'Legs 1 (Squats)', primaryLift: 'Back Squat', templateId: 'tpl_iron_legs1' },
    { weekday: 4, shortLabel: 'Thu', sessionType: 'secondary', title: 'Push 2 (OHP)', primaryLift: 'Overhead BB Press', templateId: 'tpl_iron_push2' },
    { weekday: 5, shortLabel: 'Fri', sessionType: 'primary', title: 'Pull 2 (Pull-Ups)', primaryLift: 'Wide-Grip Pull-Ups', templateId: 'tpl_iron_pull2' },
    { weekday: 6, shortLabel: 'Sat', sessionType: 'secondary', title: 'Legs 2 (RDL)', primaryLift: 'Romanian Deadlift', templateId: 'tpl_iron_legs2' },
    { weekday: 0, shortLabel: 'Sun', sessionType: 'rest', title: 'Rest Day', primaryLift: '-', templateId: null },
];

export const isIronTemplateId = (templateId?: string): boolean => {
    if (!templateId) return false;
    return templateId.startsWith('tpl_iron_');
};

export const classifyIronPhase = (phaseName: string, isWarmup?: boolean): IronSetType => {
    const key = phaseName.toLowerCase();
    if (isWarmup || key.includes('warm')) return 'warmup';
    if (key.includes('heavy')) return 'heavy';
    if (key.includes('back-off') || key.includes('back off')) return 'backoff';
    if (key.includes('work')) return 'working';
    return 'accessories';
};

export const getIronScheduleForDate = (date: Dayjs = dayjs()): IronScheduleDay => {
    const weekday = date.day();
    return IRON_WEEKLY_SCHEDULE.find((entry) => entry.weekday === weekday) ?? IRON_WEEKLY_SCHEDULE[6];
};

export const getIronTemplateById = (templateId: string): WorkoutTemplate | null => {
    return BUILT_IN_TEMPLATES.find((template) => template.id === templateId) ?? null;
};

export const normalizeOneRepMaxes = (uid: string, partial?: Partial<OneRepMaxes> | null): OneRepMaxes => ({
    userId: uid,
    benchPress: partial?.benchPress ?? DEFAULT_ONE_REP_MAXES.benchPress,
    backSquat: partial?.backSquat ?? DEFAULT_ONE_REP_MAXES.backSquat,
    overheadPress: partial?.overheadPress ?? DEFAULT_ONE_REP_MAXES.overheadPress,
    bentOverRow: partial?.bentOverRow ?? DEFAULT_ONE_REP_MAXES.bentOverRow,
    romanianDL: partial?.romanianDL ?? DEFAULT_ONE_REP_MAXES.romanianDL,
    updatedAt: partial?.updatedAt ?? Date.now(),
});

export const scaleTemplateForOneRepMaxes = (
    template: WorkoutTemplate,
    oneRepMaxes: OneRepMaxes
): WorkoutTemplate => {
    if (!isIronTemplateId(template.id)) return template;

    const maxKey = IRON_TEMPLATE_MAX_KEY[template.id];
    const defaultMax = DEFAULT_ONE_REP_MAXES[maxKey];
    const ratio = defaultMax > 0 ? oneRepMaxes[maxKey] / defaultMax : 1;

    return {
        ...template,
        phases: template.phases.map((phase) => ({
            ...phase,
            exercises: phase.exercises.map((exercise) => {
                if (exercise.weight <= 0) return exercise;
                return {
                    ...exercise,
                    weight: Math.max(0, Math.round(exercise.weight * ratio)),
                };
            }),
        })),
        updatedAt: Date.now(),
    };
};

export const getScaledIronTemplates = (oneRepMaxes: OneRepMaxes): WorkoutTemplate[] => {
    return BUILT_IN_TEMPLATES
        .filter((template) => isIronTemplateId(template.id))
        .map((template) => scaleTemplateForOneRepMaxes(template, oneRepMaxes));
};

export const isPrimaryDay = (date: Dayjs): boolean => {
    const weekday = date.day();
    return weekday === 1 || weekday === 3 || weekday === 5;
};

export const isTrainingDay = (date: Dayjs): boolean => date.day() !== 0;
