"use client";

import { Brain, TrendingUp, Shield, Activity, Users, Lock, ChevronRight, BarChart3, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import LayoutWrapper from "@/components/layout-wrapper";

export default function AboutPage() {
    return (
        <LayoutWrapper>
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white pb-20 md:pb-0">
                {/* Hero Section */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
                    <div className="relative pt-12 pb-16 md:pt-24 md:pb-32 px-6 max-w-7xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-semibold uppercase tracking-wider mb-6">
                            <Brain className="w-4 h-4" />
                            <span>The Science of Winning</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                            Beyond Guesswork.<br />
                            Powered by Intelligence.
                        </h1>
                        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                            Funmo Tips replaces gut feeling with advanced statistical modeling.
                            We analyze thousands of data points to identify value where others see chaos.
                        </p>
                        <Link href="/dashboard">
                            <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold h-12 px-8 rounded-full text-base shadow-lg shadow-yellow-500/20 transition-all hover:scale-105">
                                Explore the Dashboard <ChevronRight className="w-5 h-5 ml-2" />
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* How It Works Grid */}
                <div className="px-6 max-w-7xl mx-auto mb-24">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Our Methodology</h2>
                        <p className="text-gray-400">A rigorous three-step process to ensure maximum accuracy.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Step 1: Data Aggregation */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Database className="w-24 h-24" />
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
                                <Database className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">1. Data Aggregation</h3>
                            <p className="text-gray-400 leading-relaxed">
                                We ingest raw data from premium sources covering over 100 leagues.
                                This includes expected goals (xG), player heatmaps, historical head-to-head records,
                                and real-time injury reports.
                            </p>
                        </div>

                        {/* Step 2: Algorithmic Analysis */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Brain className="w-24 h-24" />
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6">
                                <Brain className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">2. Predictive Modeling</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Our proprietary AI models process this data to simulate matches thousands of times.
                                We weigh current form more heavily than historical reputation to find true market value.
                            </p>
                        </div>

                        {/* Step 3: Risk Assessment */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-green-500/30 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Shield className="w-24 h-24" />
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-6">
                                <Shield className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">3. Risk Assessment</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Every prediction is assigned a confidence score. We don't just tell you who might win;
                                we tell you the probability and the associated risk level (Safe, Medium, Risky).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div className="bg-white/5 border-y border-white/5 py-24">
                    <div className="px-6 max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div>
                                <h2 className="text-3xl font-bold mb-6">Why Smart Bettors Choose Funmo</h2>
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                                <TrendingUp className="w-4 h-4 text-cyan-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg">Transparent Performance</h4>
                                            <p className="text-gray-400">We don't hide our losses. Our history is open for verification because we are confident in our long-term profitability.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                                                <Activity className="w-4 h-4 text-orange-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg">Real-Time Adaptation</h4>
                                            <p className="text-gray-400">Our models update instantly when lineups are announced or odds shift significantly.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                                                <Lock className="w-4 h-4 text-pink-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg">Bankroll Management</h4>
                                            <p className="text-gray-400">We provide tools to track your portfolio so you stay in control of your finances.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-purple-500/20 blur-3xl rounded-full opacity-30" />
                                <div className="relative bg-black/50 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
                                    <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                                        <h3 className="font-bold text-gray-200">Recent Accuracy</h3>
                                        <span className="text-green-400 font-mono font-bold">84%</span>
                                    </div>
                                    <div className="space-y-4">
                                        {[1, 2, 3].map((_, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 text-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                                    <span className="text-gray-300">Match Prediction #{1000 + i}</span>
                                                </div>
                                                <span className="text-green-500 font-bold">WON</span>
                                            </div>
                                        ))}
                                        <div className="pt-4 mt-4 border-t border-white/10 text-center">
                                            <p className="text-xs text-gray-500 uppercase tracking-widest">Live Model Performance</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer / Disclaimer */}
                <div className="px-6 py-12 max-w-4xl mx-auto text-center">
                    <p className="text-sm text-gray-500 mb-6">
                        <strong>Disclaimer:</strong> Sports betting involves risk. While our algorithms are designed to provide a statistical edge,
                        outcomes are never guaranteed. Please gamble responsibly and only bet what you can afford to lose.
                    </p>
                    <Link href="/signup">
                        <Button variant="link" className="text-gray-400 hover:text-white">
                            Join Funmo Tips Today
                        </Button>
                    </Link>
                </div>
            </div>
        </LayoutWrapper>
    );
}
