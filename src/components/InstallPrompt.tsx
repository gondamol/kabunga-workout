import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [dismissed, setDismissed] = useState(() => {
        return localStorage.getItem('kabunga-install-dismissed') === 'true';
    });

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

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
        localStorage.setItem('kabunga-install-dismissed', 'true');
    };

    if (!deferredPrompt || dismissed) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-[100] glass-strong rounded-2xl p-4 animate-slide-up max-w-lg mx-auto">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                    <Download size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-text-primary">Install Kabunga</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Add to home screen for the best gym experience.</p>
                </div>
                <button onClick={handleDismiss} className="text-text-muted p-1">
                    <X size={16} />
                </button>
            </div>
            <button
                onClick={handleInstall}
                className="mt-3 w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold active:scale-[0.98] transition-transform"
            >
                Install App
            </button>
        </div>
    );
}
