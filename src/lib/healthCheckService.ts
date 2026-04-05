import dayjs from 'dayjs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { HealthCheck, ReadinessScore, ReadinessStatus, ReadinessTrendPoint } from './types';

const CHECKS_SUBCOLLECTION = 'checks';
const SUMMARIES_SUBCOLLECTION = 'summaries';

type ReadinessInput = Pick<HealthCheck, 'athleteId' | 'date' | 'sleepQuality' | 'soreness' | 'mood' | 'painNotes'> & {
    updatedAt?: number;
};

const normalizeOptionalNumber = (value: number | undefined): number | undefined => {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return undefined;
    return Number(value.toFixed(1));
};

const getStatusFromScore = (score: number): ReadinessStatus => {
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'moderate';
    return 'poor';
};

const getDb = async () => (await import('./firebase')).db;

export const calculateReadinessScore = (input: ReadinessInput): ReadinessScore => {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let score = 10;

    if (input.sleepQuality <= 2) {
        score -= 3;
        warnings.push('Low sleep quality reported');
        recommendations.push('Reduce intensity or trim accessory volume today.');
    }

    if (input.soreness >= 8) {
        score -= 2;
        warnings.push('High soreness reported');
        recommendations.push('Extend your warm-up and consider lowering total volume.');
    }

    if (input.mood === 'tired') {
        score -= 1;
        recommendations.push('Keep early sets controlled and reassess energy mid-session.');
    }

    if ((input.painNotes || '').trim().length > 0) {
        score -= 2;
        warnings.push('Pain or injury reported');
        recommendations.push('Modify painful movements and prioritize recovery.');
    }

    const finalScore = Math.max(1, score);

    if (warnings.length === 0) {
        recommendations.push('Proceed with your planned session and normal recovery habits.');
    }

    return {
        athleteId: input.athleteId,
        date: input.date,
        score: finalScore,
        status: getStatusFromScore(finalScore),
        warnings,
        recommendations,
        updatedAt: input.updatedAt ?? Date.now(),
    };
};

export const buildWeeklyReadinessTrend = (
    startDate: string,
    readinessByDate: Record<string, ReadinessScore | null>
): ReadinessTrendPoint[] => {
    return Array.from({ length: 7 }, (_, offset) => {
        const date = dayjs(startDate).add(offset, 'day').format('YYYY-MM-DD');
        const readiness = readinessByDate[date] ?? null;
        return {
            date,
            score: readiness?.score ?? null,
            status: readiness?.status ?? null,
        };
    });
};

export const getHealthCheck = async (athleteId: string, date: string): Promise<HealthCheck | null> => {
    const db = await getDb();
    const snap = await getDoc(doc(db, 'athleteHealthFlags', athleteId, CHECKS_SUBCOLLECTION, date));
    if (!snap.exists()) return null;
    return snap.data() as HealthCheck;
};

const normalizeHealthCheck = (
    check: HealthCheck,
    createdAt: number,
    updatedAt: number
): HealthCheck => {
    const painNotes = (check.painNotes || '').trim();

    return {
        athleteId: check.athleteId,
        date: check.date,
        sleepQuality: check.sleepQuality,
        soreness: check.soreness,
        mood: check.mood,
        bodyWeightKg: normalizeOptionalNumber(check.bodyWeightKg),
        bodyFatPercent: normalizeOptionalNumber(check.bodyFatPercent),
        painNotes: painNotes.length > 0 ? painNotes : null,
        createdAt,
        updatedAt,
    };
};

export const saveHealthCheck = async (check: HealthCheck): Promise<void> => {
    const existing = await getHealthCheck(check.athleteId, check.date);
    const now = Date.now();
    const db = await getDb();
    const normalizedCheck = normalizeHealthCheck(check, existing?.createdAt ?? now, now);
    const readiness = calculateReadinessScore({
        athleteId: normalizedCheck.athleteId,
        date: normalizedCheck.date,
        sleepQuality: normalizedCheck.sleepQuality,
        soreness: normalizedCheck.soreness,
        mood: normalizedCheck.mood,
        painNotes: normalizedCheck.painNotes,
        updatedAt: now,
    });

    await Promise.all([
        setDoc(doc(db, 'athleteHealthFlags', normalizedCheck.athleteId, CHECKS_SUBCOLLECTION, normalizedCheck.date), normalizedCheck),
        setDoc(doc(db, 'athleteHealthFlags', normalizedCheck.athleteId, SUMMARIES_SUBCOLLECTION, normalizedCheck.date), readiness),
    ]);
};

export const getAthleteReadiness = async (
    athleteId: string,
    date: string
): Promise<ReadinessScore | null> => {
    const db = await getDb();
    const summarySnap = await getDoc(doc(db, 'athleteHealthFlags', athleteId, SUMMARIES_SUBCOLLECTION, date));
    if (summarySnap.exists()) {
        return summarySnap.data() as ReadinessScore;
    }

    const rawCheck = await getHealthCheck(athleteId, date);
    if (!rawCheck) return null;

    const readiness = calculateReadinessScore({
        athleteId: rawCheck.athleteId,
        date: rawCheck.date,
        sleepQuality: rawCheck.sleepQuality,
        soreness: rawCheck.soreness,
        mood: rawCheck.mood,
        painNotes: rawCheck.painNotes,
        updatedAt: rawCheck.updatedAt,
    });

    await setDoc(doc(db, 'athleteHealthFlags', athleteId, SUMMARIES_SUBCOLLECTION, date), readiness, { merge: true });
    return readiness;
};

export const getWeeklyReadinessTrend = async (
    athleteId: string,
    startDate: string
): Promise<ReadinessTrendPoint[]> => {
    const days = Array.from({ length: 7 }, (_, offset) =>
        dayjs(startDate).add(offset, 'day').format('YYYY-MM-DD')
    );

    const summaries = await Promise.all(
        days.map(async (date) => {
            const readiness = await getAthleteReadiness(athleteId, date);
            return [date, readiness] as const;
        })
    );

    return buildWeeklyReadinessTrend(startDate, Object.fromEntries(summaries));
};
