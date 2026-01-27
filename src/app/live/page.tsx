"use client";

import { useEffect, useState } from "react";
import { getFixturesClient as getFixtures, Fixture } from "@/lib/api-football";
import { Activity, Podcast } from "lucide-react";
import { format } from "date-fns";

export default function LivePage() {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLive = async () => {
        setLoading(true);
        // Fetch TODAY's data
        const data = await getFixtures(new Date(), "football", true);
        // Client-side filter for LIVE status
        const live = data.filter(f => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(f.status.short));
        setFixtures(live);
        setLoading(false);
    };

    useEffect(() => {
        loadLive();
        // Auto-refresh every 60s
        const interval = setInterval(loadLive, 60000);
        return () => clearInterval(interval);
    }, []);

    const groupedLive = fixtures.reduce((acc: any[], curr) => {
        const existing = acc.find(g => g.league === curr.league.name);
        if (existing) existing.fixtures.push(curr);
        else acc.push({ league: curr.league.name, flag: curr.league.flag, fixtures: [curr] });
        return acc;
    }, []).sort((a, b) => a.league.localeCompare(b.league));

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <h1 className="text-3xl font-black uppercase italic tracking-tighter">Live <span className="text-red-500">Action</span></h1>
                    </div>
                    <div className="px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <Podcast className="w-4 h-4" />
                        {fixtures.length} Active
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Activity className="w-8 h-8 text-red-500 animate-spin mb-4" />
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Scanning Live Feeds...</p>
                    </div>
                ) : fixtures.length > 0 ? (
                    <div className="space-y-8">
                        {groupedLive.map((group: any) => (
                            <section key={group.league} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center gap-3 mb-4 pl-1">
                                    {group.flag && <img src={group.flag} className="w-4 h-4 rounded-full object-cover" />}
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">{group.league}</h3>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {group.fixtures.map((f: Fixture) => (
                                        <div key={f.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2 w-16 text-center border-r border-white/5 pr-4">
                                                <span className="text-red-500 font-black text-xs animate-pulse">LIVE</span>
                                                {f.status.elapsed && <span className="text-gray-500 text-[10px] font-mono">{f.status.elapsed}'</span>}
                                            </div>
                                            <div className="flex-1 flex flex-col justify-center gap-2 px-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-bold text-white">{f.homeTeam.name}</span>
                                                    <span className="text-lg font-mono font-black text-yellow-500">{f.goals.home}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-bold text-white">{f.awayTeam.name}</span>
                                                    <span className="text-lg font-mono font-black text-yellow-500">{f.goals.away}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 opacity-50">
                        <p className="text-xl font-black uppercase text-gray-600">No Live Games</p>
                        <p className="text-sm text-gray-500">Check back later for realtime action.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
