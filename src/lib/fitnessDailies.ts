import type {
    DailyTrackDefinition,
    DailyTrackLogEntry,
    DailyTrackTarget,
    FitnessDailyConfig,
    FitnessDailyLog,
    GuidedTrackStage,
    UserDailyTrack,
} from './types';

const normalizeExerciseName = (name: string): string =>
    name.trim().toLowerCase().replace(/\s+/g, ' ');

const STAGE_ORDER: GuidedTrackStage[] = ['assisted', 'bodyweight', 'weighted'];

const GUIDED_STAGE_TARGETS: Record<GuidedTrackStage, DailyTrackTarget> = {
    assisted: { sets: 4, reps: 5 },
    bodyweight: { sets: 5, reps: 5 },
    weighted: { sets: 5, reps: 5 },
};

export const DAILY_TRACK_LIBRARY: DailyTrackDefinition[] = [
    {
        id: 'leg-raises',
        exerciseName: 'Leg Raises',
        category: 'abs',
        metric: 'seconds',
        defaultTarget: { seconds: 600 },
        specializationKind: null,
    },
    {
        id: 'bicep-curls',
        exerciseName: 'Bicep Curls',
        category: 'arms',
        metric: 'seconds',
        defaultTarget: { seconds: 300 },
        specializationKind: null,
    },
    {
        id: 'dead-hang',
        exerciseName: 'Dead Hang',
        category: 'hang',
        metric: 'seconds',
        defaultTarget: { seconds: 180 },
        specializationKind: null,
    },
    {
        id: 'pullup',
        exerciseName: 'Pullup',
        category: 'pull',
        metric: 'sets_reps',
        defaultTarget: GUIDED_STAGE_TARGETS.assisted,
        specializationKind: 'pullup',
    },
    {
        id: 'dip',
        exerciseName: 'Dip',
        category: 'push',
        metric: 'sets_reps',
        defaultTarget: GUIDED_STAGE_TARGETS.assisted,
        specializationKind: 'dip',
    },
    {
        id: 'calf-raises',
        exerciseName: 'Calf Raises',
        category: 'legs',
        metric: 'reps',
        defaultTarget: { reps: 50 },
        specializationKind: null,
    },
    {
        id: 'hollow-hold',
        exerciseName: 'Hollow Hold',
        category: 'abs',
        metric: 'seconds',
        defaultTarget: { seconds: 180 },
        specializationKind: null,
    },
    {
        id: 'pushup',
        exerciseName: 'Pushup',
        category: 'push',
        metric: 'sets_reps',
        defaultTarget: { sets: 5, reps: 10 },
        specializationKind: null,
    },
];

const DAILY_TRACK_LIBRARY_MAP = new Map(
    DAILY_TRACK_LIBRARY.map((definition) => [normalizeExerciseName(definition.exerciseName), definition])
);

const LEGACY_TRACK_KEYS = {
    legRaises: 'legacy-leg-raises',
    armCurls: 'legacy-arm-curls',
    barHang: 'legacy-bar-hang',
} as const;

export const createUserDailyTrack = (
    exerciseName: string,
    sortOrder: number,
    now = Date.now()
): UserDailyTrack => {
    const normalizedName = normalizeExerciseName(exerciseName);
    const definition = DAILY_TRACK_LIBRARY_MAP.get(normalizedName);

    const inferred: DailyTrackDefinition = definition ?? inferDailyTrackDefinition(exerciseName);
    const stage: GuidedTrackStage | undefined = inferred.specializationKind ? 'assisted' : undefined;
    const target = inferred.specializationKind
        ? { ...GUIDED_STAGE_TARGETS.assisted }
        : { ...inferred.defaultTarget };

    return {
        id: `track-${normalizedName.replace(/[^a-z0-9]+/g, '-')}-${now}`,
        definitionId: inferred.id,
        exerciseName: inferred.exerciseName,
        category: inferred.category,
        metric: inferred.metric,
        target,
        specializationKind: inferred.specializationKind ?? null,
        stage,
        assistanceLabel: stage === 'assisted' ? 'Band or machine assist' : null,
        addedWeightKg: null,
        status: 'active',
        startedAt: now,
        sortOrder,
    };
};

