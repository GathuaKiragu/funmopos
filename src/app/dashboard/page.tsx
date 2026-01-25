"use client";

import { useAuth } from "@/context/AuthContext";
import { useAccess } from "@/hooks/useAccess";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getFixturesClient as getFixtures, Fixture, Sport } from "@/lib/api-football";
import { format, addDays, isSameDay, subDays } from "date-fns";
import { Trophy, Activity, Calendar as CalendarIcon, ChevronRight, ChevronLeft, Lock, AlertTriangle, CheckCircle } from "lucide-react";
import { PaymentModal } from "@/components/payment-modal";
import { calculateStake } from "@/lib/bankroll";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const { tier, isValid, loading: accessLoading, canAccess, expiry } = useAccess();
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSport, setSelectedSport] = useState<Sport>("football");
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loadingFixtures, setLoadingFixtures] = useState(true);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeague, setSelectedLeague] = useState<string>("all");
    const [onlyHighConfidence, setOnlyHighConfidence] = useState(false);
    const [selectedType, setSelectedType] = useState<string>("all");
    const [bankroll, setBankroll] = useState<number>(0);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        } else if (user) {
            getDoc(doc(db, "users", user.uid)).then(snap => {
                if (snap.exists()) {
                    setBankroll(snap.data().bankroll || 0);
                }
            });
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const loadData = async () => {
            setLoadingFixtures(true);
            const data = await getFixtures(selectedDate, selectedSport, true);
            setFixtures(data);
            setLoadingFixtures(false);
        };
        loadData();
    }, [selectedDate, selectedSport]);

    const filteredFixtures = fixtures.filter(fixture => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch =
                fixture.homeTeam.name.toLowerCase().includes(query) ||
                fixture.awayTeam.name.toLowerCase().includes(query) ||
                fixture.league.name.toLowerCase().includes(query);
            if (!matchesSearch) return false;
        }

        const matchesLeague = selectedLeague === "all" || fixture.league.name === selectedLeague;
        const matchesType = selectedType === "all" || fixture.prediction?.type === selectedType;
        const matchesConfidence = !onlyHighConfidence || (fixture.prediction?.confidence || 0) >= 70;
        return matchesLeague && matchesType && matchesConfidence;
    });

    const uniqueLeagues = Array.from(new Set(fixtures.map(f => f.league.name))).sort();

    if (authLoading || accessLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <Activity className="w-6 h-6 animate-spin text-yellow-500" />
            </div>
        );
    }

    const finishedStates = ['FT', 'AET', 'PEN'];

    // Split filtered fixtures
    const activeFixtures = filteredFixtures.filter(f => !finishedStates.includes(f.status?.short || ''));
    const finishedFixtures = filteredFixtures.filter(f => finishedStates.includes(f.status?.short || ''));

    // Helper to Render a Tip Card
    const TipCard = ({ fixture }: { fixture: Fixture }) => {
        const { prediction, homeTeam, awayTeam, league, date, status, goals } = fixture;
        const isFinished = finishedStates.includes(status?.short || '');
        const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status?.short || '');

        // Determine if prediction won or lost
        let result: 'WON' | 'LOST' | 'VOID' | null = null;
        if (isFinished && prediction && goals?.home != null && goals?.away != null) {
            const h = goals.home;
            const a = goals.away;
            const p = prediction.picked.toLowerCase();

            // Simple Logic for 1X2
            if (p.includes("home") || p.includes(homeTeam.name.toLowerCase()) || p.includes("1")) {
                result = h > a ? 'WON' : 'LOST';
            } else if (p.includes("away") || p.includes(awayTeam.name.toLowerCase()) || p.includes("2")) {
                result = a > h ? 'WON' : 'LOST';
            } else if (p.includes("draw") || p.includes("x")) {
                result = h === a ? 'WON' : 'LOST';
            }
            // For now only supporting 1X2 basic check, others default to null (no badge)
        }

        // Logic for Colors
        const getConfidenceStyle = (conf: number) => {
            if (conf <= 30) return { color: "text-red-500", border: "border-red-500/20", bg: "bg-red-900/10", label: "Low Confidence" };
            if (conf <= 60) return { color: "text-orange-500", border: "border-orange-500/20", bg: "bg-orange-900/10", label: "Medium Confidence" };
            return { color: "text-emerald-500", border: "border-emerald-500/20", bg: "bg-emerald-900/10", label: "High Confidence" };
        };

        const hasPrediction = !!prediction;
        const confidence = prediction?.confidence || 0;
        const style = getConfidenceStyle(confidence);
        const isRisky = confidence < 35;

        const requiresTier = prediction?.requiresTier || "free";
        const smartStake = calculateStake(bankroll, confidence);
        const canView = canAccess(requiresTier) || isRisky;
        const isLocked = !canView && hasPrediction;

        return (
            <div className={`relative p-6 rounded-xl border ${isRisky ? 'border-red-500/20 bg-red-900/5' : 'border-white/10 bg-white/5'} overflow-hidden transition-all hover:border-white/20`}>

                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        {league.flag && <img src={league.flag} alt="Country" className="w-4 h-4 rounded-full object-cover border border-white/20" />}
                        {league.logo && <img src={league.logo} alt={league.name} className="w-6 h-6 object-contain" />}
                        <span className="text-xs font-mono text-gray-400 uppercase truncate max-w-[150px]">{league.name}</span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-col items-end gap-1">
                        {isLive ? (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 text-red-500 text-[10px] font-bold uppercase animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Live
                            </span>
                        ) : isFinished ? (
                            <span className="px-2 py-0.5 rounded bg-white/10 text-gray-400 text-[10px] font-bold uppercase">
                                FT
                            </span>
                        ) : (
                            <div className="flex flex-col items-end">
                                <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-[10px] font-bold font-mono">
                                    {format(new Date(date), "HH:mm")}
                                </span>
                                {/* Urgency Countdown */}
                                {(() => {
                                    const diff = new Date(date).getTime() - new Date().getTime();
                                    const minutes = Math.floor(diff / 60000);
                                    if (minutes > 0 && minutes < 120) {
                                        return (
                                            <span className="text-[9px] text-orange-400 font-bold mt-0.5">
                                                In {minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}

                        {hasPrediction && !isFinished && confidence > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.border} ${style.bg} ${style.color}`}>
                                {confidence}%
                            </span>
                        )}

                        {/* Smart Stake - Only show if active and unlocked */}
                        {!isLocked && !isRisky && !isFinished && smartStake.amount > 0 && (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                                Bet: KES {smartStake.amount}
                            </span>
                        )}
                    </div>
                </div>

                {/* Match Info */}
                <div className={`mb-6 ${isLocked ? 'blur-sm select-none' : ''}`}>
                    <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex-1 text-right">
                            <span className="text-lg font-bold block">{homeTeam.name}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            {isFinished && goals ? (
                                <div className="bg-white/10 px-3 py-1 rounded text-white font-mono font-bold text-lg tracking-widest">
                                    {goals.home} - {goals.away}
                                </div>
                            ) : (
                                <span className="text-gray-500 text-xs font-mono font-bold">VS</span>
                            )}
                        </div>
                        <div className="flex-1 text-left">
                            <span className="text-lg font-bold block">{awayTeam.name}</span>
                        </div>
                    </div>
                    <p className="text-xs text-center text-gray-500 font-medium">
                        {format(new Date(date), "MMM dd")}
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
                    <div className={`p-4 rounded-lg border text-center ${style.border} ${style.bg} bg-opacity-20 relative overflow-hidden`}>
                        {/* Result Stamp */}
                        {result && (
                            <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${result === 'WON'
                                ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50'
                                : 'bg-red-500/20 text-red-500 border-red-500/50'
                                }`}>
                                {result === 'WON' ? '✅ Won' : '❌ Lost'}
                            </div>
                        )}

                        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">AI Prediction</p>
                        {hasPrediction ? (
                            <div>
                                {isRisky ? (
                                    <div className="flex flex-col items-center">
                                        <p className="text-xl font-bold text-red-500 mb-1">NO BET</p>
                                        <p className="text-xs text-red-400">
                                            {confidence}% confidence: {prediction.picked}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <p className={`text-xl font-bold ${style.color} ${result === 'LOST' ? 'line-through opacity-50' : ''}`}>
                                            {prediction.picked}
                                        </p>
                                        <p className={`text-xs mt-1 ${style.color} opacity-80 mb-2`}>
                                            {confidence}% confidence level
                                        </p>
                                    </div>
                                )}

                                {prediction.reasoning && (
                                    <div className="mt-3 pt-3 border-t border-white/5">
                                        <div className="flex items-center gap-1 mb-1.5">
                                            <span className="text-yellow-500 text-xs">💡</span>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Analysis</span>
                                        </div>
                                        <ul className="space-y-1 text-left">
                                            {(Array.isArray(prediction.reasoning) ? prediction.reasoning : [prediction.reasoning]).map((point, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-gray-300 italic">
                                                    <span className="text-yellow-500/50 not-italic mt-0.5">•</span> {point}
                                                </li>
                                            ))}
                                        </ul>
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
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col lg:flex-row gap-6 ">
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

                {/* Search Bar */}
                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="Search teams or leagues..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pl-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-colors"
                    />
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap items-center gap-4 py-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">League:</span>
                        <select
                            value={selectedLeague}
                            onChange={(e) => setSelectedLeague(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-yellow-500/50"
                        >
                            <option value="all">All Leagues</option>
                            {uniqueLeagues.map(league => (
                                <option key={league} value={league}>{league}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Type:</span>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-yellow-500/50"
                        >
                            <option value="all">All Predictions</option>
                            <option value="result">Match Result</option>
                            <option value="goals">Goals/Totlas</option>
                            <option value="score">Correct Score</option>
                        </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group ml-auto">
                        <input
                            type="checkbox"
                            checked={onlyHighConfidence}
                            onChange={(e) => setOnlyHighConfidence(e.target.checked)}
                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-yellow-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">70%+ Confidence Only</span>
                    </label>

                    <div className="ml-auto flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Showing</span>
                        <span className="font-bold text-yellow-500">{filteredFixtures.length}</span>
                        <span className="text-gray-500">of</span>
                        <span className="font-bold text-white">{fixtures.length}</span>
                        <span className="text-gray-500">matches</span>
                    </div>
                </div>
            </div>

            {/* Fixtures Grid */}
            {loadingFixtures ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Activity className="w-8 h-8 animate-spin mb-4 text-yellow-500" />
                    <p>Analyzing market data...</p>
                </div>
            ) : filteredFixtures.length > 0 ? (
                <div className="space-y-12">
                    {/* Active / Future Games */}
                    {(activeFixtures.length > 0 || finishedFixtures.length === 0) && (
                        <section>
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                Live & Upcoming Actions
                            </h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {activeFixtures.map((fixture) => (
                                    <TipCard key={fixture.id} fixture={fixture} />
                                ))}
                                {activeFixtures.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-500 text-sm italic">
                                        No upcoming matches scheduled for this selection. Check results below.
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Finished Results */}
                    {finishedFixtures.length > 0 && (
                        <section className="opacity-75">
                            <div className="flex items-center gap-2 mb-6 pt-8 border-t border-white/5">
                                <h2 className="text-xl font-bold text-gray-300">Today's Results</h2>
                                <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-xs font-bold uppercase">Finished</span>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {finishedFixtures.map((fixture) => (
                                    <TipCard key={fixture.id} fixture={fixture} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            ) : (
                <div className="text-center py-24 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                    <div className="mb-4">
                        <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-gray-500 mb-2 font-medium text-lg">
                            {searchQuery ? `No matches found for "${searchQuery}"` : `No matches match your criteria for ${format(selectedDate, "MMM dd")}`}
                        </p>
                        <p className="text-gray-600 text-sm mb-6">Try adjusting your filters or search terms</p>
                    </div>
                    <Button
                        variant="link"
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedLeague("all");
                            setOnlyHighConfidence(false);
                            setSelectedType("all");
                        }}
                        className="text-yellow-500 font-bold"
                    >
                        Clear all filters
                    </Button>
                </div>
            )}
        </div>
    );
}
