"use client";

import { Button } from "@/components/ui/button";
import { ShieldCheck, Trophy, Activity, Lock, AlertTriangle, User as UserIcon, CheckCircle, XCircle, Star, Quote } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { getFixturesClient as getFixtures, Fixture, Sport } from "@/lib/api-football";
import { format } from "date-fns";
import { PerformanceTicker } from "@/components/performance-ticker";

export default function Home() {
  const { user } = useAuth();
  const [selectedSport, setSelectedSport] = useState<Sport>("football");
  const [freeFixtures, setFreeFixtures] = useState<Fixture[]>([]);
  const [midFixtures, setMidFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFixtures = async () => {
      setLoading(true);
      // Show past games so users can see results/wins for "today"
      const data = await getFixtures(new Date(), selectedSport, true);

      // Filter Free Games (Top 3)
      const free = data
        .filter(f => f.prediction?.requiresTier === 'free' || f.prediction?.isRisky)
        .slice(0, 3);

      // Filter Mid-Performing Games (Confidence 40-70%, Top 3)
      const mid = data
        .filter(f => {
          const conf = f.prediction?.confidence || 0;
          return conf >= 40 && conf <= 75 && !f.prediction?.isRisky;
        })
        .slice(0, 3);

      setFreeFixtures(free.length > 0 ? free : data.slice(0, 3)); // Fallback if no specific free games found
      setMidFixtures(mid);
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

      <main className="flex-1 pt-16">

        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-500/10 via-black to-black"></div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

              <div className="flex-1 text-center lg:text-left max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-yellow-500 text-xs font-bold uppercase tracking-wide mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                  </span>
                  Trusted by 10,000+ Bettors
                </div>

                <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
                  AI predicts winners with <span className="text-yellow-500">90% accuracy</span>.
                </h1>

                <p className="text-lg lg:text-xl text-gray-400 mb-10 leading-relaxed">
                  Stop gambling based on feelings. Get data-driven predictions, win more often, and beat the bookies today.
                </p>

                <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-4 mb-16">
                  <Link href="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="h-14 px-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg rounded-full w-full  shadow-lg shadow-yellow-500/20 transition-all hover:scale-105">
                      Get Today's Picks
                    </Button>
                  </Link>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 px-8 border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-full w-full sm:w-auto text-lg font-semibold"
                    onClick={() => {
                      document.getElementById('free-picks')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    View Free Demo
                  </Button>
                </div>

                {/* Trust Signals */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 border-t border-white/10 pt-8">
                  <div>
                    <p className="text-3xl font-bold text-white">18/25</p>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Correct Picks (Last 25)</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">72%</p>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Accuracy Rate</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">10K+</p>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Analyzed Daily</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">24/7</p>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Live AI</p>
                  </div>
                </div>
              </div>

              {/* Hero Image */}
              <div className="flex-1 w-full max-w-lg lg:max-w-none relative animate-in fade-in zoom-in duration-1000">
                <div className="absolute -inset-4 bg-yellow-500/20 blur-3xl opacity-20 rounded-full"></div>
                <img
                  src="/hero-real.jpg"
                  alt="Soccer Player Action Shot"
                  className="relative w-full h-auto rounded-2xl shadow-2xl hover:scale-105 transition-transform duration-700 opacity-90 grayscale-[30%] brightness-[0.8]"
                />
              </div>

            </div>
          </div>
        </section>

        {/* Live Performance Ticker */}
        <PerformanceTicker />

        {/* Free Games Section (Demo) */}
        <section id="free-picks" className="py-20 bg-white/[0.02] border-t border-white/5 scroll-mt-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-12">
              <div className="text-left max-w-lg">
                <div className="inline-block px-3 py-1 bg-yellow-500 text-black text-xs font-bold uppercase rounded mb-3">
                  Free AI Demo
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Today's Predictions</h3>
                <p className="text-gray-400">
                  See the AI in action. Here are a few <span className="text-white font-bold">free picks</span> for today to prove our value.
                </p>
              </div>

              <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                <button
                  onClick={() => setSelectedSport("football")}
                  className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${selectedSport === "football" ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Football
                </button>
                <button
                  onClick={() => setSelectedSport("basketball")}
                  className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${selectedSport === "basketball" ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Basketball
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Activity className="w-8 h-8 animate-spin text-yellow-500" />
                </div>
              ) : freeFixtures.length > 0 ? (
                freeFixtures.map((fixture, index) => (
                  <Card
                    key={fixture.id}
                    league={fixture.league.name}
                    match={`${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`}
                    date={fixture.date}
                    prediction={fixture.prediction?.picked || "ANALYZING..."}
                    confidence={fixture.prediction?.confidence || 0}
                    reasoning={fixture.prediction?.reasoning}
                    status={fixture.prediction?.isRisky ? 'nobet' : 'free'}
                    isTeaserLocked={!user && index > 0} // Lock 2nd and 3rd card for guests
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500 italic">
                  No free picks currently available. Please check back later or sign up for full access.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 border-t border-white/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">Trusted by Winners</h2>
              <p className="text-gray-400">Join the community beating the odds everyday.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { name: "Kevin M.", role: "Bettor since 2023", text: "I was skeptical at first, but the accuracy is real. Won 5 slips in a row last week. The AI analysis saves me hours of research." },
                { name: "Sarah K.", role: "Premium Member", text: "Finally an app that doesn't just guess. The transparency on wins and losses is what built my trust. Funmo is my go-to tool." },
                { name: "David O.", role: "Professional Bettor", text: "The 'No Bet' warnings are just as valuable as the picks. Saved me from losing money on risky games I would have bet on otherwise." }
              ].map((t, i) => (
                <div key={i} className="p-8 bg-white/5 border border-white/5 rounded-2xl relative">
                  <Quote className="w-8 h-8 text-yellow-500/20 absolute top-6 right-6" />
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />)}
                  </div>
                  <p className="text-gray-300 mb-6 leading-relaxed">"{t.text}"</p>
                  <div>
                    <p className="text-white font-bold">{t.name}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem vs Solution */}
        <section className="py-20 bg-white/[0.02] border-t border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none"></div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              <div>
                <div className="mb-8">
                  <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Why Most Bettors Lose</h2>
                  <p className="text-gray-400 text-lg">The house always wins because they utilize data. You lose because you use emotion. It's time to level the playing field.</p>
                </div>

                <div className="space-y-6">
                  {/* The Old Way */}
                  <div className="p-6 rounded-2xl bg-red-900/5 border border-red-500/20 relative overflow-hidden group hover:border-red-500/40 transition-colors">
                    <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
                      <XCircle className="w-5 h-5" /> The Amateur Way
                    </h3>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3 text-gray-400 text-sm">
                        <span className="text-red-500 mt-0.5">✕</span> Betting on favorite teams ("Fan bias")
                      </li>
                      <li className="flex items-start gap-3 text-gray-400 text-sm">
                        <span className="text-red-500 mt-0.5">✕</span> Chasing losses with bigger bets
                      </li>
                    </ul>
                  </div>

                  {/* The Funmo Way */}
                  <div className="p-6 rounded-2xl bg-emerald-900/10 border border-emerald-500/30 relative overflow-hidden group shadow-lg shadow-emerald-500/5">
                    <h3 className="text-xl font-bold text-emerald-500 mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" /> The Professional Way
                    </h3>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3 text-white text-sm">
                        <span className="text-emerald-500 mt-0.5">✓</span> Data-driven decisions (xG, Form, Injury news)
                      </li>
                      <li className="flex items-start gap-3 text-white text-sm">
                        <span className="text-emerald-500 mt-0.5">✓</span> Disciplined staking strategy (Kelly Criterion)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500/20 to-yellow-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <img
                  src="/graph-real.jpg"
                  alt="Financial Analytics Graph"
                  className="relative rounded-2xl border border-white/10 shadow-2xl w-full rotate-2 hover:rotate-0 transition-transform duration-500 grayscale-[50%] contrast-125 brightness-75"
                />
              </div>

            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 border-t border-white/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">How To Start Winning</h2>
              <p className="text-gray-400">Three simple steps to smarter betting.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center border border-white/10 mb-6 text-2xl font-bold text-yellow-500 shadow-lg shadow-yellow-500/5">1</div>
                <h3 className="text-xl font-bold text-white mb-3">We Analyze</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">Our algorithms scrape data from 50+ leagues, processing player stats, team form, and historical trends.</p>
              </div>
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center border border-white/10 mb-6 text-2xl font-bold text-yellow-500 shadow-lg shadow-yellow-500/5">2</div>
                <h3 className="text-xl font-bold text-white mb-3">We Suggest</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">Our AI identifies matches where the bookmakers have miscalculated the odds, flagging high-value opportunities.</p>
              </div>
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center border border-white/10 mb-6 text-2xl font-bold text-yellow-500 shadow-lg shadow-yellow-500/5">3</div>
                <h3 className="text-xl font-bold text-white mb-3">You Profit</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">You get clear, actionable tips. Place your bets with confidence and watch your bankroll grow.</p>
              </div>
            </div>

            <div className="mt-20 max-w-5xl mx-auto rounded-3xl overflow-hidden border border-white/10 relative group bg-neutral-900/50">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 right-0 p-8 z-20 text-center pointer-events-none">
                <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-2">Platform Preview</p>
                <h3 className="text-2xl font-bold text-white">Watch: From Signup to Winning Access</h3>
              </div>
              <img
                src="/demo.webp"
                alt="Funmo Tips Signup and Payment Flow"
                className="w-full h-auto opacity-80 group-hover:opacity-100 group-hover:scale-[1.01] transition-all duration-700 object-cover max-h-[600px] mx-auto"
              />
            </div>
          </div>
        </section>

        {/* Logged In: Mid-Performing Games */}
        {user && (
          <section className="py-12 border-b border-white/5 bg-black">
            <div className="container mx-auto px-4">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="text-left max-w-md">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-white">Member Insights</h3>
                    <span className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase">
                      Exclusive
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Mid-range confidence plays (40-75%) often hold the best value.
                    <span className="text-gray-300 font-semibold block mt-1">
                      Showing top 3 recommendations for you.
                    </span>
                  </p>
                </div>

                <div className="w-full lg:w-auto flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {loading ? (
                    <div className="col-span-full flex justify-center py-8">
                      <Activity className="w-6 h-6 animate-spin text-yellow-500" />
                    </div>
                  ) : midFixtures.length > 0 ? (
                    midFixtures.map(fixture => (
                      <Card
                        key={fixture.id}
                        league={fixture.league.name}
                        match={`${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`}
                        date={fixture.date}
                        prediction={fixture.prediction?.picked || "ANALYZING..."}
                        confidence={fixture.prediction?.confidence || 0}
                        reasoning={fixture.prediction?.reasoning}
                        status={'free'}
                      />
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-gray-500 text-sm italic">
                      No mid-range opportunities currently identified.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

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

function Card({ league, match, date, prediction, confidence, reasoning, status, isTeaserLocked }: { league: string, match: string, date: string, prediction: string, confidence: number, reasoning?: string | string[], status: 'free' | 'locked' | 'nobet', isTeaserLocked?: boolean }) {
  const isLocked = status === 'locked';
  const isNoBet = status === 'nobet';
  const showTeaserGate = isTeaserLocked && !isLocked;

  // Normalize reasoning to array for rendering
  const reasoningPoints = Array.isArray(reasoning) ? reasoning : (reasoning ? [reasoning] : []);

  return (
    <div className={`relative p-4 rounded-xl border ${isNoBet ? 'border-red-500/20 bg-red-900/5' : 'border-white/10 bg-white/5'} flex flex-col justify-between overflow-hidden group`}>

      {/* Premium Lock Overlay (Hard Gate) */}
      {isLocked && (
        <div className="absolute inset-0 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center z-10 border border-white/5">
          <div className="flex flex-col items-center gap-2">
            <Lock className="w-6 h-6 text-yellow-500" />
            <span className="text-xs font-bold text-white tracking-widest uppercase">Premium Only</span>
          </div>
        </div>
      )}

      {/* Teaser Lock Overlay (Soft Gate - Signup Required) */}
      {showTeaserGate && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[6px] flex flex-col items-center justify-center z-20 text-center p-4 animate-in fade-in duration-500">
          <Lock className="w-8 h-8 text-yellow-500 mb-2 drop-shadow-glow" />
          <h4 className="text-white font-bold text-lg mb-1">High Value Tip</h4>
          <p className="text-gray-300 text-xs mb-4 max-w-[200px]">Create a <span className="text-white font-bold">Free Account</span> to reveal this prediction instantly.</p>
          <Link href="/signup" className="w-full">
            <Button size="sm" className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-500/20">
              Reveal Now (Free)
            </Button>
          </Link>
          <p className="text-[10px] text-gray-500 mt-2">No credit card required.</p>
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <span className="text-xs font-mono text-gray-500 uppercase">{league}</span>
          <span className="text-[10px] text-gray-600 font-mono mt-0.5">
            {format(new Date(date), "MMM dd, HH:mm")}
          </span>
        </div>
        {isNoBet ? (
          <span className="text-xs font-bold text-red-500 border border-red-500/20 px-2 py-1 rounded bg-red-500/10">RISK DETECTED</span>
        ) : (
          <span className="text-xs font-bold text-emerald-500">{confidence}% Conf.</span>
        )}
      </div>

      <div className="mb-4">
        <h4 className={`font-semibold ${isLocked ? 'blur-sm select-none' : 'text-white'}`}>{match}</h4>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Prediction</span>
          <span className={`font-mono font-bold ${isNoBet ? 'text-red-400' : 'text-yellow-400'} ${isLocked ? 'blur-sm select-none' : ''}`}>
            {prediction}
          </span>
        </div>

        {reasoningPoints.length > 0 && !isLocked && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-yellow-500 text-xs">💡</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Analysis</span>
            </div>
            <ul className="space-y-1">
              {reasoningPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-yellow-500/50 mt-1">•</span> {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
