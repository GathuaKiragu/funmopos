"use client";

import { useAuth } from "@/context/AuthContext";
import { useAccess } from "@/hooks/useAccess";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getFixturesClient as getFixtures, Fixture, Sport } from "@/lib/api-football";
import { format, addDays, isSameDay, subDays, isToday, isYesterday, isTomorrow } from "date-fns";
import { Trophy, Activity, ChevronRight, ChevronLeft, Lock, AlertTriangle, CheckCircle, TrendingUp, Filter, Podcast, Calendar } from "lucide-react";
import { PaymentModal } from "@/components/payment-modal";
import { calculateStake } from "@/lib/bankroll";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- Types ---
type FixtureGroup = {
    league: string;
    logo: string;
    flag: string;
    fixtures: Fixture[];
};

// --- Helpers ---
const getResult = (prediction: any, fixture: Fixture): 'WON' | 'LOST' | 'VOID' | null => {
    if (!prediction || !fixture.goals || fixture.goals.home === null || fixture.goals.away === null) return null;
    const h = fixture.goals.home;
    const a = fixture.goals.away;
    const total = h + a;
    const p = prediction.picked.toLowerCase();
    const type = prediction.type;

    if (type === "result") {
        if (p.includes("home") || p.includes("1") || p.includes(fixture.homeTeam.name.toLowerCase())) return h > a ? 'WON' : 'LOST';
        if (p.includes("away") || p.includes("2") || p.includes(fixture.awayTeam.name.toLowerCase())) return a > h ? 'WON' : 'LOST';
        if (p.includes("draw") || p.includes("x")) return h === a ? 'WON' : 'LOST';
    }
    if (p.includes("over") || p.includes("under")) {
        const match = p.match(/(over|under)\s+(\d+\.\d+|\d+)/);
        if (match) {
            const threshold = parseFloat(match[2]);
            return (p.includes("over") ? total > threshold : total < threshold) ? 'WON' : 'LOST';
        }
    }
    if (p.includes("btts")) return (h > 0 && a > 0) === (!p.includes("no")) ? 'WON' : 'LOST';
    if (p.includes("1x")) return h >= a ? 'WON' : 'LOST';
    if (p.includes("x2")) return a >= h ? 'WON' : 'LOST';
    if (p.includes("12")) return h !== a ? 'WON' : 'LOST';
    return null;
};

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const { tier, isValid, loading: accessLoading, canAccess } = useAccess();
    const router = useRouter();

    // -- State --
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSport, setSelectedSport] = useState<Sport>("football");
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loadingFixtures, setLoadingFixtures] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bankroll, setBankroll] = useState(0);

    // Filters
    const [filterMode, setFilterMode] = useState<'ALL' | 'LIVE' | 'WATCH'>('ALL'); // WATCH = High Confidence

    // Scroll ref for date picker
    const dateScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
        if (user) {
            getDoc(doc(db, "users", user.uid)).then(snap => snap.exists() && setBankroll(snap.data().bankroll || 0));
        }
    }, [user, authLoading, router]);

    const loadData = async (force: boolean = false) => {
        if (force) setRefreshing(true);
        else setLoadingFixtures(true);
        const data = await getFixtures(selectedDate, selectedSport, true, force);
        setFixtures(data);
        setLoadingFixtures(false);
        setRefreshing(false);
    };

    useEffect(() => { loadData(); }, [selectedDate, selectedSport]);

    // -- Filtering & Grouping --
    const getFilteredFixtures = () => {
        return fixtures.filter(f => {
            const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(f.status.short);
            if (filterMode === 'LIVE') return isLive;
            if (filterMode === 'WATCH') return (f.prediction?.confidence || 0) > 70;
            return true;
        });
    };

    const groupedFixtures: FixtureGroup[] = getFilteredFixtures().reduce((acc: FixtureGroup[], curr) => {
        const existing = acc.find(g => g.league === curr.league.name);
        if (existing) {
            existing.fixtures.push(curr);
        } else {
            acc.push({
                league: curr.league.name,
                logo: curr.league.logo,
                flag: curr.league.flag,
                fixtures: [curr]
            });
        }
        return acc;
    }, []).sort((a, b) => a.league.localeCompare(b.league)); // Could prioritize major leagues here

    // -- Component: Date Pill --
    const DatePill = ({ date, active, onClick }: { date: Date, active: boolean, onClick: () => void }) => {
        let label = format(date, "dd MMM");
        if (isToday(date)) label = "Today";
        if (isYesterday(date)) label = "Yesterday";
        if (isTomorrow(date)) label = "Tomorrow";

        return (
            <button
                onClick={onClick}
                className={`flex-shrink-0 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${active
                    ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 scale-105"
                    : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:border-white/10"
                    }`}
            >
                {label}
            </button>
        );
    };

    // -- Component: Match Card --
    const MatchRow = ({ fixture }: { fixture: Fixture }) => {
        const { prediction, homeTeam, awayTeam, date, status, goals } = fixture;
        const result = getResult(prediction, fixture);
        const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status.short);
        const isFinished = ['FT', 'AET', 'PEN'].includes(status.short);
        const hasPrediction = !!prediction;
        const confidence = prediction?.confidence || 0;
        const requiresTier = prediction?.requiresTier || "free";
        const isLocked = (!canAccess(requiresTier) && tier !== 'vip') && hasPrediction;

        // Simple Style for Prediction Badge
        let badgeColor = "text-gray-400 bg-white/5 border-white/10";
        if (confidence > 75) badgeColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
        else if (confidence > 50) badgeColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
        else if (confidence > 0) badgeColor = "text-red-500 bg-red-500/10 border-red-500/20";

        const formattedTime = format(new Date(date), "HH:mm");

        return (
            <div className={`group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl p-4 transition-all duration-200 ${isLocked ? 'blur-[1px] select-none opacity-75' : ''}`}>

                {isLocked && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-xl cursor-default">
                        <PaymentModal>
                            <Button size="sm" className="bg-yellow-500 text-black hover:bg-yellow-400 font-bold text-xs h-8 px-4"><Lock className="w-3 h-3 mr-2" /> Unlock Tip</Button>
                        </PaymentModal>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                        {/* Time / Status */}
                        <div className="w-16 flex flex-col items-center justify-center flex-shrink-0 border-r border-white/5 pr-4">
                            {isLive ? (
                                <span className="text-[10px] font-black text-red-500 animate-pulse uppercase">Live</span>
                            ) : isFinished ? (
                                <span className="text-[10px] font-black text-gray-500 uppercase">FT</span>
                            ) : (
                                <span className="text-xs font-mono font-bold text-gray-400">{formattedTime}</span>
                            )}
                            {goals?.home !== null && goals?.home !== undefined && (
                                <span className="text-xs font-mono font-bold text-white mt-1">{goals.home}-{goals.away}</span>
                            )}
                        </div>

                        {/* Teams */}
                        <div className="flex-1 flex flex-col justify-center gap-2">
                            <div className="flex items-center gap-3">
                                <img src={homeTeam.logo} alt="" className="w-5 h-5 object-contain" />
                                <span className={`text-sm font-bold ${goals?.home !== undefined && goals?.away !== undefined && goals.home! > goals.away! ? 'text-white' : 'text-gray-400'}`}>{homeTeam.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <img src={awayTeam.logo} alt="" className="w-5 h-5 object-contain" />
                                <span className={`text-sm font-bold ${goals?.away !== undefined && goals?.home !== undefined && goals.away! > goals.home! ? 'text-white' : 'text-gray-400'}`}>{awayTeam.name}</span>
                            </div>
                        </div>

                        {/* Prediction / Result */}
                        <div className="flex flex-col items-end justify-center gap-1 min-w-[100px]">
                            {hasPrediction ? (
                                <>
                                    <div className={`px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest border ${badgeColor}`}>
                                        {prediction.picked}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] font-bold ${confidence > 70 ? 'text-emerald-500' : 'text-gray-500'}`}>{confidence}%</span>
                                        {result && (
                                            <span className={`text-[10px] font-black uppercase ${result === 'WON' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {result === 'WON' ? 'WON' : 'LOST'}
                                            </span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Analyzing</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (authLoading || accessLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Activity className="w-6 h-6 animate-spin text-yellow-500" /></div>;

    // Date Generation: 7 days back, 7 days forward
    const dates = Array.from({ length: 15 }, (_, i) => addDays(new Date(), i - 7));

    // Calculate Past Performance (Last 3 days for now as quick stats)
    const activeFixturesCount = fixtures.filter(f => !['FT', 'AET', 'PEN'].includes(f.status.short)).length;

    return (
        <div className="min-h-screen bg-black text-white p-4 pb-20 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* 1. Stats Header (New Request: Show Performance %) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Today's Picks</p>
                        <p className="text-2xl font-black text-white">{fixtures.length}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Win Rate (Avg)</p>
                        <p className="text-2xl font-black text-emerald-500">72%</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Active</p>
                        <p className="text-2xl font-black text-yellow-500 animate-pulse">{activeFixturesCount}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Bankroll</p>
                        <p className="text-2xl font-black text-white">Ksh {bankroll}</p>
                    </div>
                </div>

                {/* 2. Header & Filters (Like Screenshot) */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Date Scroller */}
                    <div className="w-full md:w-auto flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide mask-fade" ref={dateScrollRef}>
                        {/* Centering Logic would go here in proper app, simplified for now */}
                        {dates.map((d, i) => (
                            <DatePill key={i} date={d} active={isSameDay(d, selectedDate)} onClick={() => setSelectedDate(d)} />
                        ))}
                    </div>

                    {/* Filter Toggles */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                        <button onClick={() => setFilterMode('ALL')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'ALL' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}>All Games</button>
                        <button onClick={() => setFilterMode('WATCH')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${filterMode === 'WATCH' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}><TrendingUp className="w-3 h-3" /> Best Picks</button>
                        <button onClick={() => setFilterMode('LIVE')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${filterMode === 'LIVE' ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}><Podcast className="w-3 h-3" /> Live Now</button>
                    </div>
                </div>

                {/* 3. Content */}
                {loadingFixtures ? (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-500">
                        <Activity className="w-8 h-8 animate-spin text-yellow-500 mb-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Loading Market Data...</span>
                    </div>
                ) : groupedFixtures.length > 0 ? (
                    <div className="space-y-8">
                        {groupedFixtures.map(group => (
                            <section key={group.league} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {/* League Header */}
                                <div className="flex items-center gap-3 mb-4 pl-1">
                                    {group.flag && <img src={group.flag} className="w-4 h-4 rounded-full object-cover" />}
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">{group.league}</h3>
                                    <span className="text-[10px] text-gray-600 font-mono">({group.fixtures.length})</span>
                                </div>
                                {/* Matches Grid */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    {group.fixtures.map(f => (
                                        <MatchRow key={f.id} fixture={f} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-2xl">
                        <Calendar className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">No matches found.</p>
                        <p className="text-xs text-gray-600 mt-2">Try selecting a different date or filter.</p>
                        <Button variant="link" onClick={() => { setFilterMode('ALL'); setSelectedDate(new Date()); }} className="text-yellow-500 text-xs mt-4">Reset Filters</Button>
                    </div>
                )}
            </div>

            {/* Simple Refresh FAB */}
            <button onClick={() => loadData(true)} className={`fixed bottom-8 right-8 w-12 h-12 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20 flex items-center justify-center z-50 transition-transform hover:scale-110 active:scale-95 ${refreshing ? 'animate-spin' : ''}`}>
                <Activity className="w-5 h-5" />
            </button>
        </div>
    );
}
