"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function usePageTracking() {
    const pathname = usePathname();

    useEffect(() => {
        // Track page view
        const trackPageView = async () => {
            try {
                await fetch('/api/admin/analytics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        page: pathname,
                        referrer: document.referrer,
                        userAgent: navigator.userAgent,
                    }),
                });
            } catch (error) {
                // Silently fail - don't disrupt user experience
                console.debug('Page tracking failed:', error);
            }
        };

        trackPageView();
    }, [pathname]);
}
