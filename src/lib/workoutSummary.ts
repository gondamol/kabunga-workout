import dayjs from 'dayjs';
import type { Exercise, ExerciseSet, WorkoutSession } from './types';
import { formatDurationHuman } from './utils';
import { formatEffortValue, formatSetPerformance, hasExternalLoad } from './exerciseRules';

const getLoggedSets = (sets: ExerciseSet[]): ExerciseSet[] => {
    const completed = sets.filter((set) => set.completed);
    return completed.length > 0 ? completed : sets;
};

const getExerciseDisplayName = (exercise: Exercise): string => {
    return exercise.name.trim() || 'Unnamed exercise';
};

const normalizeExerciseName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

const getSetScore = (setItem: Pick<ExerciseSet, 'reps' | 'weight'>): number => {
    if (hasExternalLoad(setItem.weight)) return (setItem.weight || 0) * (setItem.reps || 0);
    return setItem.reps || 0;
};

export const getWorkoutHeadline = (workout: WorkoutSession, maxNames = 3): string => {
    const names: string[] = [];
    const seen = new Set<string>();

    for (const exercise of workout.exercises) {
        const name = getExerciseDisplayName(exercise);
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
    }

    if (names.length === 0) return 'Quick Session';
    if (names.length <= maxNames) return names.join(', ');
    return `${names.slice(0, maxNames).join(', ')} +${names.length - maxNames}`;
};

export const getWorkoutTotalSets = (workout: WorkoutSession): number => {
    return workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
};

export const getWorkoutLoggedSetCount = (workout: WorkoutSession): number => {
    return workout.exercises.reduce((sum, exercise) => sum + getLoggedSets(exercise.sets).length, 0);
};

export const getWorkoutTotalReps = (workout: WorkoutSession): number => {
    return workout.exercises.reduce((sum, exercise) => {
        return sum + getLoggedSets(exercise.sets).reduce((setSum, setItem) => setSum + (setItem.reps || 0), 0);
    }, 0);
};

export const getExerciseVolume = (exercise: Exercise): number => {
    return getLoggedSets(exercise.sets).reduce((sum, setItem) => sum + (setItem.weight || 0) * (setItem.reps || 0), 0);
};

export const getWorkoutTotalVolume = (workout: WorkoutSession): number => {
    return workout.exercises.reduce((sum, exercise) => sum + getExerciseVolume(exercise), 0);
};

export const getWorkoutTopExercise = (
    workout: WorkoutSession
): { name: string; volume: number; reps: number; metric: 'volume' | 'reps' } | null => {
    const ranked = workout.exercises
        .map((exercise) => ({
            name: getExerciseDisplayName(exercise),
            volume: getExerciseVolume(exercise),
            reps: getLoggedSets(exercise.sets).reduce((sum, setItem) => sum + (setItem.reps || 0), 0),
        }))
        .sort((a, b) => (
            Math.max(b.volume, b.reps) - Math.max(a.volume, a.reps)
            || b.volume - a.volume
            || b.reps - a.reps
        ));

    if (ranked.length === 0) return null;
    return {
        name: ranked[0].name,
        volume: ranked[0].volume,
        reps: ranked[0].reps,
        metric: ranked[0].volume > 0 ? 'volume' : 'reps',
    };
};

export const getWorkoutExerciseSummaryRows = (
    workout: WorkoutSession,
    maxRows = 4
): Array<{ name: string; sets: number; reps: number; volume: number }> => {
    return workout.exercises.slice(0, maxRows).map((exercise) => {
        const loggedSets = getLoggedSets(exercise.sets);
        return {
            name: getExerciseDisplayName(exercise),
            sets: loggedSets.length,
            reps: loggedSets.reduce((sum, setItem) => sum + (setItem.reps || 0), 0),
            volume: loggedSets.reduce((sum, setItem) => sum + (setItem.weight || 0) * (setItem.reps || 0), 0),
        };
    });
};

export const getWorkoutBestSet = (
    workout: WorkoutSession
): { exerciseName: string; reps: number; weight: number; score: number } | null => {
    let best: { exerciseName: string; reps: number; weight: number; score: number } | null = null;

    for (const exercise of workout.exercises) {
        for (const setItem of getLoggedSets(exercise.sets)) {
            const score = getSetScore(setItem);
            if (!best || score > best.score || (score === best.score && setItem.weight > best.weight)) {
                best = {
                    exerciseName: getExerciseDisplayName(exercise),
                    reps: setItem.reps,
                    weight: setItem.weight,
                    score,
                };
            }
        }
    }

    return best;
};

