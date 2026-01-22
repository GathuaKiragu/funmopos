"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AccessLevel = "guest" | "free" | "basic" | "standard" | "vip";

interface AccessState {
    tier: AccessLevel;
    isValid: boolean;
    loading: boolean;
    canAccess: (requiredTier: AccessLevel) => boolean;
}

const TIER_LEVELS: Record<AccessLevel, number> = {
    guest: 0,
    free: 1,
    basic: 2,
    standard: 3,
    vip: 4,
};

export function useAccess(): AccessState {
    const { user } = useAuth();
    const [tier, setTier] = useState<AccessLevel>("guest");
    const [isValid, setIsValid] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setTier("guest");
            setIsValid(false);
            setLoading(false);
            return;
        }

        // Real-time listener for subscription updates
        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const userTier = (data.tier as AccessLevel) || "free";

                // Check Expiry
                let active = false;
                if (data.subscriptionExpiry) {
                    const now = new Date();
                    const expiry = data.subscriptionExpiry.toDate(); // Firestore Timestamp
                    active = expiry > now;
                }

                setTier(userTier);
                setIsValid(active);
            } else {
                setTier("free");
                setIsValid(false);
            }
            setLoading(false);
        }, (error) => {
            console.error("Access Hook Error:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const canAccess = (requiredTier: AccessLevel) => {
        if (tier === "guest" || !isValid) return false;
        return TIER_LEVELS[tier] >= TIER_LEVELS[requiredTier];
    };

    return { tier, isValid, loading, canAccess };
}
