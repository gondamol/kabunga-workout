import dayjs from 'dayjs';
import type { Exercise, ExerciseSet, WorkoutSession } from './types';

const getLoggedSets = (sets: ExerciseSet[]): ExerciseSet[] => {
    const completed = sets.filter((set) => set.completed);
    return completed.length > 0 ? completed : sets;
};

const getExerciseDisplayName = (exercise: Exercise): string => {
    return exercise.name.trim() || 'Unnamed exercise';
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

export const getWorkoutTopExercise = (workout: WorkoutSession): { name: string; volume: number } | null => {
    const ranked = workout.exercises
        .map((exercise) => ({
            name: getExerciseDisplayName(exercise),
            volume: getExerciseVolume(exercise),
        }))
        .sort((a, b) => b.volume - a.volume);

    if (ranked.length === 0) return null;
    return ranked[0];
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

export const generateWorkoutShareImage = async (
    workout: WorkoutSession,
    athleteName?: string | null
): Promise<Blob> => {
    if (typeof document === 'undefined') {
        throw new Error('Workout sharing is only available in the browser.');
    }

    if (document.fonts?.ready) await document.fonts.ready;

    const width = 1080;
    const height = 1350;
    const padding = 72;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create workout share image.');
    }

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

    const glowB = ctx.createRadialGradient(860, 1180, 20, 860, 1180, 340);
    glowB.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
    glowB.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, width, height);

    fillRoundedRect(ctx, padding, 72, 220, 52, 18, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = '#c7d2fe';
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillText('KABUNGA SESSION', padding + 26, 106);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 26px Inter, system-ui, sans-serif';
    const athleteLine = athleteName?.trim() ? `${athleteName.trim()} • ` : '';
    ctx.fillText(`${athleteLine}${dayjs(workout.startedAt).format('ddd, MMM D')}`, padding, 188);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 68px Inter, system-ui, sans-serif';
    wrapCanvasText(ctx, getWorkoutHeadline(workout, 3), padding, 278, width - padding * 2, 78, 2);

    const topExercise = getWorkoutTopExercise(workout);
    fillRoundedRect(ctx, padding, 402, width - padding * 2, 120, 28, 'rgba(255,255,255,0.05)');
    strokeRoundedRect(ctx, padding, 402, width - padding * 2, 120, 28, 'rgba(139,92,246,0.22)');
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillText('Top Lift', padding + 34, 448);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 38px Inter, system-ui, sans-serif';
    ctx.fillText(topExercise?.name || 'No lift data yet', padding + 34, 492);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText(
        topExercise && topExercise.volume > 0 ? `${Math.round(topExercise.volume)} kg·reps` : 'Bodyweight or timed focus',
        padding + 34,
        527
    );

    const metrics = [
        { label: 'Duration', value: formatMinutesAndHours(workout.duration), accent: '#22d3ee' },
        { label: 'Volume', value: `${Math.round(getWorkoutTotalVolume(workout))}`, sub: 'kg·reps', accent: '#8b5cf6' },
        { label: 'Sets', value: `${getWorkoutLoggedSetCount(workout)}`, sub: 'logged', accent: '#34d399' },
        { label: 'Calories', value: `${Math.round(workout.caloriesEstimate)}`, sub: 'kcal', accent: '#f59e0b' },
    ];

    const metricY = 578;
    const metricGap = 24;
    const metricWidth = (width - padding * 2 - metricGap) / 2;
    const metricHeight = 170;
    metrics.forEach((metric, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = padding + column * (metricWidth + metricGap);
        const y = metricY + row * (metricHeight + metricGap);
        fillRoundedRect(ctx, x, y, metricWidth, metricHeight, 28, 'rgba(255,255,255,0.05)');
        strokeRoundedRect(ctx, x, y, metricWidth, metricHeight, 28, 'rgba(255,255,255,0.08)');
        fillRoundedRect(ctx, x + 22, y + 22, 12, 12, 6, metric.accent);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 22px Inter, system-ui, sans-serif';
        ctx.fillText(metric.label.toUpperCase(), x + 48, y + 34);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '800 48px Inter, system-ui, sans-serif';
        ctx.fillText(metric.value, x + 24, y + 108);
        if (metric.sub) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '500 22px Inter, system-ui, sans-serif';
            ctx.fillText(metric.sub, x + 24, y + 140);
        }
    });

    const rows = getWorkoutExerciseSummaryRows(workout, 4);
    const rowCardY = 972;
    fillRoundedRect(ctx, padding, rowCardY, width - padding * 2, 260, 32, 'rgba(11, 18, 40, 0.86)');
    strokeRoundedRect(ctx, padding, rowCardY, width - padding * 2, 260, 32, 'rgba(6,182,212,0.18)');
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
        const rightText = row.volume > 0
            ? `${row.sets} sets • ${row.reps} reps • ${Math.round(row.volume)}`
            : `${row.sets} sets • ${row.reps} reps`;
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

export const shareWorkoutImage = async (
    workout: WorkoutSession,
    athleteName?: string | null
): Promise<'shared' | 'downloaded'> => {
    const blob = await generateWorkoutShareImage(workout, athleteName);
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

const formatMinutesAndHours = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};
