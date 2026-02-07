"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Send, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function AutomationPanel() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
                    message: `Successfully triggered ${test ? 'Test' : 'Live'} Daily Picks! ${data.sms?.sent || 0} SMS sent.`
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

                {result && (
                    <div className={`mt-6 p-4 rounded-lg border flex items-center gap-3 ${result.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        {result.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <p className="text-sm font-medium">{result.message}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
