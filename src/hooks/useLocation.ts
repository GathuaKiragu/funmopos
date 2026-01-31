"use client";

import { useState, useEffect } from "react";

interface LocationState {
    countryCode: string; // 'KE', 'US', etc.
    loading: boolean;
    currency: 'KES' | 'USD';
}

export function useLocation() {
    const [location, setLocation] = useState<LocationState>({
        countryCode: 'KE', // Default to Kenya
        loading: true,
        currency: 'KES'
    });

    useEffect(() => {
        const fetchLocation = async () => {
            try {
                // Check if already stored in session to save API calls
                const cached = sessionStorage.getItem('user_country');
                if (cached) {
                    setLocation({
                        countryCode: cached,
                        loading: false,
                        currency: cached === 'KE' ? 'KES' : 'USD'
                    });
                    return;
                }

                // Fetch with timeout to prevent hanging
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                const res = await fetch('https://ipapi.co/json/', {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                clearTimeout(timeoutId);

                // Check if response is ok
                if (!res.ok) {
                    throw new Error(`IP API returned ${res.status}`);
                }

                const data = await res.json();

                const country = data.country_code || 'KE';
                const currency = country === 'KE' ? 'KES' : 'USD';

                sessionStorage.setItem('user_country', country);

                setLocation({
                    countryCode: country,
                    loading: false,
                    currency
                });
            } catch (error) {
                // Silently fall back to Kenya - this is expected behavior when IP API is unavailable
                if (error instanceof Error && error.name === 'AbortError') {
                    console.warn('[Location] IP geolocation timed out, using default location (KE)');
                } else {
                    console.warn('[Location] IP geolocation unavailable, using default location (KE)');
                }

                setLocation({
                    countryCode: 'KE',
                    loading: false,
                    currency: 'KES'
                });
            }
        };

        fetchLocation();
    }, []);

    const toggleCurrency = () => {
        setLocation(prev => ({
            ...prev,
            currency: prev.currency === 'KES' ? 'USD' : 'KES'
        }));
    };

    return { ...location, toggleCurrency };
}
