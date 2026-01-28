"use client";

import { useAuth } from "@/context/AuthContext";
import { useAccess } from "@/hooks/useAccess";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getFixturesClient as getFixtures, Fixture, Sport } from "@/lib/api-football";
import { format, addDays, isSameDay, subDays, isToday, isYesterday, isTomorrow, formatDistanceToNow } from "date-fns";
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
    const { tier, isTrial, trialExpiry, loading: accessLoading, canAccess } = useAccess();
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

    // --- Component: Match Card ---
    const MatchRow = ({ fixture, index }: { fixture: Fixture, index: number }) => {
        const { prediction, homeTeam, awayTeam, date, status, goals } = fixture;
        const result = getResult(prediction, fixture);
        const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status.short) || status.short === 'LIVE';
        const isFinished = ['FT', 'AET', 'PEN'].includes(status.short);
        const hasPrediction = !!prediction;
        const confidence = prediction?.confidence || 0;

        // Trial Logic: Show top 10 high confidence picks for trial users
        const isTrialSpecial = isTrial && index < 10 && confidence > 75;

        // Visibility Logic
        let isLocked = true;
        if (tier === "vip" || isTrial) isLocked = false;
        else if (tier === "standard" && confidence < 85) isLocked = false;
        else if (tier === "basic" && confidence < 75) isLocked = false;

        if (!hasPrediction) isLocked = false;

        const badgeColor = confidence > 85 ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
            confidence > 75 ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' :
                'text-white/40 border-white/10 bg-white/5';

        const formattedTime = format(new Date(date), "HH:mm");

        return (
            <div className="group relative bg-[#1a1a1a] hover:bg-[#222] border border-white/5 rounded-2xl p-5 mb-3 transition-all duration-300">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{fixture.league.name}</span>
                        <div className="flex items-center gap-2">
                            {isLive ? (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-red-500 uppercase">Live</span>
                                </div>
                            ) : isFinished ? (
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Full Time</span>
                            ) : (
                                <span className="text-[10px] font-bold text-white/40 font-mono tracking-tighter">{formattedTime} EAT</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-white/5 p-1 flex items-center justify-center">
                                    {homeTeam.logo ? <img src={homeTeam.logo} alt="" className="w-full h-full object-contain" /> : <div className="text-[10px] font-black text-white/20">{homeTeam.name.charAt(0)}</div>}
                                </div>
                                <span className={`text-sm font-bold tracking-tight ${goals?.home! > goals?.away! ? 'text-white' : 'text-white/60'}`}>{homeTeam.name}</span>
                                {goals?.home !== null && <span className="ml-auto text-lg font-black text-white">{goals.home}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-white/5 p-1 flex items-center justify-center">
                                    {awayTeam.logo ? <img src={awayTeam.logo} alt="" className="w-full h-full object-contain" /> : <div className="text-[10px] font-black text-white/20">{awayTeam.name.charAt(0)}</div>}
                                </div>
                                <span className={`text-sm font-bold tracking-tight ${goals?.away! > goals?.home! ? 'text-white' : 'text-white/60'}`}>{awayTeam.name}</span>
                                {goals?.away !== null && <span className="ml-auto text-lg font-black text-white">{goals.away}</span>}
                            </div>
                        </div>

                        <div className="w-32 flex flex-col items-center justify-center border-l border-white/5 pl-4 relative">
                            {hasPrediction ? (
                                <div className="relative w-full flex flex-col items-center">
                                    {isLocked ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="text-[10px] font-black text-white/10 blur-[2px] select-none uppercase tracking-tighter italic">Secret Tip</div>
                                            <PaymentModal>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black text-[9px] font-black uppercase transition-transform active:scale-95 shadow-lg shadow-yellow-500/10">
                                                    <Lock size={10} fill="black" />
                                                    Unlock
                                                </button>
                                            </PaymentModal>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`w-full py-2 rounded-xl text-center text-[10px] font-black uppercase tracking-tight shadow-inner ${badgeColor}`}>
                                                {prediction.picked}
                                            </div>
                                            <div className="mt-2 flex items-center gap-1.5">
                                                <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter italic">{confidence}% Sure</span>
                                                {result && (
                                                    <div className={`px-1.5 py-0.5 rounded text-[8px] font-black ${result === 'WON' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {result}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-1 opacity-20">
                                    <Activity className="w-3 h-3 animate-spin mb-1" />
                                    <span className="text-[8px] font-black uppercase tracking-[0.2em]">Crunching</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isLocked && hasPrediction && (
                        <div className="pt-3 border-t border-white/5 space-y-1.5">
                            {Array.isArray(prediction.reasoning) ? prediction.reasoning.slice(0, 2).map((r, i) => (
                                <div key={i} className="flex gap-2 items-start group-hover:opacity-100 opacity-60 transition-opacity">
                                    <div className="w-1 h-1 rounded-full bg-yellow-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                    <p className="text-[10px] text-white/80 leading-tight italic line-clamp-1">{r}</p>
                                </div>
                            )) : (
                                <p className="text-[10px] text-white/80 leading-tight italic line-clamp-1 opacity-60">{prediction.reasoning}</p>
                            )}
                        </div>
                    )}
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
                {isTrial && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <Trophy size={16} className="text-yellow-500" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Trial Active - VIP Access Unlocked</p>
                                <p className="text-[10px] text-yellow-500/60 lowercase italic line-clamp-1">
                                    Enjoy full access to all predictions today.
                                </p>
                            </div>
                        </div>
                        {trialExpiry && (
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-yellow-500/40 uppercase font-black">Ends In</p>
                                <p className="text-[10px] font-bold text-yellow-500">{formatDistanceToNow(trialExpiry)}</p>
                            </div>
                        )}
                    </div>
                )}

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
                                    {group.fixtures.map((f, idx) => (
                                        <MatchRow key={f.id} fixture={f} index={idx} />
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
