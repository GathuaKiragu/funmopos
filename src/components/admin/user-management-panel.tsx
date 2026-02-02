"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, User, Calendar, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserData {
    id: string;
    phoneNumber: string;
    displayName: string;
    tier: string;
    bankroll: number;
    createdAt: string;
    lastLoginAt: string;
    subscriptionExpiry: string;
}

export default function UserManagementPanel() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [lastId, setLastId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState("");

    const fetchUsers = async (reset = false) => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams();
            params.append('limit', '20');
            if (search) params.append('search', search);
            if (!reset && lastId) params.append('lastId', lastId);

            const res = await fetch(`/api/admin/users?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (reset) {
                    setUsers(data.users);
                } else {
                    setUsers(prev => [...prev, ...data.users]);
                }
                setLastId(data.lastId);
                setHasMore(data.hasMore);
            } else {
                setError("Failed to fetch users");
            }
        } catch (err) {
            setError("Error loading users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUsers(true);
        }, 500); // Debounce search
        return () => clearTimeout(timeoutId);
    }, [search]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
        setLastId(null);
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            fetchUsers(false);
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-500" />
                    <h2 className="text-xl font-semibold">User Management</h2>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Data by phone..."
                            value={search}
                            onChange={handleSearch}
                            className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fetchUsers(true)}
                        className="border-white/10 hover:bg-white/5"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">User</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Status</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Joined</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Last Active</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-500">
                                    No users found matching your search.
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                <User className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-white">{user.displayName || 'User'}</p>
                                                <p className="text-xs text-gray-400">{user.phoneNumber}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit ${user.tier === 'vip' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    user.tier === 'pro' ? 'bg-purple-500/20 text-purple-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {user.tier?.toUpperCase()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Calendar className="w-3 h-3" />
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Activity className="w-3 h-3 text-gray-500" />
                                            <span className={user.lastLoginAt && (new Date().getTime() - new Date(user.lastLoginAt).getTime() < 24 * 60 * 60 * 1000) ? 'text-green-400' : 'text-gray-500'}>
                                                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {hasMore && (
                <div className="mt-4 text-center">
                    <Button
                        variant="ghost"
                        onClick={handleLoadMore}
                        disabled={loading}
                        className="text-gray-400 hover:text-white hover:bg-white/5"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Load More Users
                    </Button>
                </div>
            )}
        </div>
    );
}
