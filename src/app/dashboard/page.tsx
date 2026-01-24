"use client";

import { useAuth } from "@/context/AuthContext";
import { useAccess } from "@/hooks/useAccess";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getFixtures, Fixture, Sport } from "@/lib/api-football";
import { format, addDays, isSameDay, subDays } from "date-fns";
import { Trophy, Activity, Calendar as CalendarIcon, ChevronRight, ChevronLeft, Lock, AlertTriangle, CheckCircle } from "lucide-react";
import { PaymentModal } from "@/components/payment-modal";

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const { tier, isValid, loading: accessLoading, canAccess, expiry } = useAccess();
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSport, setSelectedSport] = useState<Sport>("football");
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loadingFixtures, setLoadingFixtures] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const loadData = async () => {
            setLoadingFixtures(true);
            const data = await getFixtures(selectedDate, selectedSport);
            setFixtures(data);
            setLoadingFixtures(false);
        };
        loadData();
    }, [selectedDate, selectedSport]);

    if (authLoading || accessLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <Activity className="w-6 h-6 animate-spin text-yellow-500" />
            </div>
        );
    }

    // Helper to Render a Tip Card
    const TipCard = ({ fixture }: { fixture: Fixture }) => {
        const { prediction, homeTeam, awayTeam, league, date } = fixture;

        // Logic for Colors
        const getConfidenceStyle = (conf: number) => {
            if (conf <= 30) return { color: "text-red-500", border: "border-red-500/20", bg: "bg-red-900/10", label: "Low Confidence" };
            if (conf <= 60) return { color: "text-orange-500", border: "border-orange-500/20", bg: "bg-orange-900/10", label: "Medium Confidence" };
            return { color: "text-emerald-500", border: "border-emerald-500/20", bg: "bg-emerald-900/10", label: "High Confidence" };
        };

        const hasPrediction = !!prediction;
        const confidence = prediction?.confidence || 0;
        const style = getConfidenceStyle(confidence);
        const isRisky = confidence < 35; // User requirement: Below 35% show no bet/risk

        const requiresTier = prediction?.requiresTier || "free";
        // User can access if:
        // 1. They have required tier 
        // 2. OR it is a "No Bet" (Risky) - usually we warn everyone freely? 
        // Let's stick to locking unless it's explicitly Free or Risky (if we want to show risk freely)
        // User said "Only below 35% show no bet".

        const canView = canAccess(requiresTier) || isRisky;
        const isLocked = !canView && hasPrediction;

        return (
            <div className={`relative p-6 rounded-xl border ${isRisky ? 'border-red-500/20 bg-red-900/5' : 'border-white/10 bg-white/5'} overflow-hidden transition-all hover:border-white/20`}>

                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        {league.logo && <img src={league.logo} alt={league.name} className="w-4 h-4 object-contain" />}
                        <span className="text-xs font-mono text-gray-400 uppercase truncate max-w-[120px]">{league.name}</span>
                    </div>
                    {hasPrediction && (
                        <span className={`text-xs font-bold px-2 py-1 rounded border ${style.border} ${style.bg} ${style.color}`}>
                            {style.label}
                        </span>
                    )}
                </div>

                {/* Match Info */}
                <div className={`mb-6 ${isLocked ? 'blur-sm select-none' : ''}`}>
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="text-lg font-bold text-right flex-1">{homeTeam.name}</span>
                        <span className="text-gray-500 text-xs font-mono">VS</span>
                        <span className="text-lg font-bold text-left flex-1">{awayTeam.name}</span>
                    </div>
                    <p className="text-xs text-center text-gray-500">
                        {format(new Date(date), "HH:mm")} EAT
                    </p>
                </div>

                {/* Locked Overlay */}
                {isLocked ? (
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-md z-10 flex flex-col items-center justify-center text-center p-6">
                        <Lock className="w-8 h-8 text-yellow-500 mb-4" />
                        <h3 className="font-bold text-lg mb-2 text-white">Premium Tip</h3>
                        <p className="text-sm text-gray-400 mb-4">Requires {requiresTier.toUpperCase()} Access</p>
                        <PaymentModal>
                            <Button className="bg-yellow-500 text-black hover:bg-yellow-400 font-bold">Unlock Now</Button>
                        </PaymentModal>
                    </div>
                ) : (
                    /* Prediction Content */
                    <div className={`p-4 rounded-lg border text-center ${style.border} ${style.bg} bg-opacity-20`}>
                        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">AI Prediction</p>
                        {hasPrediction ? (
                            <div>
                                {isRisky ? (
                                    <div className="flex flex-col items-center">
                                        <p className="text-xl font-bold text-red-500 mb-1">NO BET</p>
                                        <p className="text-xs text-red-400">
                                            {confidence}% confidence level {prediction.picked}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <p className={`text-xl font-bold ${style.color}`}>
                                            {prediction.picked}
                                        </p>
                                        <p className={`text-xs mt-1 ${style.color} opacity-80`}>
                                            {confidence}% confidence level {homeTeam.name} will win
                                            {/* Note: logic to map 'picked' to 'who will win' text needs refinement if picked is 'Over 2.5' etc. 
                                                For now we display generic or just specific text if possible. 
                                                User example: "32% confidence level team x will win" 
                                             */}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <Activity className="w-4 h-4 text-gray-600 animate-pulse" />
                                <p className="text-sm font-semibold text-gray-500">Awaiting Analysis...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = new Date(e.target.value);
        if (!isNaN(date.getTime())) {
            setSelectedDate(date);
        }
    };

    // const isToday = isSameDay(selectedDate, new Date());

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 border-b border-white/10 pb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
                        <p className="text-gray-400 text-sm">
                            Access Level: <span className={`font-bold uppercase ${isValid ? 'text-yellow-500' : 'text-gray-500'}`}>{isValid ? tier : (user ? "Free Tier" : "Guest")}</span>
                        </p>
                    </div>

                    {!isValid ? (
                        <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-2 text-red-500 text-sm font-bold animate-pulse">
                            <AlertTriangle className="w-4 h-4" /> Subscription Inactive
                        </div>
                    ) : (
                        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2 text-emerald-500 text-sm font-bold">
                            <CheckCircle className="w-4 h-4" /> Active until {expiry ? format(expiry, "MMM dd, HH:mm") : "23:59"}
                        </div>
                    )}
                </div>

            </div>

            {/* Sport & Date Selection Row */}
            <div className="flex flex-col lg:flex-row gap-6 mb-8">
                {/* Sport Selector */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                    <button
                        onClick={() => setSelectedSport("football")}
                        className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${selectedSport === "football" ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Trophy className="w-4 h-4" /> Football
                    </button>
                    <button
                        onClick={() => setSelectedSport("basketball")}
                        className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${selectedSport === "basketball" ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Activity className="w-4 h-4" /> Basketball
                    </button>
                </div>

                {/* Date Navigation */}
                <div className="flex-1 flex items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-yellow-500" />
                            <span className="font-bold text-sm text-gray-300">Date:</span>
                        </div>
                        <input
                            type="date"
                            value={format(selectedDate, "yyyy-MM-dd")}
                            onChange={handleDateChange}
                            className="bg-black border border-white/20 rounded px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-yellow-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="text-gray-400 hover:text-white">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())} className="text-yellow-500 hover:text-yellow-400 hover:bg-white/5 text-xs font-bold uppercase tracking-tighter">
                            Today
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="text-gray-400 hover:text-white">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Fixtures Grid */}
            {loadingFixtures ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Activity className="w-8 h-8 animate-spin mb-4 text-yellow-500" />
                    <p>Analyzing market data...</p>
                </div>
            ) : fixtures.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {fixtures.map((fixture) => (
                        <TipCard key={fixture.id} fixture={fixture} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                    <p className="text-gray-500 mb-4 font-medium text-lg">No high-confidence {selectedSport} signals found for {format(selectedDate, "MMM dd")}.</p>
                    <Button variant="link" onClick={() => setSelectedDate(new Date())} className="text-yellow-500 font-bold">
                        Return to Today's Market
                    </Button>
                </div>
            )}

        </div>
    );
}
