const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const API_NINJAS_BASE_URL = process.env.API_NINJAS_BASE_URL || 'https://api.api-ninjas.com';
const EXERCISES_HOST = process.env.RAPIDAPI_EXERCISES_HOST || 'exercises-by-api-ninjas.p.rapidapi.com';
const EXERCISES_BASE_URL = process.env.RAPIDAPI_EXERCISES_BASE_URL || `https://${EXERCISES_HOST}`;
const EXERCISES_SEARCH_PATH = process.env.RAPIDAPI_EXERCISES_SEARCH_PATH || '/v1/exercises';
const MUSCLE_IMAGE_HOST = process.env.RAPIDAPI_MUSCLE_IMAGE_HOST || 'muscle-group-image-generator.p.rapidapi.com';
const MUSCLE_IMAGE_BASE_URL = process.env.RAPIDAPI_MUSCLE_IMAGE_BASE_URL || `https://${MUSCLE_IMAGE_HOST}`;
const MUSCLE_IMAGE_PATH = process.env.RAPIDAPI_MUSCLE_IMAGE_PATH || '/getDualColorImage';

const cache = new Map();

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

const json = (payload, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      ...extraHeaders,
    },
  });

const readCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
};

const writeCache = (key, payload) => {
  cache.set(key, { fetchedAt: Date.now(), payload });
};

const normalizeQueryText = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

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

const buildMuscleImageUrl = (muscle) => {
  const normalized = normalizeQueryText(muscle);
  if (!normalized || normalized === 'general') return null;
  return `/api/exercises/muscle-image?primary=${encodeURIComponent(normalized)}`;
};

const normalizeExercise = (item) => {
  if (!item || typeof item !== 'object') return null;

  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) return null;

  const targetMuscle = String(item.muscle || item.targetMuscle || 'general').trim();
  const exerciseType = typeof item.type === 'string' ? item.type.trim() : null;
  const equipmentList = normalizeEquipmentList(item.equipments || item.equipment);
  const difficulty = typeof item.difficulty === 'string' ? item.difficulty.trim() : null;
  const safetyInfo = typeof item.safety_info === 'string' && item.safety_info.trim().length > 0
    ? item.safety_info.trim()
    : null;

  return {
    id: `api-ninjas:${slugify(name)}:${slugify(targetMuscle || 'general')}:${slugify(exerciseType || 'general')}`,
    name,
    bodyPart: targetMuscle || 'general',
    targetMuscle: targetMuscle || 'general',
    equipment: equipmentList[0] || 'bodyweight',
    equipmentList,
    exerciseType,
    difficulty,
    gifUrl: null,
    muscleImageUrl: buildMuscleImageUrl(targetMuscle),
    instructions: splitInstructions(item.instructions),
    safetyInfo,
  };
};

const ensureApiNinjasKey = () => {
  const apiNinjasKey = process.env.API_NINJAS_API_KEY;
  if (!apiNinjasKey) {
    throw new Error('Missing API_NINJAS_API_KEY for direct API Ninjas exercise access');
  }
  return apiNinjasKey;
};

const ensureRapidApiKey = () => {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error('Missing RAPIDAPI_KEY for RapidAPI-backed exercise features');
  }
  return rapidApiKey;
};

const fetchApiNinjasJson = async (path) => {
  const apiNinjasKey = ensureApiNinjasKey();
  const response = await fetch(`${API_NINJAS_BASE_URL}${path}`, {
    headers: {
      'X-Api-Key': apiNinjasKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`api.api-ninjas.com request failed: ${response.status}${detail ? ` ${detail}` : ''}`);
  }

  return response.json();
};

const fetchRapidApi = async ({ baseUrl, host, path, accept = 'application/json' }) => {
  const rapidApiKey = ensureRapidApiKey();
  return fetch(`${baseUrl}${path}`, {
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': host,
      Accept: accept,
    },
  });
};

