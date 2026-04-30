import { cx } from './utils';

type MiniActivityRingProps = {
    size?: number;
    /** outer ring (Move) — 0–100 */
    outer?: number;
    /** middle ring (Exercise) — 0–100 */
    middle?: number;
    /** inner ring (Stand) — 0–100 */
    inner?: number;
    /** Render as an empty placeholder when no activity yet */
    empty?: boolean;
    className?: string;
    /** Highlight as today (drawn ring around outside) */
    isToday?: boolean;
    label?: string;
};

const OUTER = '#3aa84d'; // Move (green)
const MIDDLE = '#3468b7'; // Exercise (blue)
const INNER = '#e29216'; // Stand (amber)

const RING_DEFS = [
    { color: OUTER, r: 44, key: 'outer' as const },
    { color: MIDDLE, r: 33, key: 'middle' as const },
    { color: INNER, r: 22, key: 'inner' as const },
];

export function MiniActivityRing({
    size = 32,
    outer = 0,
    middle = 0,
    inner = 0,
    empty = false,
    className,
    isToday = false,
    label,
}: MiniActivityRingProps) {
    if (empty) {
        return (
            <div
                role="img"
                aria-label={label ? `${label}: no activity` : 'No activity'}
                className={cx('rounded-full border-2 border-dashed border-border-light', className)}
                style={{ width: size, height: size }}
            />
        );
    }

    const stroke = 7;
    const values = { outer, middle, inner };

    return (
        <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={label ? `${label}: move ${Math.round(outer)}%, exercise ${Math.round(middle)}%, stand ${Math.round(inner)}%` : undefined}
            className={cx('-rotate-90', className)}
            style={{ width: size, height: size }}
        >
            {isToday && (
                <circle
                    cx="50"
                    cy="50"
                    r="49"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.35"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                />
            )}
            {RING_DEFS.map(({ color, r, key }) => {
                const value = Math.max(0, Math.min(100, values[key]));
                const circumference = 2 * Math.PI * r;
                const offset = circumference - (value / 100) * circumference;
                return (
                    <g key={key}>
                        <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke={color}
                            strokeOpacity="0.18"
                            strokeWidth={stroke}
                        />
                        <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke={color}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            className="transition-[stroke-dashoffset] duration-700 ease-out"
                        />
                    </g>
                );
            })}
        </svg>
    );
}
