import { COMMON_EXERCISES } from './constants';
import { resolveExerciseEquipment } from './exerciseRules';
import type { ExerciseCatalogItem } from './types';

const EXERCISE_CACHE_KEY_PREFIX = 'kabunga:exercise-catalog:';
const EXERCISE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const EXERCISE_API_BASE_URL = (import.meta.env.VITE_EXERCISE_API_BASE_URL || '/api/exercises').trim().replace(/\/$/, '');
const ENABLE_REMOTE_MUSCLE_IMAGE_PROVIDER = import.meta.env.VITE_ENABLE_REMOTE_MUSCLE_IMAGE_PROVIDER === 'true';

interface CachedCatalogEntry {
    fetchedAt: number;
    items: ExerciseCatalogItem[];
}

const normalizeQuery = (query: string): string => query.trim().toLowerCase().replace(/\s+/g, ' ');
const compactQuery = (query: string): string => normalizeQuery(query).replace(/[^a-z0-9]/g, '');

const toCacheKey = (query: string, limit: number): string => `${EXERCISE_CACHE_KEY_PREFIX}${normalizeQuery(query)}:${limit}`;

const readCache = (query: string, limit: number): ExerciseCatalogItem[] | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(toCacheKey(query, limit));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedCatalogEntry;
        if (!Array.isArray(parsed.items) || typeof parsed.fetchedAt !== 'number') return null;
        if (Date.now() - parsed.fetchedAt > EXERCISE_CACHE_TTL_MS) return null;
        return parsed.items;
    } catch {
        return null;
    }
};

const writeCache = (query: string, limit: number, items: ExerciseCatalogItem[]): void => {
    if (typeof window === 'undefined') return;

    try {
        const payload: CachedCatalogEntry = {
            fetchedAt: Date.now(),
            items,
        };
        window.localStorage.setItem(toCacheKey(query, limit), JSON.stringify(payload));
    } catch {
        // Ignore storage quota failures.
    }
};

const normalizeCatalogText = (value: string): string => {
    return value
        .replace(/â€™/g, "'")
        .replace(/â€œ/g, '"')
        .replace(/â€[\x9c\x9d]/g, '"')
        .replace(/â€“/g, '-')
        .replace(/â€”/g, '-')
        .replace(/Â/g, '')
        .trim();
};

const splitInstructions = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
            .map(normalizeCatalogText);
    }

    if (typeof value !== 'string' || value.trim().length === 0) return [];

    return normalizeCatalogText(value)
        .split(/(?<=[.!?])\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
};

interface SvgHighlightShape {
    kind: 'rect' | 'ellipse';
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rx?: number;
    ry?: number;
    cx?: number;
    cy?: number;
}

const MUSCLE_VISUALS: Record<string, SvgHighlightShape[]> = {
    abdominals: [{ kind: 'rect', x: 68, y: 78, width: 44, height: 54, rx: 16, ry: 16 }],
    abductors: [
        { kind: 'ellipse', cx: 52, cy: 155, rx: 12, ry: 20 },
        { kind: 'ellipse', cx: 128, cy: 155, rx: 12, ry: 20 },
    ],
    adductors: [
        { kind: 'ellipse', cx: 66, cy: 156, rx: 10, ry: 22 },
        { kind: 'ellipse', cx: 114, cy: 156, rx: 10, ry: 22 },
    ],
    biceps: [
        { kind: 'ellipse', cx: 38, cy: 92, rx: 12, ry: 20 },
        { kind: 'ellipse', cx: 142, cy: 92, rx: 12, ry: 20 },
    ],
    calves: [
        { kind: 'rect', x: 58, y: 204, width: 14, height: 36, rx: 8, ry: 8 },
        { kind: 'rect', x: 108, y: 204, width: 14, height: 36, rx: 8, ry: 8 },
    ],
    chest: [{ kind: 'rect', x: 54, y: 58, width: 72, height: 38, rx: 20, ry: 20 }],
    forearms: [
        { kind: 'rect', x: 18, y: 112, width: 16, height: 42, rx: 8, ry: 8 },
        { kind: 'rect', x: 146, y: 112, width: 16, height: 42, rx: 8, ry: 8 },
    ],
    glutes: [
        { kind: 'ellipse', cx: 72, cy: 146, rx: 16, ry: 14 },
        { kind: 'ellipse', cx: 108, cy: 146, rx: 16, ry: 14 },
    ],
    hamstrings: [
        { kind: 'rect', x: 58, y: 156, width: 16, height: 52, rx: 8, ry: 8 },
        { kind: 'rect', x: 106, y: 156, width: 16, height: 52, rx: 8, ry: 8 },
    ],
    lats: [
        { kind: 'ellipse', cx: 58, cy: 92, rx: 18, ry: 34 },
        { kind: 'ellipse', cx: 122, cy: 92, rx: 18, ry: 34 },
    ],
    lower_back: [{ kind: 'rect', x: 62, y: 104, width: 56, height: 24, rx: 12, ry: 12 }],
    middle_back: [{ kind: 'rect', x: 56, y: 62, width: 68, height: 46, rx: 20, ry: 20 }],
    neck: [{ kind: 'rect', x: 76, y: 24, width: 28, height: 18, rx: 9, ry: 9 }],
    quadriceps: [
        { kind: 'rect', x: 54, y: 156, width: 20, height: 58, rx: 10, ry: 10 },
        { kind: 'rect', x: 106, y: 156, width: 20, height: 58, rx: 10, ry: 10 },
    ],
    shoulders: [
        { kind: 'ellipse', cx: 46, cy: 58, rx: 16, ry: 14 },
        { kind: 'ellipse', cx: 134, cy: 58, rx: 16, ry: 14 },
    ],
    traps: [{ kind: 'rect', x: 58, y: 34, width: 64, height: 24, rx: 14, ry: 14 }],
    triceps: [
        { kind: 'ellipse', cx: 34, cy: 96, rx: 11, ry: 22 },
        { kind: 'ellipse', cx: 146, cy: 96, rx: 11, ry: 22 },
    ],
};

