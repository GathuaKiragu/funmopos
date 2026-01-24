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
    expiry?: Date;
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
    const [expiry, setExpiry] = useState<Date>();

    useEffect(() => {
        if (!user) {
            setTier("guest");
            setIsValid(false);
            setLoading(false);
            setExpiry(undefined); // Ensure expiry is cleared for guests
            return;
        }

        // Real-time listener for subscription updates
        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const userTier = (data.tier as AccessLevel) || "free";

                let active = false;
                let subscriptionExpiryDate: Date | undefined;
                if (data.subscriptionExpiry) {
                    const expiryDate = data.subscriptionExpiry.toDate();
                    subscriptionExpiryDate = expiryDate;
                    const now = new Date();
                    active = expiryDate > now;
                }

                setTier(userTier);
                setIsValid(active);
                setExpiry(subscriptionExpiryDate);
            } else {
                setTier("free");
                setIsValid(false);
                setExpiry(undefined);
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

    return { tier, isValid, loading, expiry, canAccess };
}
