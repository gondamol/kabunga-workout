import { WifiOff } from 'lucide-react';

export default function OfflineBanner({ isOnline }: { isOnline: boolean }) {
    if (isOnline) return null;

    return (
        <div className="sticky top-0 z-[90] safe-top border-b border-amber/25 bg-amber/95 px-4 py-2 shadow-card backdrop-blur-sm" role="status" aria-live="polite">
            <div className="mx-auto flex max-w-lg items-center justify-center gap-2 text-center text-text-inverse">
                <WifiOff size={15} aria-hidden="true" />
                <span className="text-xs font-bold">Offline gym mode. Changes will sync when connected.</span>
            </div>
        </div>
    );
}
