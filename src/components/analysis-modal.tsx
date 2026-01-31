"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Fixture } from "@/lib/api-football";
import { Brain, TrendingUp, AlertTriangle } from "lucide-react";

interface MatchAnalysisModalProps {
    fixture: Fixture;
    trigger?: React.ReactNode;
}

export function MatchAnalysisModal({ fixture, trigger }: MatchAnalysisModalProps) {
    if (!fixture.prediction) return null;

    const analysis = fixture.prediction.analysis || "";
    const isRisky = fixture.prediction.isRisky;
    const confidence = fixture.prediction.confidence;

    // Helper to parse sections (Overview, Key Points, Expectation)
    const parseSections = (text: string) => {
        // FALLBACK: If analysis is missing/empty, use reasoning
        if (!text || text.trim().length === 0) {
            const reasoning = Array.isArray(fixture.prediction?.reasoning)
                ? fixture.prediction?.reasoning.join('\n• ')
                : fixture.prediction?.reasoning;

            return [{
                title: "Key Analysis Points",
                content: `• ${reasoning || "No detailed analysis available yet. Check back closer to kick-off."}`
            }];
        }

        // If legacy format (no ### headers), return as simple paragraphs
        if (!text.includes("###")) {
            return [{ title: "Analysis", content: text }];
        }

        const sections = text.split("###").filter(s => s.trim().length > 0);
        return sections.map(s => {
            const [title, ...rest] = s.trim().split('\n');
            const content = rest.join('\n').trim();
            return { title, content };
        });
    };

    const sections = parseSections(analysis);

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="text-[9px] font-black text-yellow-500/40 uppercase tracking-tighter mt-1 hover:text-yellow-500 transition-colors">
                        Click to read more...
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="bg-[#121212] border-white/10 text-white max-w-lg max-h-[85vh] p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center p-2">
                            {fixture.homeTeam.logo ? (
                                <img src={fixture.homeTeam.logo} className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-xs font-bold">{fixture.homeTeam.name[0]}</span>
                            )}
                        </div>
                        <span className="text-xl font-bold text-gray-500">vs</span>
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center p-2">
                            {fixture.awayTeam.logo ? (
                                <img src={fixture.awayTeam.logo} className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-xs font-bold">{fixture.awayTeam.name[0]}</span>
                            )}
                        </div>
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs font-mono uppercase tracking-widest text-gray-500 pt-2">
                        {fixture.league.name} • {new Date(fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6 pt-2 h-[400px]">
                    {/* Prediction Header */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <div className={`px-4 py-2 rounded-xl border ${isRisky ? 'border-amber-500/30 bg-amber-500/10' :
                            confidence > 85 ? 'border-yellow-500/30 bg-yellow-500/10' :
                                'border-emerald-500/30 bg-emerald-500/10'
                            } text-center w-full`}>
                            <p className="text-[10px] uppercase tracking-widest font-black opacity-60 mb-1">AI Recommendation</p>
                            <p className={`text-xl font-black uppercase ${isRisky ? 'text-amber-500' :
                                confidence > 85 ? 'text-yellow-500' :
                                    'text-emerald-500'
                                }`}>
                                {fixture.prediction.picked}
                            </p>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                            <Brain className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold text-gray-400">Confidence: <span className="text-white">{confidence}%</span></span>
                        </div>
                    </div>

                    {/* Detailed Analysis Sections */}
                    <div className="space-y-6">
                        {sections.map((section, idx) => (
                            <div key={idx} className="space-y-2">
                                <h4 className="text-sm font-bold text-yellow-500 uppercase tracking-wide border-b border-white/5 pb-1">
                                    {section.title}
                                </h4>
                                <div className="text-sm text-gray-300 leading-relaxed font-light whitespace-pre-line">
                                    {section.content.split('•').map((point, pIdx) => (
                                        pIdx === 0 ? point : (
                                            <div key={pIdx} className="flex gap-2 items-start mt-1">
                                                <span className="text-yellow-500 mt-1.5 text-[10px]">●</span>
                                                <span className="flex-1">{point.trim().replace(/^•\s*/, '')}</span>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                        ))}

                        {fixture.prediction.requiresTier === 'vip' && (
                            <div className="mt-4 p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                                <p className="text-[10px] text-yellow-500 italic text-center">
                                    This is a Premium VIP analysis based on 30-day statistical models.
                                </p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-white/10 bg-black/40">
                    <Button onClick={() => document.querySelector('[data-state="open"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))} variant="outline" className="w-full text-xs uppercase tracking-widest border-white/10 hover:bg-white/5">
                        Close Analysis
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