const MUSCLE_ALIASES: Record<string, string> = {
    abs: 'abdominals',
    ab: 'abdominals',
    core: 'abdominals',
    back: 'middle_back',
    upper_back: 'middle_back',
    lower_back: 'lower_back',
    delts: 'shoulders',
    quads: 'quadriceps',
};

const toEncodedSvg = (svg: string): string =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const normalizeMuscleKey = (value: string): string => {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
    return MUSCLE_ALIASES[normalized] || normalized;
};

const buildHighlightSvg = (shape: SvgHighlightShape): string => {
    if (shape.kind === 'ellipse') {
        return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" fill="rgba(38,211,255,0.78)" stroke="rgba(171,245,255,0.95)" stroke-width="2" />`;
    }

    return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.rx || 0}" ry="${shape.ry || 0}" fill="rgba(38,211,255,0.78)" stroke="rgba(171,245,255,0.95)" stroke-width="2" />`;
};

const buildLocalMuscleFocusImage = (primaryMuscle: string): string => {
    const muscleKey = normalizeMuscleKey(primaryMuscle || 'general');
    const muscleLabel = muscleKey.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    const highlights = MUSCLE_VISUALS[muscleKey] || [{ kind: 'rect', x: 54, y: 84, width: 72, height: 52, rx: 20, ry: 20 }];

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 260" role="img" aria-label="${muscleLabel} muscle focus">
  <defs>
    <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#101631" />
      <stop offset="100%" stop-color="#07111d" />
    </linearGradient>
    <linearGradient id="panel" x1="0%" x2="100%" y1="0%" y2="0%">
      <stop offset="0%" stop-color="#7b5cff" />
      <stop offset="100%" stop-color="#20d4ff" />
    </linearGradient>
  </defs>
  <rect width="180" height="260" rx="24" fill="url(#bg)" />
  <rect x="14" y="14" width="152" height="36" rx="18" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" />
  <text x="24" y="36" font-family="Arial, sans-serif" font-size="11" fill="#A7B5D9" letter-spacing="1.4">MUSCLE FOCUS</text>
  <text x="24" y="72" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#F5F7FF">${muscleLabel}</text>
  <g opacity="0.92">
    <circle cx="90" cy="62" r="16" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.12)" />
    <rect x="67" y="80" width="46" height="68" rx="22" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
    <rect x="42" y="80" width="14" height="76" rx="7" fill="rgba(255,255,255,0.07)" />
    <rect x="124" y="80" width="14" height="76" rx="7" fill="rgba(255,255,255,0.07)" />
    <rect x="62" y="146" width="18" height="74" rx="9" fill="rgba(255,255,255,0.07)" />
    <rect x="100" y="146" width="18" height="74" rx="9" fill="rgba(255,255,255,0.07)" />
    <rect x="62" y="218" width="14" height="28" rx="7" fill="rgba(255,255,255,0.07)" />
    <rect x="104" y="218" width="14" height="28" rx="7" fill="rgba(255,255,255,0.07)" />
  </g>
  <g>
    ${highlights.map(buildHighlightSvg).join('')}
  </g>
  <rect x="20" y="228" width="140" height="14" rx="7" fill="rgba(255,255,255,0.06)" />
  <rect x="20" y="228" width="88" height="14" rx="7" fill="url(#panel)" />
