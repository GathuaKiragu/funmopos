"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Send,
    Users,
    DollarSign,
    AlertCircle,
    CheckCircle,
    Loader2,
    MessageSquare,
    Clock,
    TrendingUp
} from "lucide-react";

interface UserStats {
    totalUsers: number;
    usersWithPhone: number;
    sentToday: number;
    dailyLimit: number;
    remainingToday: number;
}

interface SendResult {
    success: boolean;
    totalSent?: number;
    totalFailed?: number;
    recipientCount?: number;
    estimatedCost?: number;
    successRate?: string;
    errors?: string[];
    error?: string;
}

export default function BulkSMSPanel() {
    const [message, setMessage] = useState("");
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<SendResult | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // Load user stats on mount
    useEffect(() => {
        loadUserStats();
    }, []);

    const loadUserStats = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/get-users-count');
            if (res.ok) {
                const data = await res.json();
                setUserStats(data);
            }
        } catch (error) {
            console.error('Failed to load user stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateSMSUnits = (text: string): number => {
        const hasUnicode = /[^\x00-\x7F]/.test(text);
        const maxLength = hasUnicode ? 70 : 160;
        return Math.ceil(text.length / maxLength);
    };

    const estimatedCost = userStats
        ? (userStats.usersWithPhone * calculateSMSUnits(message) * 0.80).toFixed(2)
        : "0.00";

    const handleSend = async () => {
        if (!message.trim()) {
            alert("Please enter a message");
            return;
        }

        setShowConfirm(true);
    };

    const confirmSend = async () => {
        setShowConfirm(false);
        setSending(true);
        setResult(null);

        try {
            const res = await fetch('/api/admin/send-bulk-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });

            const data = await res.json();

            if (res.ok) {
                setResult({
                    success: true,
                    ...data,
                });
                setMessage(""); // Clear message on success
                loadUserStats(); // Refresh stats
            } else {
                setResult({
                    success: false,
                    error: data.error || 'Failed to send SMS',
                });
            }
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || 'Network error',
            });
        } finally {
            setSending(false);
        }
    };

    const smsUnits = calculateSMSUnits(message);
    const charLimit = /[^\x00-\x7F]/.test(message) ? 70 : 160;
    const currentSegment = message.length % charLimit || charLimit;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold">Bulk SMS</h2>
                    <p className="text-sm text-gray-400">Send messages to all registered users</p>
                </div>
            </div>

            {/* Stats Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : userStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-gray-400">Recipients</span>
                        </div>
                        <p className="text-2xl font-bold">{userStats.usersWithPhone}</p>
                        <p className="text-xs text-gray-500 mt-1">of {userStats.totalUsers} total users</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-gray-400">Est. Cost</span>
                        </div>
                        <p className="text-2xl font-bold">KES {estimatedCost}</p>
                        <p className="text-xs text-gray-500 mt-1">{smsUnits} SMS unit{smsUnits > 1 ? 's' : ''} each</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-orange-400" />
                            <span className="text-xs text-gray-400">Sent Today</span>
                        </div>
                        <p className="text-2xl font-bold">{userStats.sentToday}</p>
                        <p className="text-xs text-gray-500 mt-1">of {userStats.dailyLimit} limit</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-gray-400">Remaining</span>
                        </div>
                        <p className="text-2xl font-bold">{userStats.remainingToday}</p>
                        <p className="text-xs text-gray-500 mt-1">SMS available today</p>
                    </div>
                </div>
            )}

            {/* Message Composer */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here... (e.g., 'New VIP predictions available! Check the app now for today's banker picks.')"
                    className="w-full h-32 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                    maxLength={1000}
                />

                {/* Character Counter */}
                <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-gray-400">
                        {message.length} / 1000 characters
                        {message.length > 0 && (
                            <span className="ml-2">
                                ({currentSegment}/{charLimit} in segment {smsUnits})
                            </span>
                        )}
                    </span>
                    {smsUnits > 1 && (
                        <span className="text-yellow-400">
                            ⚠️ Message will be split into {smsUnits} parts
                        </span>
                    )}
                </div>

                {/* Preview */}
                {message && (
                    <div className="mt-4 p-4 bg-black/30 border border-white/5 rounded-lg">
                        <p className="text-xs text-gray-400 mb-2">Preview:</p>
                        <div className="bg-white/5 rounded-lg p-3 max-w-sm">
                            <p className="text-sm text-white whitespace-pre-wrap">{message}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Send Button */}
            <div className="flex items-center gap-3">
                <Button
                    onClick={handleSend}
                    disabled={!message.trim() || sending || (userStats?.remainingToday === 0)}
                    className="bg-blue-500 hover:bg-blue-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {sending ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4 mr-2" />
                            Send to {userStats?.usersWithPhone || 0} Users
                        </>
                    )}
                </Button>

                {userStats?.remainingToday === 0 && (
                    <span className="text-sm text-red-400">
                        Daily limit reached. Try again tomorrow.
                    </span>
                )}
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="w-6 h-6 text-yellow-500" />
                            <h3 className="text-xl font-bold">Confirm Bulk Send</h3>
                        </div>

                        <div className="space-y-3 mb-6">
                            <p className="text-sm text-gray-300">
                                You are about to send this message to <strong>{userStats?.usersWithPhone}</strong> users.
                            </p>
                            <div className="bg-black/30 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-1">Message:</p>
                                <p className="text-sm">{message}</p>
                            </div>
                            <p className="text-sm text-gray-400">
                                Estimated cost: <strong className="text-green-400">KES {estimatedCost}</strong>
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => setShowConfirm(false)}
                                variant="outline"
                                className="flex-1 border-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmSend}
                                className="flex-1 bg-blue-500 hover:bg-blue-400"
                            >
                                Confirm Send
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Result Display */}
            {result && (
                <div className={`p-4 rounded-lg border ${result.success
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}>
                    <div className="flex items-start gap-3">
                        {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                            <h4 className="font-semibold mb-2">
                                {result.success ? 'SMS Sent Successfully!' : 'Send Failed'}
                            </h4>
                            {result.success ? (
                                <div className="space-y-1 text-sm">
                                    <p>✅ Sent: {result.totalSent} / {result.recipientCount}</p>
                                    <p>❌ Failed: {result.totalFailed}</p>
                                    <p>📊 Success Rate: {result.successRate}%</p>
                                    <p>💰 Cost: KES {result.estimatedCost?.toFixed(2)}</p>
                                    {result.errors && result.errors.length > 0 && (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-yellow-400">
                                                View Errors ({result.errors.length})
                                            </summary>
                                            <ul className="mt-2 space-y-1 text-xs text-gray-400">
                                                {result.errors.map((err, idx) => (
                                                    <li key={idx}>• {err}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-red-400">{result.error}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
