import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.EXERCISE_PROXY_PORT || 8787);
const SERVER_ENV_PATH = resolve(process.cwd(), 'server.env');
const LEGACY_FUNCTIONS_ENV_PATH = resolve(process.cwd(), 'functions/.env');
const API_NINJAS_BASE_URL = 'https://api.api-ninjas.com';
const EXERCISES_HOST = 'exercises-by-api-ninjas.p.rapidapi.com';
const EXERCISES_BASE_URL = `https://${EXERCISES_HOST}`;

const MUSCLE_ALIAS_MAP = new Map([
    ['abs', 'abdominals'],
    ['ab', 'abdominals'],
    ['core', 'abdominals'],
    ['biceps', 'biceps'],
    ['triceps', 'triceps'],
    ['chest', 'chest'],
    ['lats', 'lats'],
    ['back', 'middle_back'],
    ['upper back', 'middle_back'],
    ['lower back', 'lower_back'],
    ['forearms', 'forearms'],
    ['shoulders', 'shoulders'],
    ['delts', 'shoulders'],
    ['quadriceps', 'quadriceps'],
    ['quads', 'quadriceps'],
    ['hamstrings', 'hamstrings'],
    ['glutes', 'glutes'],
    ['calves', 'calves'],
    ['traps', 'traps'],
    ['neck', 'neck'],
    ['adductors', 'adductors'],
    ['abductors', 'abductors'],
]);

const parseDotEnv = (raw) => {
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .reduce((acc, line) => {
            const separatorIndex = line.indexOf('=');
            if (separatorIndex === -1) return acc;
            const key = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 1).trim();
            acc[key] = value;
            return acc;
        }, {});
};

const loadExerciseProviderKeys = () => {
    const directApiNinjasKey = process.env.API_NINJAS_API_KEY || '';
    const rapidApiKeyFromEnv = process.env.RAPIDAPI_KEY || '';

    if (directApiNinjasKey || rapidApiKeyFromEnv) {
        return {
            apiNinjasKey: directApiNinjasKey,
            rapidApiKey: rapidApiKeyFromEnv,
        };
    }

    if (existsSync(SERVER_ENV_PATH)) {
        const env = parseDotEnv(readFileSync(SERVER_ENV_PATH, 'utf8'));
        return {
            apiNinjasKey: env.API_NINJAS_API_KEY || '',
            rapidApiKey: env.RAPIDAPI_KEY || '',
        };
    }

    if (existsSync(LEGACY_FUNCTIONS_ENV_PATH)) {
        const env = parseDotEnv(readFileSync(LEGACY_FUNCTIONS_ENV_PATH, 'utf8'));
        return {
            apiNinjasKey: env.API_NINJAS_API_KEY || '',
            rapidApiKey: env.RAPIDAPI_KEY || '',
        };
    }

    throw new Error('Missing exercise provider key. Add API_NINJAS_API_KEY or RAPIDAPI_KEY to server.env or the shell environment.');
};

const { apiNinjasKey: API_NINJAS_API_KEY, rapidApiKey: RAPIDAPI_KEY } = loadExerciseProviderKeys();

const normalizeQuery = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const splitInstructions = (value) => {
    if (Array.isArray(value)) {
        return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
    }

    if (typeof value !== 'string' || value.trim().length === 0) return [];

    return value
        .split(/(?<=[.!?])\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const normalizeEquipmentList = (value) => {
    if (Array.isArray(value)) {
        return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
    }

    return [];
};

const slugify = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeExercise = (item) => {
    if (!item || typeof item !== 'object') return null;

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) return null;

    const targetMuscle = String(item.muscle || 'general').trim();
    const equipmentList = normalizeEquipmentList(item.equipments || item.equipment);

    return {
        id: `api-ninjas:${slugify(name)}:${slugify(targetMuscle || 'general')}:${slugify(item.type || 'general')}`,
        name,
        bodyPart: targetMuscle || 'general',
        targetMuscle: targetMuscle || 'general',
        equipment: equipmentList[0] || 'bodyweight',
        equipmentList,
        exerciseType: typeof item.type === 'string' ? item.type.trim() : null,
        difficulty: typeof item.difficulty === 'string' ? item.difficulty.trim() : null,
        gifUrl: null,
        instructions: splitInstructions(item.instructions),
        safetyInfo: typeof item.safety_info === 'string' ? item.safety_info.trim() : null,
        source: 'api',
    };
};

const resolveSearchStrategies = (query) => {
    const normalized = normalizeQuery(query);
    const exactMuscle = MUSCLE_ALIAS_MAP.get(normalized);

    if (exactMuscle) {
        return [
            ['muscle', exactMuscle],
            ['name', query],
        ];
    }

    return [
        ['name', query],
        ['muscle', query],
    ];
};

const fetchExercises = async (paramName, value) => {
    const useDirectApiNinjas = Boolean(API_NINJAS_API_KEY);
    const url = new URL('/v1/exercises', useDirectApiNinjas ? API_NINJAS_BASE_URL : EXERCISES_BASE_URL);
    url.searchParams.set(paramName, value);

    const response = await fetch(url, {
        headers: useDirectApiNinjas
            ? {
                'X-Api-Key': API_NINJAS_API_KEY,
                Accept: 'application/json',
            }
            : {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': EXERCISES_HOST,
                Accept: 'application/json',
            },
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`RapidAPI request failed: ${response.status}${detail ? ` ${detail}` : ''}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
};

const withCors = (response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const server = createServer(async (request, response) => {
    withCors(response);

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    if (request.method !== 'GET' || !request.url) {
        response.writeHead(405, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname !== '/api/exercises/search') {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    const query = String(url.searchParams.get('q') || '').trim();
    const limit = Math.max(1, Math.min(12, Number(url.searchParams.get('limit')) || 8));

    if (query.length < 2) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ items: [] }));
        return;
    }

    try {
        const seen = new Set();
        const items = [];

        for (const [paramName, value] of resolveSearchStrategies(query)) {
            let upstreamItems = [];

            try {
                upstreamItems = await fetchExercises(paramName, value);
            } catch (error) {
                if (paramName === 'muscle') continue;
                throw error;
            }

            for (const upstreamItem of upstreamItems) {
                const item = normalizeExercise(upstreamItem);
                if (!item || seen.has(item.id)) continue;
                seen.add(item.id);
                items.push(item);
                if (items.length >= limit) break;
            }

            if (items.length >= limit) break;
        }

        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ items }));
    } catch (error) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
            error: 'Exercise catalog unavailable',
            detail: error instanceof Error ? error.message : 'Unknown error',
        }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Exercise proxy listening on http://127.0.0.1:${PORT}`);
});