export const inferDailyTrackDefinition = (exerciseName: string): DailyTrackDefinition => {
    const normalizedName = normalizeExerciseName(exerciseName);
    const fromLibrary = DAILY_TRACK_LIBRARY_MAP.get(normalizedName);
    if (fromLibrary) return fromLibrary;

    if (/(pullup|pull-up|pull up|chin up|chinup)/.test(normalizedName)) {
        return {
            id: normalizedName.replace(/\s+/g, '-'),
            exerciseName,
            category: 'pull',
            metric: 'sets_reps',
            defaultTarget: GUIDED_STAGE_TARGETS.assisted,
            specializationKind: 'pullup',
        };
    }

    if (/\bdip\b/.test(normalizedName)) {
        return {
            id: normalizedName.replace(/\s+/g, '-'),
            exerciseName,
            category: 'push',
            metric: 'sets_reps',
            defaultTarget: GUIDED_STAGE_TARGETS.assisted,
            specializationKind: 'dip',
        };
    }

    if (/(hang|hold|plank)/.test(normalizedName)) {
        return {
            id: normalizedName.replace(/\s+/g, '-'),
            exerciseName,
            category: normalizedName.includes('hang') ? 'hang' : 'mobility',
            metric: 'seconds',
            defaultTarget: { seconds: 180 },
            specializationKind: null,
        };
    }

    if (/(pushup|push-up|push up)/.test(normalizedName)) {
        return {
            id: normalizedName.replace(/\s+/g, '-'),
            exerciseName,
            category: 'push',
            metric: 'sets_reps',
            defaultTarget: { sets: 5, reps: 10 },
            specializationKind: null,
        };
    }

    if (/(raise|curl|extension|squat|lunge|calf)/.test(normalizedName)) {
        return {
            id: normalizedName.replace(/\s+/g, '-'),
            exerciseName,
            category: inferCategory(normalizedName),
            metric: 'reps',
            defaultTarget: { reps: 50 },
            specializationKind: null,
        };
    }

    return {
        id: normalizedName.replace(/\s+/g, '-'),
        exerciseName,
        category: inferCategory(normalizedName),
        metric: 'reps',
        defaultTarget: { reps: 30 },
        specializationKind: null,
    };
};

const inferCategory = (normalizedExerciseName: string): DailyTrackDefinition['category'] => {
    if (/(curl|tricep|bicep|arm)/.test(normalizedExerciseName)) return 'arms';
    if (/(hang)/.test(normalizedExerciseName)) return 'hang';
    if (/(pullup|pull-up|pull up|row|chin)/.test(normalizedExerciseName)) return 'pull';
    if (/(dip|pushup|push-up|push up|press)/.test(normalizedExerciseName)) return 'push';
    if (/(leg|calf|squat|lunge|deadlift|rdl)/.test(normalizedExerciseName)) return 'legs';
    if (/(hollow|sit-up|sit up|crunch|plank|raise|core|abs)/.test(normalizedExerciseName)) return 'abs';
    return 'mobility';
};

export const defaultFitnessDailyConfig = (userId: string, now = Date.now()): FitnessDailyConfig => ({
    userId,
    seasonLengthDays: 30,
    seasonStartedAt: now,
    activeTracks: [
        createUserDailyTrack('Leg Raises', 0, now),
        createUserDailyTrack('Bicep Curls', 1, now + 1),
        createUserDailyTrack('Dead Hang', 2, now + 2),
    ],
    updatedAt: now,
});

export const normalizeFitnessDailyConfig = (
    userId: string,
    partial?: Partial<FitnessDailyConfig> | null,
    now = Date.now()
): FitnessDailyConfig => {
    const fallback = defaultFitnessDailyConfig(userId, now);
    const activeTracks = (partial?.activeTracks ?? fallback.activeTracks)
        .map((track, index) => normalizeUserDailyTrack(track, index, now))
        .sort((a, b) => a.sortOrder - b.sortOrder);

    return {
        userId,
        seasonLengthDays: partial?.seasonLengthDays === 60 || partial?.seasonLengthDays === 90 ? partial.seasonLengthDays : fallback.seasonLengthDays,
        seasonStartedAt: partial?.seasonStartedAt ?? fallback.seasonStartedAt,
        activeTracks,
        updatedAt: partial?.updatedAt ?? now,
    };
};

export const normalizeUserDailyTrack = (
    track: Partial<UserDailyTrack>,
    sortOrder: number,
    now = Date.now()
): UserDailyTrack => {
    const exerciseName = track.exerciseName || 'Leg Raises';
    const inferred = inferDailyTrackDefinition(exerciseName);
    const stage = track.specializationKind || inferred.specializationKind
        ? track.stage ?? 'assisted'
        : undefined;

    return {
        id: track.id || `track-${sortOrder}-${now}`,
        definitionId: track.definitionId || inferred.id,
        exerciseName: inferred.exerciseName,
        category: track.category || inferred.category,
        metric: track.metric || inferred.metric,
        target: {
            ...(stage ? GUIDED_STAGE_TARGETS[stage] : inferred.defaultTarget),
            ...track.target,
        },
        specializationKind: track.specializationKind ?? inferred.specializationKind ?? null,
        stage,
        assistanceLabel: track.assistanceLabel ?? (stage === 'assisted' ? 'Band or machine assist' : null),
        addedWeightKg: track.addedWeightKg ?? (stage === 'weighted' ? 2.5 : null),
        status: track.status || 'active',
        startedAt: track.startedAt ?? now,
        sortOrder: track.sortOrder ?? sortOrder,
    };
};