const fetchRapidApiJson = async (options) => {
  const response = await fetchRapidApi(options);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${options.host} request failed: ${response.status}${detail ? ` ${detail}` : ''}`);
  }
  return response.json();
};

const searchUpstreamExercises = async (paramName, value) => {
  const params = new URLSearchParams();
  params.set(paramName, value);
  const path = `${EXERCISES_SEARCH_PATH}?${params.toString()}`;
  const payload = process.env.API_NINJAS_API_KEY
    ? await fetchApiNinjasJson(path)
    : await fetchRapidApiJson({
      baseUrl: EXERCISES_BASE_URL,
      host: EXERCISES_HOST,
      path,
    });

  return Array.isArray(payload) ? payload : [];
};

const resolveSearchStrategies = (query) => {
  const normalized = normalizeQueryText(query);
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

const searchExercises = async (query, limit) => {
  const seen = new Set();
  const normalizedItems = [];

  for (const [paramName, value] of resolveSearchStrategies(query)) {
    let upstreamItems = [];

    try {
      upstreamItems = await searchUpstreamExercises(paramName, value);
    } catch (error) {
      if (paramName === 'muscle') continue;
      throw error;
    }

    for (const upstreamItem of upstreamItems) {
      const item = normalizeExercise(upstreamItem);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      normalizedItems.push(item);
      writeCache(`detail:${item.id}`, item);
      if (normalizedItems.length >= limit) return normalizedItems;
    }
  }

  return normalizedItems;
};

const readMultiValueQuery = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry || '').split(','))
      .map((entry) => normalizeQueryText(entry))
      .filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((entry) => normalizeQueryText(entry))
    .filter(Boolean);
};

const sendCachedPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  if (payload.kind === 'binary' && payload.body) {
    return new Response(payload.body, {
      status: 200,
      headers: {
        'content-type': payload.contentType || 'image/png',
        'cache-control': 'public, max-age=86400',
        'access-control-allow-origin': '*',
      },
    });
  }

  return json(payload);
};

export const OPTIONS = async () =>
  new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    },
  });

export const GET = async (request) => {
  const url = new URL(request.url);
  const requestPath = url.pathname.replace(/^\/api\/exercises/, '') || '/';

  try {
    if (requestPath === '/search' || requestPath === 'search') {
      const query = String(url.searchParams.get('q') || '').trim();
      const limit = Math.max(1, Math.min(12, Number(url.searchParams.get('limit')) || 8));

      if (query.length < 2) {
        return json({ items: [] });
      }

      const cacheKey = `search:${normalizeQueryText(query)}:${limit}`;
      const cached = readCache(cacheKey);
      if (cached) {
        return json({ items: cached });
      }

      const items = await searchExercises(query, limit);
      writeCache(cacheKey, items);
      return json({ items });
    }

    if (requestPath === '/muscle-image' || requestPath === 'muscle-image') {
      const primary = readMultiValueQuery(url.searchParams.getAll('primary').length > 0 ? url.searchParams.getAll('primary') : url.searchParams.get('primaryMuscleGroups'));
      const secondary = readMultiValueQuery(url.searchParams.getAll('secondary').length > 0 ? url.searchParams.getAll('secondary') : url.searchParams.get('secondaryMuscleGroups'));
      if (primary.length === 0) {
        return json({ error: 'Missing primary muscle group' }, 400);
      }

      const primaryColor = String(url.searchParams.get('primaryColor') || '240,100,80').trim();
      const secondaryColor = String(url.searchParams.get('secondaryColor') || '20,100,80').trim();
      const transparentBackground = String(url.searchParams.get('transparentBackground') || '0').trim();
      const cacheKey = `muscle-image:${primary.join(',')}:${secondary.join(',')}:${primaryColor}:${secondaryColor}:${transparentBackground}`;
      const cached = readCache(cacheKey);
      if (cached) {
        return sendCachedPayload(cached);
      }

      const params = new URLSearchParams({
        primaryMuscleGroups: primary.join(','),
        primaryColor,
        secondaryColor,
        transparentBackground,
      });
      if (secondary.length > 0) {
        params.set('secondaryMuscleGroups', secondary.join(','));
      }

      const upstream = await fetchRapidApi({
        baseUrl: MUSCLE_IMAGE_BASE_URL,
        host: MUSCLE_IMAGE_HOST,
        path: `${MUSCLE_IMAGE_PATH}?${params.toString()}`,
        accept: 'image/*,application/json',
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => '');
        return json({
          error: 'Muscle image unavailable',
          detail: detail || `RapidAPI host ${MUSCLE_IMAGE_HOST} returned ${upstream.status}`,
        }, upstream.status);
      }

      const contentType = upstream.headers.get('content-type') || 'image/png';
      if (contentType.includes('application/json')) {
        const payload = await upstream.json();
        writeCache(cacheKey, payload);
        return json(payload);
      }

      const body = Buffer.from(await upstream.arrayBuffer());
      const payload = {
        kind: 'binary',
        contentType,
        body,
      };
      writeCache(cacheKey, payload);

      return new Response(body, {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': 'public, max-age=86400',
          'access-control-allow-origin': '*',
        },
      });
    }

    const exerciseId = requestPath.replace(/^\//, '');
    if (!exerciseId) {
      return json({ error: 'Exercise not found' }, 404);
    }

    const cacheKey = `detail:${exerciseId}`;
    const cached = readCache(cacheKey);
    if (cached) {
      return json(cached);
    }

    const lookupName = String(url.searchParams.get('name') || '').trim();
    if (!lookupName) {
      return json({ error: 'Exercise not found' }, 404);
    }

    const items = await searchExercises(lookupName, 6);
    const match = items.find((item) => item.id === exerciseId || normalizeQueryText(item.name) === normalizeQueryText(lookupName));
    if (!match) {
      return json({ error: 'Exercise not found' }, 404);
    }

    writeCache(cacheKey, match);
    return json(match);
  } catch (error) {
    return json({
      error: 'Exercise catalog unavailable',
      detail: error instanceof Error ? error.message : 'Unknown error',
    }, 503);
  }
};
