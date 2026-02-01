
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Fixture } from "@/lib/api-football";
import { Activity, CheckCircle, XCircle, TrendingUp, Calendar, AlertCircle, Trophy, CheckCircle2, MinusCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import axios from "axios";
import { getResult } from "@/lib/utils";

interface PerformanceModalProps {
    trigger?: React.ReactNode;
}

export function PerformanceModal({ trigger }: PerformanceModalProps) {
    const [matches, setMatches] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [filterMode, setFilterMode] = useState<'ALL' | 'VIP'>('VIP');

    const loadPerformance = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/performance?days=30');
            setMatches(res.data.fixtures || []);
        } catch (error) {
            console.error("Failed to load performance", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadPerformance();
        }
    }, [isOpen]);

    // Filter Logic
    const filteredMatches = matches.filter(m => {
        if (filterMode === 'ALL') return true;
        // VIP Filter: High confidence OR explicitly VIP tier
        const confidence = m.prediction?.confidence || 0;
        const isRisky = m.prediction?.isRisky || false;
        return confidence >= 80 && !isRisky;
    });

    // Calculate Financials (Value Proof)
    let totalStaked = 0;
    let totalReturned = 0;
    let wins = 0;
    let lost = 0;
    let oddsSum = 0;

    filteredMatches.forEach(m => {
        const result = getResult(m.prediction, m);
        if (result === 'WON' || result === 'LOST') {
            totalStaked += 1;

            // Resolve Odds
            let odds = 1.75; // Conservative baseline
            if (m.openingOdds && m.prediction) {
                const pick = m.prediction.picked.toLowerCase();
                if (pick.includes('home')) odds = m.openingOdds.home;
                else if (pick.includes('away')) odds = m.openingOdds.away;
                else if (pick.includes('draw')) odds = m.openingOdds.draw;
            }
            // Cap crazy odds to avoid skewing stats with errors
            if (odds > 5) odds = 5;
            if (odds < 1.1) odds = 1.1;

            oddsSum += odds;

            if (result === 'WON') {
                wins++;
                totalReturned += odds;
            } else {
                lost++;
            }
        }
    });

    const netProfit = totalReturned - totalStaked;
    const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;
    const avgOdds = totalStaked > 0 ? (oddsSum / totalStaked).toFixed(2) : "1.80";
    const winRate = totalStaked > 0 ? Math.round((wins / totalStaked) * 100) : 0;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <TrendingUp className="w-4 h-4" />
                        View Track Record
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="bg-[#121212] border-white/10 text-white max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight">
                                <Activity className="w-6 h-6 text-emerald-500" />
                                Value Report
                            </DialogTitle>
                            <DialogDescription className="text-gray-400 text-xs mt-1">
                                Real-time audit of our VIP performance.
                            </DialogDescription>
                        </div>
                    </div>

                    {!loading && totalStaked > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Key Value Metric: Profit */}
                            <div className={`col-span-2 md:col-span-2 p-4 rounded-2xl border ${netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'} flex flex-col justify-center`}>
                                <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Net Profit (Units)</p>
                                <div className="flex items-baseline gap-2">
                                    <h3 className={`text-4xl font-black ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {netProfit > 0 ? '+' : ''}{netProfit.toFixed(2)}
                                    </h3>
                                    <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded text-white/50">Units</span>
                                </div>
                                <p className="text-[10px] mt-2 font-mono opacity-50">
                                    {netProfit >= 0 ? '↗ Capital Growth' : '↘ Drawdown Phase'}
                                </p>
                            </div>

                            {/* Secondary Stats */}
                            <div className="space-y-2">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                                    <p className="text-[9px] uppercase font-bold text-gray-500">ROI</p>
                                    <p className={`text-xl font-black ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{roi.toFixed(1)}%</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                                    <p className="text-[9px] uppercase font-bold text-gray-500">Avg Odds</p>
                                    <p className="text-xl font-black text-white">{avgOdds}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                                    <p className="text-[9px] uppercase font-bold text-gray-500">Win Rate</p>
                                    <p className="text-xl font-black text-yellow-500">{winRate}%</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                                    <p className="text-[9px] uppercase font-bold text-gray-500">Record</p>
                                    <p className="text-xl font-black text-white">{wins}W - {lost}L</p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                <ScrollArea className="flex-1 p-0 bg-black/20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <Activity className="w-8 h-8 animate-spin text-yellow-500 mb-4" />
                            Auditing results...
                        </div>
                    ) : totalStaked === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <AlertCircle className="w-8 h-8 mb-2" />
                            No settled matches found.
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {filteredMatches.map((fixture) => {
                                const result = getResult(fixture.prediction, fixture);
                                const isWon = result === 'WON';
                                const isPending = result === null;
                                // Resolve Odds (Local Scope)
                                let oddsDisplay = "1.75";
                                if (fixture.openingOdds && fixture.prediction) {
                                    const pick = fixture.prediction.picked.toLowerCase();
                                    if (pick.includes('home')) oddsDisplay = fixture.openingOdds.home.toFixed(2);
                                    else if (pick.includes('away')) oddsDisplay = fixture.openingOdds.away.toFixed(2);
                                    else if (pick.includes('draw')) oddsDisplay = fixture.openingOdds.draw.toFixed(2);
                                }

                                return (
                                    <div key={fixture.id} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{format(new Date(fixture.date), "dd MMM")}</span>
                                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${result === 'WON' ? 'bg-emerald-500/10 text-emerald-500' : result === 'LOST' ? 'bg-red-500/10 text-red-500' : 'bg-gray-800 text-gray-500'}`}>
                                                    {result || 'PENDING'}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-white mb-1">
                                                {fixture.homeTeam.name} vs {fixture.awayTeam.name}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="text-gray-400">Tip: <strong className="text-white">{fixture.prediction?.picked}</strong></span>
                                                <span className="text-gray-400">Odds: <strong className="text-emerald-400">{oddsDisplay}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t border-white/10 bg-[#1a1a1a] shrink-0">
                    <Button onClick={() => setIsOpen(false)} className="w-full bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200">
                        Close Report
                    </Button>
                </div>
            </DialogContent>
        </Dialog >
    );
}
