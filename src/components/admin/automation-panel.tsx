"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Send, CheckCircle, AlertCircle, RefreshCw, Sparkles, Activity, ShieldAlert } from "lucide-react";

export default function AutomationPanel() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        message: string;
        telegram?: boolean;
        social?: { x: boolean; facebook: boolean };
        sms?: { total: number; sent: number; failed: number };
        triggerSource?: 'dailyPicks' | 'engagementPost';
        engagementPostType?: string;
    } | null>(null);

    const [quota, setQuota] = useState<{
        deepseek_billing_empty: boolean;
        api_sports_rate_limited: boolean;
        api_sports_remaining: number;
        api_sports_limit: number;
        api_sports_used: number;
    } | null>(null);

    const fetchQuota = async () => {
        try {
            const res = await fetch('/api/admin/quota');
            if (res.ok) {
                const data = await res.json();
                setQuota(data);
            }
        } catch (err) {
            console.error("Quota fetch error", err);
        }
    };

    useEffect(() => {
        fetchQuota();
        const interval = setInterval(fetchQuota, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    const handleTrigger = async (test: boolean = false) => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`/api/admin/trigger-daily-picks?test=${test}`, {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok) {
                setResult({
                    success: true,
                    message: `Successfully triggered ${test ? 'Test' : 'Live'} Daily Picks!`,
                    telegram: data.telegram,
                    social: data.social,
                    sms: data.sms,
                    triggerSource: 'dailyPicks'
                });
            } else {
                setResult({ success: false, message: data.error || "Failed to trigger" });
            }
        } catch (error: any) {
            setResult({ success: false, message: error.message || "Network error" });
        } finally {
            setLoading(false);
        }
    };

    const handleEngagementTrigger = async (test: boolean = false) => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`/api/admin/trigger-engagement-post?test=${test}`, {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok) {
                setResult({
                    success: true,
                    message: `Successfully posted ${test ? 'Test' : 'Live'} Engagement Post (${data.type})!`,
                    social: data.posted,
                    engagementPostType: data.type,
                    triggerSource: 'engagementPost'
                });
            } else {
                setResult({ success: false, message: data.error || "Failed to trigger" });
            }
        } catch (error: any) {
            setResult({ success: false, message: error.message || "Network error" });
        } finally {
            setLoading(false);
        }
    };

    const handleFastSync = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`/api/admin/trigger-fast-sync`, {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok) {
                setResult({
                    success: true,
                    message: `Successfully updated match scores and statuses!`,
                    triggerSource: 'dailyPicks'
                });
            } else {
                setResult({ success: false, message: data.error || "Failed to update" });
            }
        } catch (error: any) {
            setResult({ success: false, message: error.message || "Network error" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeepSync = async (days: number = 1) => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`/api/admin/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ days, deep: true })
            });
            const data = await res.json();
            if (res.ok) {
                setResult({
                    success: true,
                    message: `Full AI analysis completed for all leagues (${days} days)!`,
                    triggerSource: 'dailyPicks'
                });
            } else {
                setResult({ success: false, message: data.error || "Deep Sync failed" });
            }
        } catch (error: any) {
            setResult({ success: false, message: error.message || "Network error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Zap className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold">Automation Control</h2>
                    <p className="text-sm text-gray-400">Manually trigger automated system tasks</p>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h3 className="font-bold">Daily Top Picks (Telegram + SMS)</h3>
                        <p className="text-sm text-gray-400">
                            This will fetch today's matches, run AI analysis, and send notifications to Telegram and all users via SMS.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Button
                            onClick={() => handleTrigger(true)}
                            disabled={loading}
                            variant="outline"
                            className="border-white/10 hover:bg-white/10"
                        >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Dry Run (Test)
                        </Button>
                        <Button
                            onClick={() => handleTrigger(false)}
                            disabled={loading}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Send Now (Live)
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-white/10 mt-6">
                    <div className="space-y-1">
                        <h3 className="font-bold">Fast Score Sync</h3>
                        <p className="text-sm text-gray-400">
                            Updates scores and match statuses for today and yesterday. Fast execution (no AI analysis).
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Button
                            onClick={handleFastSync}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold"
                        >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sync Scores Now
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-white/10 mt-6">
                    <div className="space-y-1 text-yellow-500/80">
                        <h3 className="font-bold flex items-center gap-2">
                            Full Analysis Sync
                            <span className="text-[10px] bg-yellow-500/20 px-2 py-0.5 rounded-full">Deep Sync</span>
                        </h3>
                        <p className="text-sm text-gray-400">
                            Analyzes ALL matches (Core + Obscure) for today. Prevents users from having to trigger manual analysis.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Button
                            onClick={() => handleDeepSync(1)}
                            disabled={loading}
                            className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 border border-yellow-500/20 font-bold"
                        >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Run Deep Sync (Today)
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-white/10 mt-6">
                    <div className="space-y-1">
                        <h3 className="font-bold">Social Engagement Post</h3>
                        <p className="text-sm text-gray-400">
                            Triggers a randomized post (Match teaser, Win highlight, or CTA) to X and Facebook.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Button
                            onClick={() => handleEngagementTrigger(true)}
                            disabled={loading}
                            variant="outline"
                            className="border-white/10 hover:bg-white/10"
                        >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Test Engagement
                        </Button>
                        <Button
                            onClick={() => handleEngagementTrigger(false)}
                            disabled={loading}
                            className="bg-blue-500 hover:bg-blue-400 text-white font-bold"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Post Now
                        </Button>
                    </div>
                </div>

                {result && (
                    <div className={`mt-8 p-4 rounded-lg border flex flex-col gap-3 ${result.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        <div className="flex items-center gap-3">
                            {result.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                            <p className="text-sm font-medium">{result.message}</p>
                        </div>

                        {result.success && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 pt-4 border-t border-white/10">
                                {result.triggerSource === 'dailyPicks' && (
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Telegram</p>
                                        <p className="text-sm">{result.telegram ? '✅ Sent' : '❌ Failed'}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-gray-400 uppercase font-bold mb-1">
                                        {result.triggerSource === 'engagementPost' ? 'Platforms' : 'Social Media'}
                                    </p>
                                    <div className="text-sm space-y-1">
                                        <p>X: {result.social?.x ? '✅ Sent' : '❌ Failed'}</p>
                                        <p>FB: {result.social?.facebook ? '✅ Sent' : '❌ Failed'}</p>
                                    </div>
                                </div>
                                {result.triggerSource === 'dailyPicks' ? (
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">SMS Notifications</p>
                                        <p className="text-sm">
                                            {result.sms?.sent} sent / {result.sms?.failed} failed
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Post Content</p>
                                        <p className="text-sm capitalize">{result.engagementPostType}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Quota Health Dashboard */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <h3 className="font-bold text-lg">Quota & API Health</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* API-Sports Status */}
                    <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">API-Sports Requests</span>
                            {quota?.api_sports_rate_limited ? (
                                <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">THROTTLED</span>
                            ) : (
                                <span className="bg-green-500/20 text-green-500 text-[10px] px-2 py-0.5 rounded-full font-bold">HEALTHY</span>
                            )}
                        </div>
                        {quota && quota.api_sports_limit > 0 ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="text-2xl font-black">{quota.api_sports_remaining.toLocaleString()}</span>
                                    <span className="text-xs text-gray-500 mb-1">/ {quota.api_sports_limit.toLocaleString()} left</span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-1000 ${(quota.api_sports_remaining / quota.api_sports_limit) < 0.2 ? 'bg-red-500' :
                                            (quota.api_sports_remaining / quota.api_sports_limit) < 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${(quota.api_sports_remaining / quota.api_sports_limit) * 100}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500">Reset period: 24h cycle</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic py-2">No API data yet. Run a sync to refresh.</p>
                        )}
                    </div>

                    {/* DeepSeek Status */}
                    <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Analysis Engine</span>
                            {quota?.deepseek_billing_empty ? (
                                <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">BILLING ERROR</span>
                            ) : (
                                <span className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                            )}
                        </div>
                        <div className="flex flex-col h-full justify-center">
                            {quota?.deepseek_billing_empty ? (
                                <div className="flex items-center gap-2 text-red-500">
                                    <ShieldAlert className="w-4 h-4" />
                                    <p className="text-xs font-bold">Check DeepSeek Balance</p>
                                </div>
                            ) : (
                                <p className="text-sm font-bold text-gray-300">Wait-time between chunks: 200ms (Safe Mode)</p>
                            )}
                            <p className="text-[10px] text-gray-500 mt-2">DeepSeek Chat V3 | 128k Context</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchQuota}
                            className="bg-white/5 border-white/10 hover:bg-white/10 text-xs py-5"
                        >
                            <RefreshCw className="w-3 h-3 mr-2" />
                            Force Quota Refresh
                        </Button>
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <p className="text-[10px] text-blue-400 font-bold leading-tight">
                                PRO TIP: Use "Fast Sync" to update scores without spending AI tokens or Enrichment hits.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
