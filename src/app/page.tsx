"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Trophy, Activity, Lock, AlertTriangle, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { getFixtures, Fixture, Sport } from "@/lib/api-football";

export default function Home() {
  const { user } = useAuth();
  const [selectedSport, setSelectedSport] = useState<Sport>("football");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFixtures = async () => {
      setLoading(true);
      const data = await getFixtures(new Date(), selectedSport);
      setFixtures(data.slice(0, 3)); // Just show top 3
      setLoading(false);
    };
    loadFixtures();
  }, [selectedSport]);

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col font-sans selection:bg-yellow-500/30">

      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-500 w-8 h-8 rounded-lg flex items-center justify-center">
              <span className="font-bold text-black text-lg">F</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Funmo Tips</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/profile" className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  <UserIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">My Account</span>
                </Link>
                <Link href="/dashboard">
                  <Button className="bg-yellow-500 text-black hover:bg-yellow-400 font-semibold rounded-full px-6">
                    Dashboard
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  Log in
                </Link>
                <Link href="/signup">
                  <Button className="bg-white text-black hover:bg-gray-200 font-semibold rounded-full px-6">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24">

        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-yellow-500/10 via-black to-black"></div>

          <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-yellow-500 text-xs font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
              AI Model v2.4 Live
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6">
              Stop Guessing. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                Make Informed Bets.
              </span>
            </h1>

            <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Premium football analytics powered by advanced statistical modeling.
              We don't sell hope; we provide <span className="text-white font-semibold">probability</span>.
              Strict "No Bet" safety rails included.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full w-full sm:w-auto text-base">
                View Today's Tips
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-full w-full sm:w-auto text-base">
                How It Works <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-gray-500 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Verified History
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" /> Data-Driven
              </div>
            </div>
          </div>
        </section>

        {/* Live Ticker / Mock Data */}
        <section className="py-12 border-y border-white/5 bg-white/[0.02]">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="text-left max-w-md">
                <h3 className="text-xl font-bold text-white mb-2">Today's Market Watch</h3>
                <p className="text-sm text-gray-400 mb-6">Our AI is currently analyzing matches across multiple sports. Select a category to see high-confidence signals.</p>
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 w-fit">
                  <button
                    onClick={() => setSelectedSport("football")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${selectedSport === "football" ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    Football
                  </button>
                  <button
                    onClick={() => setSelectedSport("basketball")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${selectedSport === "basketball" ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    Basketball
                  </button>
                </div>
              </div>

              <div className="w-full lg:w-auto flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                  <div className="col-span-full flex justify-center py-8">
                    <Activity className="w-6 h-6 animate-spin text-yellow-500" />
                  </div>
                ) : fixtures.length > 0 ? (
                  fixtures.map(fixture => (
                    <Card
                      key={fixture.id}
                      league={fixture.league.name}
                      match={`${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`}
                      prediction={fixture.prediction?.picked || "ANALYZING..."}
                      confidence={fixture.prediction?.confidence || 0}
                      status={fixture.prediction?.isRisky ? 'nobet' : (fixture.prediction?.requiresTier === 'free' ? 'free' : 'locked')}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-gray-500 text-sm italic">
                    All matches currently under internal review.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              <Feature
                icon={<Activity className="w-6 h-6 text-yellow-500" />}
                title="Statistical Modeling"
                description="We process over 10,000 data points per match, including player form, expected goals (xG), and historical trends."
              />
              <Feature
                icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
                title='"No Bet" Safety Protocols'
                description="Our AI is disciplined. If the data is volatile or missing, we explicitly advise you to stay away. Protecting your bankroll is our priority."
              />
              <Feature
                icon={<Trophy className="w-6 h-6 text-purple-500" />}
                title="Transparency First"
                description="We publish every win and every loss. Access our complete historical record to verify our performance yourself."
              />
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-black text-center text-gray-500 text-sm">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex justify-center gap-6">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/disclaimer" className="hover:text-white">Disclaimer</Link>
            <Link href="/contact" className="hover:text-white text-yellow-500">Contact Us</Link>
          </div>
          <p className="max-w-md mx-auto mb-4">
            Funmo Tips is an informational platform. We do not accept bets.
            Probabilities do not guarantee outcomes. 18+ Only.
          </p>
          <p>&copy; {new Date().getFullYear()} Funmo Analytics. Nairobi, Kenya.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
      <div className="mb-4 bg-black w-12 h-12 rounded-lg flex items-center justify-center border border-white/10">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}

function Card({ league, match, prediction, confidence, status }: { league: string, match: string, prediction: string, confidence: number, status: 'free' | 'locked' | 'nobet' }) {
  const isLocked = status === 'locked';
  const isNoBet = status === 'nobet';

  return (
    <div className={`relative p-4 rounded-xl border ${isNoBet ? 'border-red-500/20 bg-red-900/5' : 'border-white/10 bg-white/5'} flex flex-col justify-between`}>
      {isLocked && (
        <div className="absolute inset-0 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center z-10 border border-white/5">
          <div className="flex flex-col items-center gap-2">
            <Lock className="w-6 h-6 text-yellow-500" />
            <span className="text-xs font-bold text-white tracking-widest uppercase">Premium Only</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-mono text-gray-500 uppercase">{league}</span>
        {isNoBet ? (
          <span className="text-xs font-bold text-red-500 border border-red-500/20 px-2 py-1 rounded bg-red-500/10">RISK DETECTED</span>
        ) : (
          <span className="text-xs font-bold text-emerald-500">{confidence}% Conf.</span>
        )}
      </div>

      <div className="mb-4">
        <h4 className={`font-semibold ${isLocked ? 'blur-sm select-none' : 'text-white'}`}>{match}</h4>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <span className="text-sm text-gray-400">Prediction</span>
        <span className={`font-mono font-bold ${isNoBet ? 'text-red-400' : 'text-yellow-400'} ${isLocked ? 'blur-sm select-none' : ''}`}>
          {prediction}
        </span>
      </div>
    </div>
  );
}
