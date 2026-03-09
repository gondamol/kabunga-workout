const BODYWEIGHT_EQUIPMENT_VALUES = new Set([
    'body only',
    'bodyweight',
    'none',
    'no equipment',
    'self',
]);

const BODYWEIGHT_KEYWORDS = [
    'push-up',
    'push up',
    'pull-up',
    'pull up',
    'chin-up',
    'chin up',
    'dip',
    'burpee',
    'plank',
    'mountain climber',
    'jumping jack',
    'bodyweight',
    'dead hang',
    'hollow hold',
    'sit-up',
    'sit up',
    'crunch',
    'leg raise',
    'squat jump',
    'bodyweight squat',
    'glute bridge',
    'bear crawl',
];

const normalizeValue = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const isBodyweightExerciseName = (name: string): boolean => {
    const normalized = normalizeValue(name);
    return BODYWEIGHT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const hasExternalLoad = (weight: number | null | undefined): boolean => {
    return typeof weight === 'number' && weight > 0;
};

export const isBodyweightEquipment = (equipment: string | null | undefined): boolean => {
    if (!equipment) return false;
    return BODYWEIGHT_EQUIPMENT_VALUES.has(normalizeValue(equipment));
};

export const resolveExerciseEquipment = (name: string, equipmentList: string[] = []): string => {
    const firstEquipment = equipmentList.find((entry) => entry.trim().length > 0)?.trim() || '';
    if (isBodyweightEquipment(firstEquipment)) return 'bodyweight';
    if (!firstEquipment && isBodyweightExerciseName(name)) return 'bodyweight';
    return firstEquipment || 'bodyweight';
};

export const formatLoadLabel = (
    weight: number | null | undefined,
    bodyweightLabel = 'bodyweight'
): string => {
    if (hasExternalLoad(weight)) return `${weight}kg`;
    return bodyweightLabel;
};

export const formatSetPerformance = (
    weight: number | null | undefined,
    reps: number | null | undefined,
    bodyweightLabel = 'Bodyweight'
): string => {
    return `${formatLoadLabel(weight, bodyweightLabel)} x ${reps || 0}`;
};

export const formatEffortValue = (
    volume: number,
    reps: number
): { value: string; unit: string } => {
    if (volume > 0) {
        return {
            value: `${Math.round(volume)}`,
            unit: 'kg·reps',
        };
    }

    return {
        value: `${reps}`,
        unit: 'reps',
    };
};

export const formatProgressionTarget = (weight: number, reps: number): string => {
    return formatSetPerformance(weight, reps);
};
