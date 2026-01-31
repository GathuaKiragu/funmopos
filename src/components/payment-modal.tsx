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
        packages: [
            { id: "daily", name: "Daily Pass", price: 100, days: 1, label: "Today's Tips" },
            { id: "3day", name: "3-Day Bundle", price: 250, days: 3, label: "Best Value" },
            { id: "weekly", name: "Weekly Access", price: 500, days: 7, label: "Most Popular" }
        ]
    },
    USD: {
        symbol: "$",
        packages: [
            { id: "daily", name: "Daily Pass", price: 1, days: 1, label: "Today" },
            { id: "3day", name: "3-Day Bundle", price: 2.50, days: 3, label: "Best Value" },
            { id: "weekly", name: "Weekly Access", price: 5, days: 7, label: "Most Popular" }
        ]
    }
};

const COMMON_FEATURES = [
    "ALL PREDICTIONS Unlocked",
    "VIP Lock Picks (Highest Accuracy)",
    "Full Data Access",
    "Valid until 23:59 EAT (Last Day)"
];

// Fixed exchange rate for processing international payments in KES
const USD_TO_KES = 135;

export function PaymentModal({ children }: PaymentModalProps) {
    const { user } = useAuth();
    const { tier, receiptEmail } = useAccess();
    const { currency, loading: locLoading, toggleCurrency } = useLocation();
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>("daily"); // Default to daily
    const [isOpen, setIsOpen] = useState(false);
    const [success, setSuccess] = useState(false);

    // Paystack Config
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    const getPackage = (id: string) => {
        const config = PRICING[currency];
        return config.packages.find(p => p.id === id);
    };

    const handleSuccess = async (reference: any) => {
        if (!user || !selectedPackageId) return;

        const pkg = getPackage(selectedPackageId);
        if (!pkg) return;

        try {
            const userRef = doc(db, "users", user.uid);
            const now = new Date();
            const expiry = new Date(now);

            // Calculate expiry: Today + (days - 1)
            // If 1 day: Today + 0.
            // If 3 days: Today + 2.
            expiry.setDate(expiry.getDate() + (pkg.days - 1));
            expiry.setHours(23, 59, 59, 999);

            await setDoc(userRef, {
                subscriptionStatus: "active",
                tier: "vip", // All paid packages grant VIP access
                subscriptionExpiry: expiry,
                lastPaymentRef: reference.reference,
                lastPackageId: selectedPackageId,
                updatedAt: serverTimestamp()
            }, { merge: true });

            const txRef = doc(collection(db, "transactions"));
            await setDoc(txRef, {
                userId: user.uid,
                amount: processingAmount,
                currency: "KES",
                packageId: selectedPackageId,
                tier: "vip",
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

    const currentPackage = selectedPackageId ? getPackage(selectedPackageId) : null;
    const currentPrice = currentPackage ? currentPackage.price : 0;
    const currentSymbol = PRICING[currency].symbol;

    // Paystack Processing Logic:
    const processingAmount = currency === 'USD'
        ? Math.round(currentPrice * USD_TO_KES)
        : currentPrice;

    const componentProps = {
        email: receiptEmail || user?.email || "noreply@funmo.africa",
        amount: processingAmount * 100, // Always cents/kobo
        currency: "KES", // Always process in KES
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
                    <DialogTitle className="text-2xl font-bold text-center mb-2">Unlock Full Access</DialogTitle>
                    <DialogDescription className="text-center text-gray-400">
                        Get instant access to all VIP predictions and expert analysis.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-emerald-500 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                            <Check className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold">Payment Successful!</h2>
                        <p className="text-white mt-2">Your VIP access has been activated.</p>
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
                            {PRICING[currency].packages.map((pkg) => {
                                const isSelected = selectedPackageId === pkg.id;
                                const isBestValue = pkg.id === '3day'; // or based on logic

                                return (
                                    <div
                                        key={pkg.id}
                                        onClick={() => setSelectedPackageId(pkg.id)}
                                        className={`cursor-pointer relative p-4 rounded-xl border-2 transition-all ${isSelected
                                            ? "border-yellow-500 bg-yellow-500/10"
                                            : "border-white/10 bg-white/5 hover:border-white/20"
                                            }`}
                                    >
                                        {isBestValue && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                                Best Value
                                            </div>
                                        )}
                                        <h3 className="font-bold text-lg text-center mb-2">{pkg.name}</h3>
                                        <p className="text-2xl font-bold text-center text-yellow-500 mb-2">
                                            {currentSymbol} {pkg.price}
                                        </p>
                                        <p className="text-xs text-center text-gray-400 mb-4 font-mono uppercase tracking-wider">
                                            {pkg.days} {pkg.days === 1 ? 'Day' : 'Days'} Access
                                        </p>

                                        {/* Show simple checkmark if selected, or just list */}
                                        <div className="flex justify-center">
                                            {isSelected ? (
                                                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                                                    <Check className="w-4 h-4 text-black" />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full border border-white/20" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/5">
                            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <span className="text-yellow-500">★</span> VIP Benefits Included:
                            </h4>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {COMMON_FEATURES.map((feat, i) => (
                                    <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                                        <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                        {feat}
                                    </li>
                                ))}
                            </ul>
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