export const normalizeFitnessDailyLog = (
    userId: string,
    date: string,
    config: FitnessDailyConfig,
    log?: Partial<FitnessDailyLog> | null
): FitnessDailyLog => {
    const baseEntries = config.activeTracks.map((track) => {
        const fromEntries = log?.entries?.find((entry) => entry.trackId === track.id);
        if (fromEntries) return normalizeDailyTrackLogEntry(track.id, fromEntries);

        const legacyEntry = mapLegacyTrackLog(track, log);
        if (legacyEntry) return legacyEntry;

        return normalizeDailyTrackLogEntry(track.id);
    });

    return {
        userId,
        date,
        entries: baseEntries,
        legRaisesDone: log?.legRaisesDone,
        armCurlsDone: log?.armCurlsDone,
        barHangDone: log?.barHangDone,
        completedAt: log?.completedAt ?? 0,
    };
};

export const normalizeDailyTrackLogEntry = (
    trackId: string,
    entry?: Partial<DailyTrackLogEntry> | null
): DailyTrackLogEntry => ({
    trackId,
    completed: !!entry?.completed,
    actualReps: entry?.actualReps,
    actualSeconds: entry?.actualSeconds,
    actualSets: entry?.actualSets,
    actualLoadKg: entry?.actualLoadKg,
    completedAt: entry?.completedAt,
});

const mapLegacyTrackLog = (
    track: UserDailyTrack,
    log?: Partial<FitnessDailyLog> | null
): DailyTrackLogEntry | null => {
    const normalizedName = normalizeExerciseName(track.exerciseName);
    if (normalizedName === 'leg raises' && log?.legRaisesDone) {
        return { trackId: track.id, completed: true, actualSeconds: 600, completedAt: log.completedAt };
    }
    if (normalizedName === 'bicep curls' && log?.armCurlsDone) {
        return { trackId: track.id, completed: true, actualSeconds: 300, completedAt: log.completedAt };
    }
    if (normalizedName === 'dead hang' && log?.barHangDone) {
        return { trackId: track.id, completed: true, actualSeconds: 180, completedAt: log.completedAt };
    }
    return null;
};

export const buildLegacyDailyFlags = (
    entries: DailyTrackLogEntry[] | undefined,
    tracks: UserDailyTrack[]
): Pick<FitnessDailyLog, 'legRaisesDone' | 'armCurlsDone' | 'barHangDone'> => {
    const lookup = new Map(entries?.map((entry) => [entry.trackId, entry.completed]) ?? []);
    return {
        legRaisesDone: tracks.some((track) => normalizeExerciseName(track.exerciseName) === 'leg raises' && lookup.get(track.id)),
        armCurlsDone: tracks.some((track) => normalizeExerciseName(track.exerciseName) === 'bicep curls' && lookup.get(track.id)),
        barHangDone: tracks.some((track) => normalizeExerciseName(track.exerciseName) === 'dead hang' && lookup.get(track.id)),
    };
};

export const getTrackEntry = (log: FitnessDailyLog | undefined, trackId: string): DailyTrackLogEntry =>
    normalizeDailyTrackLogEntry(trackId, log?.entries?.find((entry) => entry.trackId === trackId));

export const updateTrackEntry = (
    log: FitnessDailyLog,
    trackId: string,
    patch: Partial<DailyTrackLogEntry>
): FitnessDailyLog => {
    const currentEntries = log.entries ?? [];
    const hasEntry = currentEntries.some((entry) => entry.trackId === trackId);
    const nextEntries = hasEntry
        ? currentEntries.map((entry) => (
            entry.trackId === trackId
                ? { ...entry, ...patch, trackId }
                : entry
        ))
        : [...currentEntries, normalizeDailyTrackLogEntry(trackId, patch)];

    return {
        ...log,
        entries: nextEntries,
        completedAt: patch.completed ? Date.now() : log.completedAt,
    };
};

