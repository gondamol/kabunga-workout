import { WifiOff } from 'lucide-react';

export default function OfflineBanner({ isOnline }: { isOnline: boolean }) {
    if (isOnline) return null;

    return (
        <div className="sticky top-0 z-[90] bg-amber/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2">
            <WifiOff size={14} className="text-bg-primary" />
            <span className="text-xs font-medium text-bg-primary">Offline — changes will sync when connected</span>
        </div>
    );
}