export const getWorkoutPersonalBestBadges = (
    workout: WorkoutSession,
    previousWorkouts: WorkoutSession[],
    limit = 3
): string[] => {
    const badges: Array<{ label: string; score: number }> = [];

    for (const exercise of workout.exercises) {
        const exerciseName = getExerciseDisplayName(exercise);
        const currentBest = getLoggedSets(exercise.sets).reduce((best, setItem) => {
            return Math.max(best, getSetScore(setItem));
        }, 0);

        if (currentBest <= 0) continue;

        const historicalBest = previousWorkouts.reduce((best, previousWorkout) => {
            if (previousWorkout.id === workout.id) return best;

            const matchingExercises = previousWorkout.exercises.filter((item) => (
                normalizeExerciseName(item.name) === normalizeExerciseName(exerciseName)
            ));

            const workoutBest = matchingExercises.reduce((exerciseBest, item) => {
                return Math.max(
                    exerciseBest,
                    getLoggedSets(item.sets).reduce((setBest, setItem) => Math.max(setBest, getSetScore(setItem)), 0)
                );
            }, 0);

            return Math.max(best, workoutBest);
        }, 0);

        if (historicalBest > 0 && currentBest > historicalBest) {
            badges.push({ label: `${exerciseName} PR`, score: currentBest });
        }
    }

    return badges
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((badge) => badge.label);
};

const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
): void => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
};

const fillRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillStyle: string
): void => {
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = fillStyle;
    ctx.fill();
};

const strokeRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    strokeStyle: string
): void => {
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
};

const wrapCanvasText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number
): number => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const { width } = ctx.measureText(testLine);
        if (width <= maxWidth) {
            currentLine = testLine;
            continue;
        }
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        if (lines.length === maxLines - 1) break;
    }

    if (currentLine) lines.push(currentLine);

    const visibleLines = lines.slice(0, maxLines).map((line, index) => {
        if (index < maxLines - 1 || lines.length <= maxLines) return line;
        let trimmed = line;
        while (trimmed.length > 0 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
            trimmed = trimmed.slice(0, -1).trimEnd();
        }
        return `${trimmed}...`;
    });

    visibleLines.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
    });

    return visibleLines.length;
};

const canvasToBlob = async (canvas: HTMLCanvasElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            reject(new Error('Failed to create workout share image.'));
        }, 'image/png');
    });
};

const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const drawShareBackground = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): void => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#090b1d');
    gradient.addColorStop(0.45, '#12163a');
    gradient.addColorStop(1, '#08111c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const glowA = ctx.createRadialGradient(220, 170, 20, 220, 170, 280);
    glowA.addColorStop(0, 'rgba(139, 92, 246, 0.34)');
    glowA.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, width, height);

    const glowB = ctx.createRadialGradient(860, height - 220, 20, 860, height - 220, 340);
    glowB.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
    glowB.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, width, height);
};

const drawMetricCards = (
    ctx: CanvasRenderingContext2D,
    metrics: Array<{ label: string; value: string; sub?: string; accent: string }>,
    startY: number,
    width: number,
    padding: number
): void => {
    const metricGap = 24;
    const metricWidth = (width - padding * 2 - metricGap) / 2;
    const metricHeight = 160;
    metrics.forEach((metric, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = padding + column * (metricWidth + metricGap);
        const y = startY + row * (metricHeight + metricGap);
        fillRoundedRect(ctx, x, y, metricWidth, metricHeight, 28, 'rgba(255,255,255,0.05)');
        strokeRoundedRect(ctx, x, y, metricWidth, metricHeight, 28, 'rgba(255,255,255,0.08)');
        fillRoundedRect(ctx, x + 22, y + 22, 12, 12, 6, metric.accent);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 22px Inter, system-ui, sans-serif';
        ctx.fillText(metric.label.toUpperCase(), x + 48, y + 34);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '800 48px Inter, system-ui, sans-serif';
        ctx.fillText(metric.value, x + 24, y + 102);
        if (metric.sub) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '500 22px Inter, system-ui, sans-serif';
            ctx.fillText(metric.sub, x + 24, y + 134);
        }
    });
};

const formatBestSetCallout = (
    bestSet: { exerciseName: string; reps: number; weight: number } | null
): string => {
    if (!bestSet) return 'Best set not available';
    return `${bestSet.exerciseName} • ${formatSetPerformance(bestSet.weight, bestSet.reps)}`;
};

