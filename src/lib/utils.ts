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

const WORKOUT_QUOTES: Array<{ text: string; author: string }> = [
    { text: 'What stands in the way becomes the way.', author: 'Marcus Aurelius' },
    { text: 'You have power over your mind - not outside events.', author: 'Marcus Aurelius' },
    { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
    { text: 'Difficulties strengthen the mind, as labor does the body.', author: 'Seneca' },
    { text: 'First say to yourself what you would be; then do what you have to do.', author: 'Epictetus' },
    { text: 'No great thing is created suddenly.', author: 'Epictetus' },
    { text: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
    { text: 'Become who you are.', author: 'Friedrich Nietzsche' },
    { text: 'Amor fati: love your fate and make it your strength.', author: 'Friedrich Nietzsche' },
    { text: 'The individual has always had to struggle not to be overwhelmed by the tribe.', author: 'Friedrich Nietzsche' },
];

const pickWorkoutQuote = (workout: WorkoutSession): { text: string; author: string } => {
    const seed = `${workout.id}:${workout.startedAt}:${workout.endedAt ?? 0}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return WORKOUT_QUOTES[hash % WORKOUT_QUOTES.length];
};

export const generateWorkoutSummary = (workout: WorkoutSession): string => {
    const totalSets = workout.exercises.reduce((sum, exercise) => {
        const completedSets = exercise.sets.filter((setItem) => setItem.completed).length;
        return sum + (completedSets > 0 ? completedSets : exercise.sets.length);
    }, 0);
    const totalReps = workout.exercises.reduce(
        (sum, exercise) => sum + exercise.sets.reduce(
            (setSum, setItem) => setSum + (setItem.completed ? (setItem.reps || 0) : 0),
            0
        ),
        0
    );
    const totalVolume = workout.exercises.reduce(
        (sum, exercise) =>
            sum + exercise.sets.reduce(
                (setSum, setItem) => setSum + (setItem.completed ? ((setItem.weight || 0) * (setItem.reps || 0)) : 0),
                0
            ),
        0
    );

    const exerciseLines = workout.exercises
        .slice(0, 4)
        .map((exercise) => {
            const completedSets = exercise.sets.filter((setItem) => setItem.completed).length;
            const setCount = completedSets > 0 ? completedSets : exercise.sets.length;
            const reps = exercise.sets.reduce(
                (sum, setItem) => sum + (setItem.completed ? (setItem.reps || 0) : 0),
                0
            );
            const volume = exercise.sets.reduce(
                (sum, setItem) => sum + (setItem.completed ? ((setItem.weight || 0) * (setItem.reps || 0)) : 0),
                0
            );

            if (reps === 0 && volume === 0) {
                return `- ${exercise.name}: ${setCount} sets completed`;
            }
            if (volume === 0) {
                return `- ${exercise.name}: ${setCount} sets, ${reps} reps`;
            }
            return `- ${exercise.name}: ${setCount} sets, ${reps} reps, ${Math.round(volume)} volume`;
        })
        .join('\n');

    const extraExercises = workout.exercises.length > 4
        ? `\n- and ${workout.exercises.length - 4} more exercises finished strong`
        : '';

    const quote = pickWorkoutQuote(workout);
    const motivationalLine = `"${quote.text}" — ${quote.author}`;

    const note = workout.notes.trim();
    const noteLine = note.length > 0
        ? `Notes: ${note.length > 180 ? `${note.slice(0, 177)}...` : note}`
        : null;

    return [
        'Kabunga Session Complete.',
        '',
        `Duration: ${formatDurationHuman(workout.duration)}`,
        `Exercises: ${workout.exercises.length}`,
        `Sets: ${totalSets} | Reps: ${totalReps}`,
        totalVolume > 0 ? `Volume: ${Math.round(totalVolume)} total` : 'Volume: bodyweight/timed focus',
        `Calories: ~${workout.caloriesEstimate} kcal`,
        ...(noteLine ? [noteLine] : []),
        '',
        'Session Breakdown:',
        `${exerciseLines}${extraExercises}`,
        '',
        motivationalLine,
        '',
        '#Kabunga #WorkoutComplete #ProgressiveOverload #Strength #Hypertrophy',
    ].join('\n');
};
