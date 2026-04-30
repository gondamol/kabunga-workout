import { useMemo } from 'react';

const COLORS = ['#9bd93c', '#3aa84d', '#3468b7', '#e29216', '#d8871f', '#ef5b5b'];

type ConfettiProps = {
    /** Number of pieces to render */
    count?: number;
    /** Hide if user prefers reduced motion (CSS handles this too) */
    className?: string;
};

/**
 * Lightweight CSS-driven confetti. Each piece is absolutely positioned with
 * randomised CSS variables (start/end x, rotation, duration, delay).
 */
export function Confetti({ count = 18, className = '' }: ConfettiProps) {
    const pieces = useMemo(
        () =>
            Array.from({ length: count }, (_, i) => {
                const startX = `${(Math.random() * 200 - 100).toFixed(0)}px`;
                const driftX = `${(Math.random() * 60 - 30).toFixed(0)}px`;
                const rotStart = `${Math.floor(Math.random() * 360)}deg`;
                const rotEnd = `${Math.floor(Math.random() * 720 + 360)}deg`;
                const duration = `${(2.2 + Math.random() * 1.6).toFixed(2)}s`;
                const delay = `${(Math.random() * 1.4).toFixed(2)}s`;
                const color = COLORS[i % COLORS.length];
                const tilted = Math.random() > 0.5;
                return {
                    id: i,
                    style: {
                        background: color,
                        '--cf-x': startX,
                        '--cf-x-end': driftX,
                        '--cf-rot-start': rotStart,
                        '--cf-rot-end': rotEnd,
                        '--cf-duration': duration,
                        '--cf-delay': delay,
                        width: tilted ? '6px' : '8px',
                        height: tilted ? '6px' : '14px',
                        borderRadius: tilted ? '50%' : '2px',
                    } as React.CSSProperties,
                };
            }),
        [count],
    );

    return (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
            {pieces.map((p) => (
                <span key={p.id} className="confetti-piece" style={p.style} />
            ))}
        </div>
    );
}