export const isDailyComplete = (log: FitnessDailyLog | undefined, config: FitnessDailyConfig): boolean => {
    if (!log || !log.entries) return false;
    const activeTracks = config.activeTracks.filter((track) => track.status === 'active');
    if (activeTracks.length === 0) return false;
    return activeTracks.every((track) => getTrackEntry(log, track.id).completed);
};

export const formatDailyTarget = (track: UserDailyTrack): string => {
    if (track.metric === 'seconds') {
        const seconds = track.target.seconds ?? 0;
        if (seconds % 60 === 0) return `${seconds / 60} min`;
        return `${seconds}s`;
    }

    if (track.metric === 'sets_reps') {
        return `${track.target.sets ?? 0} x ${track.target.reps ?? 0}`;
    }

    return `${track.target.reps ?? 0} reps`;
};

export const getSeasonSummary = (config: FitnessDailyConfig, now = Date.now()) => {
    const elapsedDays = Math.max(0, Math.floor((now - config.seasonStartedAt) / (24 * 60 * 60 * 1000)));
    const remainingDays = Math.max(0, config.seasonLengthDays - elapsedDays);
    const completionPct = Math.min(100, Math.round((elapsedDays / config.seasonLengthDays) * 100));
    return { elapsedDays, remainingDays, completionPct };
};

export const getGuidedStageLabel = (stage?: GuidedTrackStage): string => {
    if (stage === 'assisted') return 'Assisted';
    if (stage === 'bodyweight') return 'Bodyweight';
    if (stage === 'weighted') return 'Weighted';
    return 'Open';
};

export const setTrackStage = (track: UserDailyTrack, stage: GuidedTrackStage): UserDailyTrack => ({
    ...track,
    stage,
    target: { ...GUIDED_STAGE_TARGETS[stage], ...track.target },
    assistanceLabel: stage === 'assisted' ? (track.assistanceLabel || 'Band or machine assist') : null,
    addedWeightKg: stage === 'weighted' ? (track.addedWeightKg && track.addedWeightKg > 0 ? track.addedWeightKg : 2.5) : null,
});

export const applyGuidedRecommendation = (track: UserDailyTrack): UserDailyTrack => {
    if (!track.specializationKind || !track.stage) return track;
    if (track.stage === 'weighted') {
        return {
            ...track,
            addedWeightKg: (track.addedWeightKg && track.addedWeightKg > 0 ? track.addedWeightKg : 0) + 2.5,
        };
    }

    const currentIndex = STAGE_ORDER.indexOf(track.stage);
    const nextStage = STAGE_ORDER[currentIndex + 1];
    return nextStage ? setTrackStage(track, nextStage) : track;
};

export const getGuidedRecommendation = (
    track: UserDailyTrack,
    logs: Record<string, FitnessDailyLog>
): { title: string; detail: string; actionLabel: string } | null => {
    if (!track.specializationKind || !track.stage) return null;

    const recentEntries = Object.values(logs)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7)
        .map((log) => getTrackEntry(log, track.id))
        .filter((entry) => entry.completed);

    if (recentEntries.length < 4) return null;

    if (track.stage === 'assisted') {
        return {
            title: 'Ready to move to bodyweight',
            detail: `You have completed ${recentEntries.length} assisted sessions recently. Try the same target at bodyweight next.`,
            actionLabel: 'Advance to bodyweight',
        };
    }

    if (track.stage === 'bodyweight') {
        return {
            title: 'Ready to add load',
            detail: `You have hit your bodyweight target ${recentEntries.length} times recently. Start the weighted stage with a small load.`,
            actionLabel: 'Start weighted stage',
        };
    }

    return {
        title: 'Ready for more load',
        detail: `You have completed ${recentEntries.length} weighted sessions recently. Add a small load and keep the same rep target.`,
        actionLabel: 'Add 2.5 kg',
    };
};

export const getTrackCompletionCount = (
    logs: Record<string, FitnessDailyLog>,
    trackId: string,
    days = 7
): number => {
    return Object.values(logs)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, days)
        .reduce((count, log) => count + (getTrackEntry(log, trackId).completed ? 1 : 0), 0);
};

export const sortTracks = (tracks: UserDailyTrack[]): UserDailyTrack[] =>
    [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);

export const nextTrackSortOrder = (tracks: UserDailyTrack[]): number =>
    tracks.reduce((maxOrder, track) => Math.max(maxOrder, track.sortOrder), -1) + 1;

export const dedupeTracksByExerciseName = (tracks: UserDailyTrack[]): UserDailyTrack[] => {
    const seen = new Set<string>();
    return tracks.filter((track) => {
        const key = normalizeExerciseName(track.exerciseName);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export const getLegacyTrackKeys = () => LEGACY_TRACK_KEYS;
