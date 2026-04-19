import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [dismissed, setDismissed] = useState(() => {
        try {
            return localStorage.getItem('kabunga-install-dismissed') === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (dismissed) return;
        const handler = (e: Event) => {
            const promptEvent = e as BeforeInstallPromptEvent;
            if (typeof promptEvent.prompt !== 'function') return;
            e.preventDefault();
            setDeferredPrompt((current) => current ?? promptEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, [dismissed]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem('kabunga-install-dismissed', 'true');
        } catch {
            // Ignore storage restrictions (e.g. private mode)
        }
    };

    if (!deferredPrompt || dismissed) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-[100] mx-auto max-w-lg rounded-[24px] border border-border bg-white/95 p-4 shadow-[0_16px_40px_rgba(23,33,25,0.08)] backdrop-blur-xl animate-slide-up">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
                    <Download size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-text-primary">Install Kabunga</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Add it to your home screen for a cleaner, faster training flow.</p>
                </div>
                <button onClick={handleDismiss} className="text-text-muted p-1">
                    <X size={16} />
                </button>
            </div>
            <button
                onClick={handleInstall}
                className="mt-3 w-full rounded-xl gradient-primary py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
            >
                Install App
            </button>
        </div>
    );
}
