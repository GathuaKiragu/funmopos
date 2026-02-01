"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Fixture } from "@/lib/api-football";
import { getResult } from "@/lib/utils";

export function PerformanceTicker() {
    const [stats, setStats] = useState<{ match: string; result: 'WON' | 'LOST' | 'VOID'; pick: string; confidence: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPerformance = async () => {
            try {
                const res = await fetch('/api/performance?days=7');
                const data = await res.json();

                if (data.fixtures) {
                    const vipFixtures = data.fixtures
                        .filter((f: Fixture) => {
                            const conf = f.prediction?.confidence || 0;
                            const isRisky = f.prediction?.isRisky || false;
                            // Strict VIP Filter (>85% and Not Risky)
                            return conf > 85 && !isRisky;
                        })
                        .map((f: Fixture) => ({
                            match: `${f.homeTeam.name} vs ${f.awayTeam.name}`,
                            result: getResult(f.prediction, f),
                            pick: f.prediction?.picked,
                            confidence: f.prediction?.confidence
                        }))
                        .filter((s: any) => s.result === 'WON' || s.result === 'LOST'); // Only show settled bets

                    setStats(vipFixtures.slice(0, 15)); // Show last 15
                }
            } catch (err) {
                console.error("Ticker fetch error", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPerformance();
    }, []);

    if (loading || stats.length === 0) return null;

    return (
        <div className="w-full bg-black border-y border-white/5 py-2.5 overflow-hidden relative z-40">
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black to-transparent z-10" />

            <div className="flex animate-scroll whitespace-nowrap hover:paused">
                {/* Triple list for smoother infinite scroll on wide screens */}
                {[...stats, ...stats, ...stats].map((stat, i) => (
                    <div key={i} className="flex items-center gap-2 mx-6 text-xs sm:text-sm">
                        {stat.result === 'WON' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <span className="font-bold text-gray-200">{stat.match}</span>
                        <span className="text-gray-500">({stat.pick})</span>
                        <span className={`font-mono font-bold ${stat.result === 'WON' ? 'text-emerald-500' : 'text-red-500'}`}>
                            {stat.result === 'WON' ? 'WON' : 'LOST'}
                        </span>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .animate-scroll {
                    animation: scroll 30s linear infinite;
                }
                .hover\\:paused:hover {
                    animation-play-state: paused;
                }
                @keyframes scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
            `}</style>
        </div>
    );
}
