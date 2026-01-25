"use client";

import { CheckCircle } from "lucide-react";

const recentWins = [
    { match: "Arsenal vs Chelsea", tip: "Home Win", odds: "1.85" },
    { match: "Man Utd vs Liverpool", tip: "Over 2.5", odds: "1.72" },
    { match: "Real Madrid vs Barcelona", tip: "BTTS", odds: "1.65" },
    { match: "Bayern vs Dortmund", tip: "Home Win & Over 2.5", odds: "2.10" },
    { match: "PSG vs Lyon", tip: "Home Win", odds: "1.55" },
    { match: "Milan vs Inter", tip: "Draw", odds: "3.40" },
];

export function PerformanceTicker() {
    return (
        <div className="w-full bg-emerald-900/10 border-y border-emerald-500/20 py-3 overflow-hidden">
            <div className="flex animate-scroll whitespace-nowrap">
                {/* Double the list for seamless loop */}
                {[...recentWins, ...recentWins].map((win, i) => (
                    <div key={i} className="flex items-center gap-2 mx-6 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-white">{win.match}</span>
                        <span className="text-gray-400">({win.tip})</span>
                        <span className="text-emerald-400 font-mono font-bold">Won @ {win.odds}</span>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .animate-scroll {
                    animation: scroll 20s linear infinite;
                }
                @keyframes scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
}
