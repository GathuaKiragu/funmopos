"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AccessLevel = "guest" | "free" | "basic" | "standard" | "vip";

interface AccessState {
    tier: AccessLevel;
    isValid: boolean;
    isTrial: boolean;
    trialExpiry?: Date;
    loading: boolean;
    expiry?: Date;
    receiptEmail?: string;
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
    const [isTrial, setIsTrial] = useState(false);
    const [trialExpiry, setTrialExpiry] = useState<Date>();
    const [loading, setLoading] = useState(true);
    const [expiry, setExpiry] = useState<Date>();
    const [receiptEmail, setReceiptEmail] = useState<string>();

    useEffect(() => {
        if (!user) {
            setTier("guest");
            setIsValid(false);
            setIsTrial(false);
            setTrialExpiry(undefined);
            setLoading(false);
            setExpiry(undefined);
            setReceiptEmail(undefined);
            return;
        }

        // Real-time listener for subscription updates
        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const userTier = (data.tier as AccessLevel) || "free";
                const userReceiptEmail = data.receiptEmail || (data.email && data.email !== "phone-user" ? data.email : "gathua612@gmail.com");

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
                setReceiptEmail(userReceiptEmail);

                // Trial Logic: first 24 hours
                if (data.createdAt) {
                    const created = data.createdAt.toDate();
                    const now = new Date();
                    const tExpiry = new Date(created.getTime() + 24 * 60 * 60 * 1000);
                    setTrialExpiry(tExpiry);
                    setIsTrial(now < tExpiry);
                } else {
                    setIsTrial(false);
                }
            } else {
                setTier("free");
                setIsValid(false);
                setIsTrial(true);
                // For new users without doc yet, assume 24h from now
                setTrialExpiry(new Date(Date.now() + 24 * 60 * 60 * 1000));
                setExpiry(undefined);
                setReceiptEmail("noreply@funmo.africa");
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

    return { tier, isValid, isTrial, trialExpiry, loading, expiry, receiptEmail, canAccess };
}
