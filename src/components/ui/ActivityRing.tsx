import { cx } from './utils';

type ActivityRingTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger';

type ActivityRingItem = {
    value: number;
    max: number;
    label: string;
    tone?: ActivityRingTone;
};

type ActivityRingProps = {
    rings: ActivityRingItem[];
    size?: number;
    centerLabel?: string;
    centerValue?: string;
    className?: string;
};

const toneClasses: Record<ActivityRingTone, string> = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
    accent: 'text-amber',
    danger: 'text-danger',
};

export function ActivityRing({ rings, size = 148, centerLabel, centerValue, className }: ActivityRingProps) {
    const strokeWidth = 7;
    const safeRings = rings.slice(0, 4);

    return (
        <div
            className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
            style={{ width: size, height: size }}
            role="img"
            aria-label={safeRings.map((ring) => `${ring.label}: ${Math.round((ring.value / ring.max) * 100)}%`).join(', ')}
        >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                {safeRings.map((ring, index) => {
                    const radius = 45 - index * 9;
                    const circumference = 2 * Math.PI * radius;
                    const normalized = Math.max(0, Math.min(1, ring.max > 0 ? ring.value / ring.max : 0));
                    return (
                        <g key={ring.label} className={toneClasses[ring.tone ?? 'secondary']}>
                            <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                strokeOpacity="0.13"
                                strokeWidth={strokeWidth}
                            />
                            <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference - normalized * circumference}
                                className="transition-[stroke-dashoffset] duration-700 ease-out"
                            />
                        </g>
                    );
                })}
            </svg>
            <div className="relative z-10 text-center">
                {centerValue && <div className="font-display text-3xl font-extrabold text-text-primary">{centerValue}</div>}
                {centerLabel && <div className="text-[0.68rem] font-bold uppercase text-text-muted">{centerLabel}</div>}
            </div>
        </div>
    );
}

