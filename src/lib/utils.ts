import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import type { WorkoutSession } from './types';

dayjs.extend(relativeTime);
dayjs.extend(duration);

export const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const formatDurationHuman = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

export const formatRelativeTime = (timestamp: number): string => {
    return dayjs(timestamp).fromNow();
};

export const formatDate = (timestamp: number, format = 'MMM D, YYYY'): string => {
    return dayjs(timestamp).format(format);
};

export const getTodayKey = (): string => dayjs().format('YYYY-MM-DD');

export const getWeekRange = () => {
    const start = dayjs().startOf('week');
    const end = dayjs().endOf('week');
    return { start: start.valueOf(), end: end.valueOf() };
};

export const getMonthRange = () => {
    const start = dayjs().startOf('month');
    const end = dayjs().endOf('month');
    return { start: start.valueOf(), end: end.valueOf() };
};

export const getDaysInRange = (days: number) => {
    return Array.from({ length: days }, (_, i) => {
        return dayjs().subtract(days - 1 - i, 'day').format('YYYY-MM-DD');
    });
};

export const compressImage = (file: Blob, maxWidth = 800, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const ratio = Math.min(maxWidth / img.width, 1);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
                'image/webp',
                quality
            );
        };
        img.onerror = reject;
        img.src = url;
    });
};

export const canShare = (): boolean => {
    return 'share' in navigator;
};

export const shareWorkout = async (text: string, url?: string) => {
    if (canShare()) {
        try {
            await navigator.share({ title: 'Kabunga Workout', text, url });
            return true;
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                await copyToClipboard(text);
            }
            return false;
        }
    } else {
        return copyToClipboard(text);
    }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
    }
};

export const generateWorkoutSummary = (workout: WorkoutSession): string => {
    const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const totalReps = workout.exercises.reduce(
        (sum, exercise) => sum + exercise.sets.reduce((setSum, setItem) => setSum + (setItem.reps || 0), 0),
        0
    );
    const totalVolume = workout.exercises.reduce(
        (sum, exercise) =>
            sum + exercise.sets.reduce((setSum, setItem) => setSum + ((setItem.weight || 0) * (setItem.reps || 0)), 0),
        0
    );

    const exerciseLines = workout.exercises
        .slice(0, 4)
        .map((exercise) => {
            const setCount = exercise.sets.length;
            const reps = exercise.sets.reduce((sum, setItem) => sum + (setItem.reps || 0), 0);
            const volume = exercise.sets.reduce((sum, setItem) => sum + ((setItem.weight || 0) * (setItem.reps || 0)), 0);
            return `- ${exercise.name}: ${setCount} sets, ${reps} reps, ${Math.round(volume)} volume`;
        })
        .join('\n');

    const extraExercises = workout.exercises.length > 4
        ? `\n- and ${workout.exercises.length - 4} more exercises finished strong`
        : '';

    const motivationalLine = 'Discipline is the quiet architecture of a stronger life. Show up, stack small victories, and become undeniable.';

    return [
        'Kabunga Session Complete.',
        '',
        `Duration: ${formatDurationHuman(workout.duration)}`,
        `Exercises: ${workout.exercises.length}`,
        `Sets: ${totalSets} | Reps: ${totalReps}`,
        `Volume: ${Math.round(totalVolume)} total`,
        `Calories: ~${workout.caloriesEstimate} kcal`,
        '',
        'Session Breakdown:',
        `${exerciseLines}${extraExercises}`,
        '',
        motivationalLine,
        '',
        '#Kabunga #WorkoutComplete #ProgressiveOverload #Strength #Hypertrophy',
    ].join('\n');
};
