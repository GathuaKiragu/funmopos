"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { PaystackButton } from "react-paystack";
import { doc, updateDoc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X, RefreshCw } from "lucide-react";
import { useLocation } from "@/hooks/useLocation";
import { useAccess } from "@/hooks/useAccess";

interface PaymentModalProps {
    children?: React.ReactNode;
}

const PRICING = {
    KES: {
        symbol: "KES",
        tiers: [
            { id: "basic", price: 50 },
            { id: "standard", price: 100 },
            { id: "vip", price: 300 }
        ]
    },
    USD: {
        symbol: "$",
        tiers: [
            { id: "basic", price: 1 },
            { id: "standard", price: 2 },
            { id: "vip", price: 5 }
        ]
    }
};

const FEATURES = {
    basic: ["Standard Predictions", "Basic Confidence Tips", "Valid until 23:59 EAT"],
    standard: ["High Confidence Tips", "Expert Analysis", "Valid until 23:59 EAT"],
    vip: ["ALL PREDICTIONS", "VIP Lock Picks (Highest Accuracy)", "Full Data Access", "Valid until 23:59 EAT"]
};

const TIER_NAMES = {
    basic: "Starter Pak",
    standard: "Daily Winner",
    vip: "Ultimate VIP"
};

// Fixed exchange rate for processing international payments in KES
const USD_TO_KES = 135;

export function PaymentModal({ children }: PaymentModalProps) {
    const { user } = useAuth();
    const { tier, receiptEmail } = useAccess();
    const { currency, loading: locLoading, toggleCurrency } = useLocation();
    const [selectedTier, setSelectedTier] = useState<string | null>("standard");
    const [isOpen, setIsOpen] = useState(false);
    const [success, setSuccess] = useState(false);

    // Paystack Config
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    const getPrice = (tierId: string) => {
        const config = PRICING[currency];
        return config.tiers.find(t => t.id === tierId)?.price || 0;
    };

    const handleSuccess = async (reference: any) => {
        if (!user || !selectedTier) return;

        try {
            const userRef = doc(db, "users", user.uid);
            const now = new Date();
            const expiry = new Date(now);
            expiry.setHours(23, 59, 59, 999);

            await setDoc(userRef, {
                subscriptionStatus: "active",
                tier: selectedTier,
                subscriptionExpiry: expiry,
                lastPaymentRef: reference.reference,
                updatedAt: serverTimestamp()
            }, { merge: true });

            const txRef = doc(collection(db, "transactions"));
            await setDoc(txRef, {
                userId: user.uid,
                amount: processingAmount,
                currency: "KES",
                tier: selectedTier,
                reference: reference.reference,
                status: "success",
                provider: "paystack",
                createdAt: serverTimestamp()
            });

            setSuccess(true);
            setTimeout(() => {
                setIsOpen(false);
                setSuccess(false);
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error("Payment Success Error:", error);
        }
    };

    const handleClose = () => {
        if (!success) return;
        console.log("Payment closed");
    };

    const currentPrice = selectedTier ? getPrice(selectedTier) : 0;
    const currentSymbol = PRICING[currency].symbol;

    // Paystack Processing Logic:
    // To avoid "Currency not supported" errors on standard Kenyan accounts,
    // we process all transactions in KES, but show USD prices to the user.
    const processingAmount = currency === 'USD'
        ? Math.round(currentPrice * USD_TO_KES)
        : currentPrice;

    const componentProps = {
        email: receiptEmail || user?.email || "noreply@funmo.africa",
        amount: processingAmount * 100, // Always cents/kobo
        currency: "KES", // Always process in KES to ensure account compatibility
        publicKey,
        text: `Pay ${currentSymbol}${currentPrice}`,
        onSuccess: handleSuccess,
        onClose: handleClose,
    };

    if (!user) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children || <Button>Upgrade Access</Button>}
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-2">Select Your Access Pass</DialogTitle>
                    <DialogDescription className="text-center text-gray-400">
                        Unlock premium AI predictions. Access is defined by End-of-Day (23:59 EAT).
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    /* ... (unchanged success view) ... */
                    <div className="flex flex-col items-center justify-center p-12 text-center text-emerald-500 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                            <Check className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold">Payment Successful!</h2>
                        <p className="text-white mt-2">Your dashboard has been unlocked.</p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            {currency === 'USD' && (
                                <p className="text-[10px] text-yellow-500/80 font-medium">
                                    💡 International payment processed in KES equivalent.
                                </p>
                            )}
                            <button
                                onClick={toggleCurrency}
                                className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400 hover:text-white transition-colors bg-white/5 px-2 py-1 rounded ml-auto"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Switch to {currency === 'KES' ? 'USD' : 'KES'}
                            </button>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {['basic', 'standard', 'vip'].map((tierId) => {
                                const price = getPrice(tierId);
                                const isBestValue = tierId === 'standard';

                                return (
                                    <div
                                        key={tierId}
                                        onClick={() => setSelectedTier(tierId)}
                                        className={`cursor-pointer relative p-4 rounded-xl border-2 transition-all ${selectedTier === tierId
                                            ? "border-yellow-500 bg-yellow-500/10"
                                            : "border-white/10 bg-white/5 hover:border-white/20"
                                            }`}
                                    >
                                        {isBestValue && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                                Best Value
                                            </div>
                                        )}
                                        <h3 className="font-bold text-lg text-center mb-2">{TIER_NAMES[tierId as keyof typeof TIER_NAMES]}</h3>
                                        <p className="text-2xl font-bold text-center text-yellow-500 mb-4">
                                            {currentSymbol} {price} <span className="text-xs text-gray-400 font-normal">/day</span>
                                        </p>
                                        <ul className="space-y-2 mb-6">
                                            {FEATURES[tierId as keyof typeof FEATURES].map((feature, i) => (
                                                <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                                    <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-col items-center mt-6">
                            <PaystackButton
                                {...componentProps}
                                className="w-full max-w-sm bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-md transition-colors disabled:opacity-50"
                            />
                            {currency === 'USD' && (
                                <p className="text-[9px] text-gray-500 mt-2">
                                    Total for checkout: <span className="text-gray-400 font-bold">KES {processingAmount}</span>
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <p className="text-[10px] text-center text-gray-500 mt-4">
                    Secured by Paystack. No automatic renewals. M-Pesa & Cards Supported.
                </p>
            </DialogContent>
        </Dialog>
    );
}
