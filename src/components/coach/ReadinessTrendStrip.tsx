import dayjs from 'dayjs';
import type { ReadinessStatus } from '../../lib/types';

type TrendPoint = {
    date: string;
    score: number | null;
    status: ReadinessStatus | null;
};

type ReadinessTrendStripProps = {
    points: TrendPoint[];
    helper?: string;
};

const TONE: Record<string, string> = {
    excellent: 'border-green/30 bg-green/10 text-green',
    good: 'border-cyan/30 bg-cyan/10 text-cyan',
    moderate: 'border-amber/30 bg-amber/10 text-amber',
    poor: 'border-red/30 bg-red/10 text-red',
    none: 'border-border bg-bg-card text-text-muted',
};

export function ReadinessTrendStrip({ points, helper }: ReadinessTrendStripProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-text-secondary">Last 7 days</p>
                {helper && <p className="text-[11px] text-text-muted">{helper}</p>}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {points.map((point) => {
                    const tone = TONE[point.status ?? 'none'];
                    return (
                        <div
                            key={point.date}
                            className={`rounded-xl border px-2 py-2.5 text-center ${tone}`}
                            aria-label={`${dayjs(point.date).format('ddd')}: ${point.score ?? 'no check-in'}`}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{dayjs(point.date).format('dd')}</p>
                            <p className="text-sm font-extrabold mt-0.5">{point.score ?? '—'}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
