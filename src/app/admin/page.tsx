"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Users, Database, Activity, TrendingUp, RefreshCw, LogOut, AlertCircle, CheckCircle, Eye, MessageSquare, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

interface Stats {
    users: { total: number; verified: number; unverified: number };
    fixtures: { total: number; cached: number };
    transactions: { total: number; recent: any[] };
    systemHealth: {
        firestoreConnected: boolean;
        lastSync: string | null;
    };
}

interface Analytics {
    pageViews: any[];
    leads: any[];
    recentActivity: any[];
    stats: {
        totalViews: number;
        totalLeads: number;
        viewsToday: number;
        leadsToday: number;
    };
}

export default function AdminPage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stats, setStats] = useState<Stats | null>(null);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const handleLogin = async () => {
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/admin/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
                loadStats();
                loadAnalytics();
            } else {
                setError("Invalid password");
            }
        } catch (err) {
            setError("Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch("/api/admin/auth", { method: "DELETE" });
        setIsAuthenticated(false);
        setStats(null);
        setAnalytics(null);
        setPassword("");
    };

    const loadStats = async () => {
        setRefreshing(true);
        try {
            const res = await fetch("/api/admin/stats");
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            } else if (res.status === 401) {
                setIsAuthenticated(false);
            }
        } catch (err) {
            console.error("Failed to load stats:", err);
        } finally {
            setRefreshing(false);
        }
    };

    const loadAnalytics = async () => {
        try {
            const res = await fetch("/api/admin/analytics");
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
            } else if (res.status === 401) {
                setIsAuthenticated(false);
            }
        } catch (err) {
            console.error("Failed to load analytics:", err);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            loadStats();
            loadAnalytics();
            const interval = setInterval(() => {
                loadStats();
                loadAnalytics();
            }, 30000); // Refresh every 30s
            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center p-4">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500/10 rounded-full mb-4">
                            <Lock className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Access</h1>
                        <p className="mt-2 text-sm text-gray-400">
                            Enter admin password to continue
                        </p>
                    </div>

                    <div className="space-y-4 p-8 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-md flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                                className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                placeholder="••••••••"
                            />
                        </div>

                        <Button
                            onClick={handleLogin}
                            disabled={loading || !password}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Authenticating...
                                </>
                            ) : "Access Dashboard"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-sm text-gray-400 mt-1">System monitoring and analytics</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={loadStats}
                            disabled={refreshing}
                            variant="outline"
                            className="border-white/10 text-white hover:bg-white/10"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                    </div>
                </div>

                {/* System Health */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <Activity className="w-5 h-5 text-yellow-500" />
                        <h2 className="text-xl font-semibold">System Health</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-black/30 rounded-lg">
                            {stats?.systemHealth.firestoreConnected ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                            )}
                            <div>
                                <p className="text-sm text-gray-400">Firestore Status</p>
                                <p className="font-semibold">
                                    {stats?.systemHealth.firestoreConnected ? "Connected" : "Disconnected"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-black/30 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            <div>
                                <p className="text-sm text-gray-400">Last Updated</p>
                                <p className="font-semibold">{new Date().toLocaleTimeString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Page Views */}
                    <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-500/20 rounded-lg">
                                <Eye className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h3 className="text-lg font-semibold">Page Views</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Total</span>
                                <span className="text-2xl font-bold">{analytics?.stats.totalViews || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Today</span>
                                <span className="text-cyan-400">{analytics?.stats.viewsToday || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Leads */}
                    <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <MessageSquare className="w-6 h-6 text-orange-400" />
                            </div>
                            <h3 className="text-lg font-semibold">Leads</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Total</span>
                                <span className="text-2xl font-bold">{analytics?.stats.totalLeads || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Today</span>
                                <span className="text-orange-400">{analytics?.stats.leadsToday || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Users */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-semibold">Users</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Total</span>
                                <span className="text-2xl font-bold">{stats?.users.total || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Verified</span>
                                <span className="text-green-400">{stats?.users.verified || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Fixtures */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Database className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-lg font-semibold">Fixtures</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Cached</span>
                                <span className="text-2xl font-bold">{stats?.fixtures.total || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Available</span>
                                <span className="text-purple-400">{stats?.fixtures.cached || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity Feed */}
                {analytics?.recentActivity && analytics.recentActivity.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Clock className="w-5 h-5 text-yellow-500" />
                            <h2 className="text-xl font-semibold">Recent Activity</h2>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {analytics.recentActivity.map((activity, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-black/30 rounded-lg hover:bg-black/40 transition-colors">
                                    <div className={`p-2 rounded-lg ${activity.type === 'view'
                                            ? 'bg-cyan-500/20'
                                            : 'bg-orange-500/20'
                                        }`}>
                                        {activity.type === 'view' ? (
                                            <Eye className="w-4 h-4 text-cyan-400" />
                                        ) : (
                                            <MessageSquare className="w-4 h-4 text-orange-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium">
                                                {activity.type === 'view' ? (
                                                    <>Page View: <span className="text-cyan-400">{activity.page || 'Unknown'}</span></>
                                                ) : (
                                                    <>New Lead: <span className="text-orange-400">{activity.email || 'Unknown'}</span></>
                                                )}
                                            </p>
                                            <span className="text-xs text-gray-500 whitespace-nowrap">
                                                {activity.timestamp || activity.createdAt
                                                    ? new Date(activity.timestamp || activity.createdAt).toLocaleTimeString()
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                        {activity.type === 'lead' && activity.name && (
                                            <p className="text-xs text-gray-400 mt-1">Name: {activity.name}</p>
                                        )}
                                        {activity.type === 'view' && activity.referrer && (
                                            <p className="text-xs text-gray-400 mt-1 truncate">From: {activity.referrer}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Transactions */}
                {stats?.transactions.recent && stats.transactions.recent.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">User</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.transactions.recent.map((tx, idx) => (
                                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-3 px-4 text-sm font-mono">{tx.id.slice(0, 8)}...</td>
                                            <td className="py-3 px-4 text-sm">{tx.userId?.slice(0, 8) || 'N/A'}...</td>
                                            <td className="py-3 px-4 text-sm">{tx.amount || 'N/A'}</td>
                                            <td className="py-3 px-4 text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs ${tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                    tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {tx.status || 'unknown'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-400">
                                                {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!stats && !refreshing && (
                    <div className="text-center py-12 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p>Loading dashboard data...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
