"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export function InstallAppButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // fast-fail if not in browser
        if (typeof window === 'undefined') return;

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    // If installed, don't show anything (or show "Open App" if desired, but hidden is cleaner)
    if (isInstalled) return null;

    // Only show if the browser has fired the event (meaning it is installable)
    if (!deferredPrompt) return null;

    return (
        <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 text-sm font-bold text-black bg-emerald-500 hover:bg-emerald-400 px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 animate-in fade-in zoom-in duration-300"
        >
            <Download className="w-4 h-4" />
            <span>Install App</span>
        </button>
    );
}
