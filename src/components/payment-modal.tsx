"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { PaystackButton } from "react-paystack";
import { doc, updateDoc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X } from "lucide-react";

interface PaymentModalProps {
    children?: React.ReactNode;
}

const TIERS = [
    {
        id: "basic",
        name: "Basic Access",
        price: 100,
        features: ["Limited predictions", "No correct scores", "Valid until 23:59 EAT"],
    },
    {
        id: "standard",
        name: "Standard Access",
        price: 250,
        features: ["All match predictions", "Correct Scores", "Valid until 23:59 EAT"],
        recommended: true,
    },
    {
        id: "vip",
        name: "VIP Access",
        price: 500,
        features: ["Early Access Tips", "Highest Confidence Only", "Direct Alerts", "Valid until 23:59 EAT"],
    },
];

export function PaymentModal({ children }: PaymentModalProps) {
    const { user } = useAuth();
    const [selectedTier, setSelectedTier] = useState<string | null>("standard");
    const [isOpen, setIsOpen] = useState(false);
    const [success, setSuccess] = useState(false);

    // Paystack Config
    // NOTE: Using a Test Public Key for now if variable is missing, but should be in .env.local
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    const handleSuccess = async (reference: any) => {
        if (!user || !selectedTier) return;

        try {
            // Optimistic Update: Grant access immediately
            // In production, this should be verified by a webhook
            const userRef = doc(db, "users", user.uid);

            // Calculate Expiry: End of TODAY (EAT is UTC+3)
            // Simple logic: Set to 23:59:59 of current day local time approx
            const now = new Date();
            const expiry = new Date(now);
            expiry.setHours(23, 59, 59, 999);

            // CHANGED: updateDoc -> setDoc with merge: true to avoid "No document to update" error
            await setDoc(userRef, {
                subscriptionStatus: "active",
                tier: selectedTier,
                subscriptionExpiry: expiry, // Store as Timestamp
                lastPaymentRef: reference.reference,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // NEW: Log Transaction
            const txRef = doc(collection(db, "transactions"));
            await setDoc(txRef, {
                userId: user.uid,
                amount: (currentTier?.price || 0),
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
                window.location.reload(); // Force reload to reflect changes
            }, 2000);

        } catch (error) {
            console.error("Payment Success Error:", error);
        }
    };

    const handleClose = () => {
        // Prevent closing if we are in a success state
        if (!success) return;
        // Actually we use this for the paystack close action
        console.log("Payment closed");
    };

    const currentTier = TIERS.find(t => t.id === selectedTier);

    const componentProps = {
        email: user?.email || "user@example.com",
        amount: (currentTier?.price || 0) * 100, // Paystack expects kobo/cents
        currency: "KES",
        publicKey,
        text: `Pay KES ${currentTier?.price}`,
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
                    <div className="flex flex-col items-center justify-center p-12 text-center text-emerald-500 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                            <Check className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold">Payment Successful!</h2>
                        <p className="text-white mt-2">Your dashboard has been unlocked.</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-3 gap-4 mt-6">
                        {TIERS.map((tier) => (
                            <div
                                key={tier.id}
                                onClick={() => setSelectedTier(tier.id)}
                                className={`cursor-pointer relative p-4 rounded-xl border-2 transition-all ${selectedTier === tier.id
                                    ? "border-yellow-500 bg-yellow-500/10"
                                    : "border-white/10 bg-white/5 hover:border-white/20"
                                    }`}
                            >
                                {tier.recommended && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                        Best Value
                                    </div>
                                )}
                                <h3 className="font-bold text-lg text-center mb-2">{tier.name}</h3>
                                <p className="text-2xl font-bold text-center text-yellow-500 mb-4">
                                    KES {tier.price} <span className="text-xs text-gray-400 font-normal">/day</span>
                                </p>
                                <ul className="space-y-2 mb-6">
                                    {tier.features.map((feature, i) => (
                                        <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                            <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}

                {!success && (
                    <div className="flex justify-center mt-6">
                        <PaystackButton
                            {...componentProps}
                            className="w-full max-w-sm bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-md transition-colors disabled:opacity-50"
                        />
                    </div>
                )}

                <p className="text-[10px] text-center text-gray-500 mt-4">
                    Secured by Paystack. No automatic renewals. M-Pesa Supported.
                </p>
            </DialogContent>
        </Dialog>
    );
}
