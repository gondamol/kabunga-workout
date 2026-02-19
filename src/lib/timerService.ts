/**
 * Timer Service — Rest timers, interval alarms, sound + vibration
 * PWA-safe: uses Web Audio API for sounds, Vibration API for haptics
 */

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

/** Play a beep sound — works in PWA without audio files */
export const playBeep = (frequency = 880, durationMs = 200, volume = 0.3) => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        osc.type = 'sine';
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
        // Audio not supported — silent
    }
};

/** Play a completion chime (3 ascending beeps) */
export const playCompletionChime = () => {
    playBeep(660, 150, 0.3);
    setTimeout(() => playBeep(880, 150, 0.3), 180);
    setTimeout(() => playBeep(1100, 250, 0.4), 360);
};

/** Play a countdown warning beep */
export const playCountdownBeep = () => {
    playBeep(440, 100, 0.2);
};

/** Play a final alarm (rest complete) */
export const playAlarm = () => {
    playBeep(1000, 300, 0.5);
    setTimeout(() => playBeep(1200, 300, 0.5), 350);
    setTimeout(() => playBeep(1000, 300, 0.5), 700);
};

/** Vibrate device (PWA-safe) */
export const vibrate = (pattern: number | number[] = 200) => {
    try {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    } catch {
        // Vibration not supported
    }
};

/** Short vibration for set completion */
export const vibrateSetComplete = () => vibrate([100, 50, 100]);

/** Long vibration for rest timer complete */
export const vibrateRestComplete = () => vibrate([200, 100, 200, 100, 300]);

/** Format seconds to MM:SS */
export const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ─── Progressive Overload Engine ───

export interface OverloadSuggestion {
    weight: number;
    reps: number;
    reason: string;
}

/**
 * Calculate progressive overload suggestion based on last sessions
 * Rules:
 * - Linear: If all planned reps hit → increase weight by smallestIncrement
 * - Double: Increase reps first, then weight when maxReps hit
 * - Maintenance: Keep same weight and reps
 */
export const getOverloadSuggestion = (
    exerciseName: string,
    lastSessions: Array<{ sets: Array<{ reps: number; weight: number; rpe?: number }> }>,
    plannedReps: number,
    progressionStyle: 'linear' | 'double' | 'maintenance' = 'linear',
    smallestIncrement = 2.5
): OverloadSuggestion | null => {
    if (lastSessions.length === 0) return null;

    const lastSession = lastSessions[0];
    if (!lastSession.sets.length) return null;

    // Find the working weight from last session (heaviest non-warmup set)
    const lastWeight = Math.max(...lastSession.sets.map(s => s.weight));
    const lastReps = lastSession.sets[lastSession.sets.length - 1]?.reps || plannedReps;
    const avgRpe = lastSession.sets
        .filter(s => s.rpe)
        .reduce((sum, s, _, arr) => sum + (s.rpe || 0) / arr.length, 0);

    if (progressionStyle === 'maintenance') {
        return { weight: lastWeight, reps: lastReps, reason: 'Maintaining current level' };
    }

    if (progressionStyle === 'double') {
        // If hit max reps (plannedReps + 2), increase weight and reset reps
        if (lastReps >= plannedReps + 2) {
            return {
                weight: lastWeight + smallestIncrement,
                reps: plannedReps,
                reason: `Hit ${lastReps} reps → increase weight`
            };
        }
        // Otherwise increase reps
        return {
            weight: lastWeight,
            reps: lastReps + 1,
            reason: `Building reps: ${lastReps} → ${lastReps + 1}`
        };
    }

    // Linear progression
    const allRepsHit = lastSession.sets.every(s => s.reps >= plannedReps);
    const effortOk = avgRpe === 0 || avgRpe <= 8; // RPE 8 or below means room to grow

    if (allRepsHit && effortOk) {
        return {
            weight: lastWeight + smallestIncrement,
            reps: plannedReps,
            reason: `All reps hit at ${lastWeight}kg → try ${lastWeight + smallestIncrement}kg`
        };
    }

    if (!allRepsHit) {
        return {
            weight: lastWeight,
            reps: plannedReps,
            reason: `Missed reps last time → stay at ${lastWeight}kg`
        };
    }

    // High RPE — keep same
    return {
        weight: lastWeight,
        reps: plannedReps,
        reason: `RPE was high (${avgRpe.toFixed(0)}) → stay at ${lastWeight}kg`
    };
};