</svg>`.trim();

    return toEncodedSvg(svg);
};

const buildMuscleImageUrl = (primaryMuscle: string): string | null => {
    const normalized = normalizeQuery(primaryMuscle);
    if (!normalized || normalized === 'general') return null;

    if (ENABLE_REMOTE_MUSCLE_IMAGE_PROVIDER) {
        return `${EXERCISE_API_BASE_URL}/muscle-image?primary=${encodeURIComponent(normalized)}`;
    }

    return buildLocalMuscleFocusImage(normalized);
};

const inferLocalExerciseProfile = (name: string): { bodyPart: string; targetMuscle: string } => {
    const normalizedName = normalizeQuery(name);

    if (/(bench|press|push-up|push up|dip|chest fly|tricep)/.test(normalizedName)) {
        return { bodyPart: 'upper body', targetMuscle: 'chest' };
    }
    if (/(pull-up|pull up|chin-up|chin up|row|lat pulldown|dead hang)/.test(normalizedName)) {
        return { bodyPart: 'upper body', targetMuscle: 'back' };
    }
    if (/(squat|lunge|leg|calf|glute bridge|hip thrust|hamstring)/.test(normalizedName)) {
        return { bodyPart: 'legs', targetMuscle: 'quadriceps' };
    }
    if (/(plank|leg raise|hollow|sit-up|sit up|crunch)/.test(normalizedName)) {
        return { bodyPart: 'core', targetMuscle: 'abdominals' };
    }
    if (/(burpee|mountain climber|jumping jack)/.test(normalizedName)) {
        return { bodyPart: 'full body', targetMuscle: 'general' };
    }

    return { bodyPart: 'full body', targetMuscle: 'general' };
};

const buildLocalItem = (name: string): ExerciseCatalogItem => {
    const { bodyPart, targetMuscle } = inferLocalExerciseProfile(name);

    return {
        id: `local:${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        bodyPart,
        targetMuscle,
        equipment: resolveExerciseEquipment(name),
        equipmentList: [],
        exerciseType: null,
        difficulty: null,
        gifUrl: null,
        muscleImageUrl: buildMuscleImageUrl(targetMuscle),
        instructions: [],
        safetyInfo: null,
        source: 'local',
    };
};

export const getLocalExerciseMatches = (query: string, limit = 8): ExerciseCatalogItem[] => {
    const normalized = normalizeQuery(query);
    const compact = compactQuery(query);
    if (!normalized) return [];

    return COMMON_EXERCISES
        .filter((name) => {
            const lowered = normalizeQuery(name);
            return lowered.includes(normalized) || compactQuery(name).includes(compact);
        })
        .slice(0, limit)
        .map(buildLocalItem);
};

const normalizeApiItem = (item: unknown): ExerciseCatalogItem | null => {
    if (!item || typeof item !== 'object') return null;

    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? normalizeCatalogText(record.name) : '';
    if (!name) return null;

    const equipmentList = Array.isArray(record.equipments)
        ? record.equipments.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : (typeof record.equipment === 'string' && record.equipment.trim().length > 0 ? [record.equipment.trim()] : []);

    const targetMuscle = normalizeCatalogText(String(record.targetMuscle || record.target_muscle || record.target || record.muscle || 'general'));
    const bodyPart = normalizeCatalogText(String(record.bodyPart || record.body_part || targetMuscle || 'general'));
    const exerciseType = typeof record.exerciseType === 'string'
        ? normalizeCatalogText(record.exerciseType)
        : (typeof record.type === 'string' ? normalizeCatalogText(record.type) : null);
    const difficulty = typeof record.difficulty === 'string' ? normalizeCatalogText(record.difficulty) : null;
    const gifUrl = typeof record.gifUrl === 'string' && record.gifUrl.trim().length > 0 ? record.gifUrl : null;
    const safetyInfo = typeof record.safetyInfo === 'string'
        ? normalizeCatalogText(record.safetyInfo)
        : (typeof record.safety_info === 'string' ? normalizeCatalogText(record.safety_info) : null);

    return {
        id: String(record.id || record.exerciseId || `api:${name.toLowerCase().replace(/\s+/g, '-')}`),
        name,
        bodyPart,
        targetMuscle,
        equipment: resolveExerciseEquipment(name, equipmentList),
        equipmentList,
        exerciseType,
        difficulty,
        gifUrl,
        muscleImageUrl: typeof record.muscleImageUrl === 'string'
            ? record.muscleImageUrl
            : buildMuscleImageUrl(targetMuscle),
        instructions: splitInstructions(record.instructions),
        safetyInfo,
        source: 'api',
    };
};

export const searchExerciseCatalog = async (query: string, limit = 8): Promise<ExerciseCatalogItem[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const fromCache = readCache(trimmed, limit);
    if (fromCache) return fromCache;

    try {
        const response = await fetch(`${EXERCISE_API_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`);
        if (!response.ok) throw new Error(`Exercise catalog request failed: ${response.status}`);
        const payload = await response.json();
        const rawItems = Array.isArray(payload) ? payload : payload.items;
        const items = Array.isArray(rawItems)
            ? rawItems.map(normalizeApiItem).filter((item): item is ExerciseCatalogItem => item !== null)
            : [];

        const deduped = [...items];
        for (const localItem of getLocalExerciseMatches(trimmed, limit)) {
            if (!deduped.some((item) => item.name.toLowerCase() === localItem.name.toLowerCase())) {
                deduped.push(localItem);
            }
        }

        const finalItems = deduped.slice(0, limit);
        writeCache(trimmed, limit, finalItems);
        return finalItems;
    } catch (error) {
        console.warn('Exercise catalog search failed, using local fallback:', error);
        return getLocalExerciseMatches(trimmed, limit);
    }
};
