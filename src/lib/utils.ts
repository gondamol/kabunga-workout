import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';

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

export const generateWorkoutSummary = (
    duration: number,
    exerciseCount: number,
    totalSets: number,
    calories: number,
): string => {
    return `💪 Just crushed it with Kabunga!\n\n⏱ Duration: ${formatDurationHuman(duration)}\n🏋️ Exercises: ${exerciseCount}\n📊 Total Sets: ${totalSets}\n🔥 Calories: ~${calories} kcal\n\n#KabungaWorkout #FitnessGoals`;
};
