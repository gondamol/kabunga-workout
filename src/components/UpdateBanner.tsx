import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/**
 * Shows a sticky banner at the top when a new app version is available.
 * User can tap "Update" to apply it immediately (reloads the page).
 */
export default function UpdateBanner() {
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r: ServiceWorkerRegistration | undefined) {
            // Check for updates every 60 seconds while app is open
            if (r) setInterval(() => r.update(), 60_000);
        },
    });

    if (!needRefresh) return null;

    return (
        <div className="sticky top-0 z-[95] bg-accent/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between gap-3 animate-slide-up">
            <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-white shrink-0" />
                <span className="text-xs font-medium text-white">
                    New version available!
                </span>
            </div>
            <button
                onClick={() => updateServiceWorker(true)}
                className="text-xs font-bold bg-white text-accent px-3 py-1.5 rounded-lg active:scale-95 transition-transform shrink-0"
            >
                Update now
            </button>
        </div>
    );
}