interface SessionShareImageOptions {
    athleteName?: string | null;
    previousWorkouts?: WorkoutSession[];
}

interface PeriodShareImageOptions {
    athleteName?: string | null;
    periodLabel: string;
    title: string;
    subtitle: string;
    filenameLabel: string;
}

export const generateWorkoutShareImage = async (
    workout: WorkoutSession,
    options: SessionShareImageOptions = {}
): Promise<Blob> => {
    if (typeof document === 'undefined') {
        throw new Error('Workout sharing is only available in the browser.');
    }

    if (document.fonts?.ready) await document.fonts.ready;

    const width = 1080;
    const height = 1500;
    const padding = 72;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create workout share image.');
    }

    drawShareBackground(ctx, width, height);

    fillRoundedRect(ctx, padding, 72, 220, 52, 18, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = '#c7d2fe';
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillText('KABUNGA SESSION', padding + 26, 106);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 26px Inter, system-ui, sans-serif';
    const athleteLine = options.athleteName?.trim() ? `${options.athleteName.trim()} • ` : '';
    ctx.fillText(`${athleteLine}${dayjs(workout.startedAt).format('ddd, MMM D')}`, padding, 188);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 68px Inter, system-ui, sans-serif';
    wrapCanvasText(ctx, getWorkoutHeadline(workout, 3), padding, 278, width - padding * 2, 78, 2);

    const badges = options.previousWorkouts ? getWorkoutPersonalBestBadges(workout, options.previousWorkouts) : [];
    let chipX = padding;
    if (badges.length > 0) {
        ctx.font = '700 22px Inter, system-ui, sans-serif';
        badges.forEach((badge) => {
            const chipWidth = Math.min(320, ctx.measureText(badge).width + 44);
            fillRoundedRect(ctx, chipX, 406, chipWidth, 48, 18, 'rgba(52, 211, 153, 0.15)');
            strokeRoundedRect(ctx, chipX, 406, chipWidth, 48, 18, 'rgba(52, 211, 153, 0.28)');
            ctx.fillStyle = '#6ee7b7';
            ctx.fillText(badge, chipX + 22, 437);
            chipX += chipWidth + 14;
        });
    }

    const topExercise = getWorkoutTopExercise(workout);
    const totalEffort = formatEffortValue(getWorkoutTotalVolume(workout), getWorkoutTotalReps(workout));
    const highlightCardY = badges.length > 0 ? 478 : 402;
    fillRoundedRect(ctx, padding, highlightCardY, width - padding * 2, 110, 28, 'rgba(255,255,255,0.05)');
    strokeRoundedRect(ctx, padding, highlightCardY, width - padding * 2, 110, 28, 'rgba(139,92,246,0.22)');
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillText(topExercise?.metric === 'reps' ? 'Top Movement' : 'Top Lift', padding + 34, highlightCardY + 38);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 38px Inter, system-ui, sans-serif';
    ctx.fillText(topExercise?.name || 'No lift data yet', padding + 34, highlightCardY + 82);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText(
        topExercise
            ? (topExercise.metric === 'volume'
                ? `${Math.round(topExercise.volume)} kg·reps`
                : `${topExercise.reps} reps`)
            : 'Bodyweight or timed focus',
        padding + 34,
        highlightCardY + 104
    );

    const bestSet = getWorkoutBestSet(workout);
    fillRoundedRect(ctx, padding, highlightCardY + 136, width - padding * 2, 78, 24, 'rgba(6,182,212,0.10)');
    strokeRoundedRect(ctx, padding, highlightCardY + 136, width - padding * 2, 78, 24, 'rgba(6,182,212,0.18)');
    ctx.fillStyle = '#67e8f9';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.fillText('Best Set Callout', padding + 28, highlightCardY + 166);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillText(formatBestSetCallout(bestSet), padding + 28, highlightCardY + 198);

    const metrics = [
        { label: 'Duration', value: formatMinutesAndHours(workout.duration), accent: '#22d3ee' },
        { label: totalEffort.unit === 'kg·reps' ? 'Volume' : 'Reps', value: totalEffort.value, sub: totalEffort.unit, accent: '#8b5cf6' },
        { label: 'Sets', value: `${getWorkoutLoggedSetCount(workout)}`, sub: 'logged', accent: '#34d399' },
        { label: 'Calories', value: `${Math.round(workout.caloriesEstimate)}`, sub: 'kcal', accent: '#f59e0b' },
    ];
    const metricY = highlightCardY + 246;
    drawMetricCards(ctx, metrics, metricY, width, padding);

    const rows = getWorkoutExerciseSummaryRows(workout, 4);
    const rowCardY = metricY + 348;
    fillRoundedRect(ctx, padding, rowCardY, width - padding * 2, 280, 32, 'rgba(11, 18, 40, 0.86)');
    strokeRoundedRect(ctx, padding, rowCardY, width - padding * 2, 280, 32, 'rgba(6,182,212,0.18)');
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText('Session Breakdown', padding + 34, rowCardY + 42);

    rows.forEach((row, index) => {
        const y = rowCardY + 92 + index * 42;
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        ctx.arc(padding + 26, y - 7, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 24px Inter, system-ui, sans-serif';
        ctx.fillText(row.name, padding + 44, y);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 20px Inter, system-ui, sans-serif';
        const effort = formatEffortValue(row.volume, row.reps);
        const rightText = `${row.sets} sets • ${row.reps} reps${effort.unit === 'kg·reps' ? ` • ${effort.value}` : ''}`;
        ctx.textAlign = 'right';
        ctx.fillText(rightText, width - padding - 34, y);
        ctx.textAlign = 'left';
    });

    const totalReps = getWorkoutTotalReps(workout);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 22px Inter, system-ui, sans-serif';
    ctx.fillText(
        `${workout.exercises.length} exercises • ${getWorkoutLoggedSetCount(workout)} sets • ${totalReps} reps`,
        padding,
        height - 72
    );
    ctx.textAlign = 'right';
    ctx.fillText('kabunga-workout.vercel.app', width - padding, height - 72);
    ctx.textAlign = 'left';

    return canvasToBlob(canvas);
};

const buildPeriodSummary = (workouts: WorkoutSession[]) => {
    const activeDays = new Set(workouts.map((workout) => dayjs(workout.startedAt).format('YYYY-MM-DD')));
    const totalDuration = workouts.reduce((sum, workout) => sum + workout.duration, 0);
    const totalVolume = workouts.reduce((sum, workout) => sum + getWorkoutTotalVolume(workout), 0);
    const totalReps = workouts.reduce((sum, workout) => sum + getWorkoutTotalReps(workout), 0);
    const totalCalories = workouts.reduce((sum, workout) => sum + workout.caloriesEstimate, 0);
    const topExerciseVolume = new Map<string, { volume: number; reps: number }>();

    for (const workout of workouts) {
        for (const row of getWorkoutExerciseSummaryRows(workout, workout.exercises.length)) {
            const current = topExerciseVolume.get(row.name) || { volume: 0, reps: 0 };
            topExerciseVolume.set(row.name, {
                volume: current.volume + row.volume,
                reps: current.reps + row.reps,
            });
        }
    }

    const topExercise = Array.from(topExerciseVolume.entries())
        .map(([name, values]) => ({
            name,
            volume: values.volume,
            reps: values.reps,
            metric: values.volume > 0 ? 'volume' as const : 'reps' as const,
            score: values.volume > 0 ? values.volume : values.reps,
        }))
        .sort((a, b) => b.score - a.score || b.volume - a.volume || b.reps - a.reps)[0] || null;

    return {
        activeDays: activeDays.size,
        totalDuration,
        totalVolume: Math.round(totalVolume),
        totalReps,
        totalCalories: Math.round(totalCalories),
        topExercise,
        recentHeadlines: workouts.slice(0, 3).map((workout) => ({
            title: getWorkoutHeadline(workout, 2),
            detail: `${formatDurationHuman(workout.duration)} • ${dayjs(workout.startedAt).format('MMM D')}`,
        })),
    };
};

export const generateWorkoutPeriodShareImage = async (
    workouts: WorkoutSession[],
    options: PeriodShareImageOptions
): Promise<Blob> => {
    if (typeof document === 'undefined') {
        throw new Error('Workout sharing is only available in the browser.');
    }

    if (document.fonts?.ready) await document.fonts.ready;

    const width = 1080;
    const height = 1420;
    const padding = 72;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create workout period share image.');
    }

    drawShareBackground(ctx, width, height);

    fillRoundedRect(ctx, padding, 72, 240, 52, 18, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = '#c7d2fe';
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillText(options.periodLabel.toUpperCase(), padding + 26, 106);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 26px Inter, system-ui, sans-serif';
    const athleteLine = options.athleteName?.trim() ? `${options.athleteName.trim()} • ` : '';
    ctx.fillText(`${athleteLine}${options.subtitle}`, padding, 188);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 68px Inter, system-ui, sans-serif';
    wrapCanvasText(ctx, options.title, padding, 278, width - padding * 2, 78, 2);

    const summary = buildPeriodSummary(workouts);
    const totalEffort = formatEffortValue(summary.totalVolume, summary.totalReps);
    const metrics = [
        { label: 'Workouts', value: `${workouts.length}`, sub: 'completed', accent: '#8b5cf6' },
        { label: 'Active Days', value: `${summary.activeDays}`, sub: 'days', accent: '#22d3ee' },
        { label: 'Total Time', value: formatMinutesAndHours(summary.totalDuration), sub: 'training', accent: '#34d399' },
        { label: totalEffort.unit === 'kg·reps' ? 'Volume' : 'Reps', value: totalEffort.value, sub: totalEffort.unit, accent: '#f59e0b' },
    ];
    drawMetricCards(ctx, metrics, 390, width, padding);

    fillRoundedRect(ctx, padding, 738, width - padding * 2, 116, 28, 'rgba(255,255,255,0.05)');
    strokeRoundedRect(ctx, padding, 738, width - padding * 2, 116, 28, 'rgba(139,92,246,0.22)');
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillText(summary.topExercise?.metric === 'reps' ? 'Top Movement This Period' : 'Top Lift This Period', padding + 34, 784);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 38px Inter, system-ui, sans-serif';
    ctx.fillText(summary.topExercise?.name || 'No lift data yet', padding + 34, 828);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText(
        summary.topExercise
            ? (summary.topExercise.metric === 'volume'
                ? `${Math.round(summary.topExercise.volume)} kg·reps`
                : `${summary.topExercise.reps} reps`)
            : `${summary.totalCalories} kcal estimated`,
        padding + 34,
        860
    );

    fillRoundedRect(ctx, padding, 900, width - padding * 2, 280, 32, 'rgba(11, 18, 40, 0.86)');
    strokeRoundedRect(ctx, padding, 900, width - padding * 2, 280, 32, 'rgba(6,182,212,0.18)');
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText('Recent Sessions', padding + 34, 942);

    summary.recentHeadlines.forEach((headline, index) => {
        const y = 1002 + index * 62;
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        ctx.arc(padding + 26, y - 7, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 24px Inter, system-ui, sans-serif';
        ctx.fillText(headline.title, padding + 44, y);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 20px Inter, system-ui, sans-serif';
        ctx.fillText(headline.detail, padding + 44, y + 26);
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '500 22px Inter, system-ui, sans-serif';
    ctx.fillText(`${summary.totalCalories} kcal estimated`, padding, height - 72);
    ctx.textAlign = 'right';
    ctx.fillText('kabunga-workout.vercel.app', width - padding, height - 72);
    ctx.textAlign = 'left';

    return canvasToBlob(canvas);
};

export const shareWorkoutImage = async (
    workout: WorkoutSession,
    options: SessionShareImageOptions = {}
): Promise<'shared' | 'downloaded'> => {
    const blob = await generateWorkoutShareImage(workout, options);
    const filename = `kabunga-session-${dayjs(workout.startedAt).format('YYYY-MM-DD-HHmm')}.png`;
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

    if (typeof File !== 'undefined' && typeof nav.share === 'function') {
        const file = new File([blob], filename, { type: 'image/png' });
        if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
            await nav.share({
                title: 'Kabunga Workout',
                text: getWorkoutHeadline(workout),
                files: [file],
            });
            return 'shared';
        }
    }

    downloadBlob(blob, filename);
    return 'downloaded';
};

export const shareWorkoutPeriodImage = async (
    workouts: WorkoutSession[],
    options: PeriodShareImageOptions
): Promise<'shared' | 'downloaded'> => {
    const blob = await generateWorkoutPeriodShareImage(workouts, options);
    const filename = `kabunga-${options.filenameLabel}-${dayjs().format('YYYY-MM-DD')}.png`;
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

    if (typeof File !== 'undefined' && typeof nav.share === 'function') {
        const file = new File([blob], filename, { type: 'image/png' });
        if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
            await nav.share({
                title: `Kabunga ${options.periodLabel}`,
                text: options.title,
                files: [file],
            });
            return 'shared';
        }
    }

    downloadBlob(blob, filename);
    return 'downloaded';
};

const formatMinutesAndHours = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};
