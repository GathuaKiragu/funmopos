"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { PaymentModal } from "@/components/payment-modal";
import { Loader2, User, CreditCard, History, LogOut, ChevronLeft } from "lucide-react";
import Link from "next/link";

interface UserProfile {
    name: string;
    email: string;
    subscriptionStatus: string;
    subscriptionExpiry: any;
    tier: string;
}

import { Metadata } from "next";

export const metadata: Metadata = {
    title: "My Profile",
    description: "Manage your account settings and subscription.",
    robots: {
        index: false,
        follow: false,
    }
};

export default function ProfilePage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [pageLoading, setPageLoading] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }

        const fetchData = async () => {
            if (!user) return;
            try {
                // Fetch Profile
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setProfile(docSnap.data() as UserProfile);
                }

                // Fetch Transactions
                const q = query(
                    collection(db, "transactions"),
                    where("userId", "==", user.uid),
                    orderBy("createdAt", "desc")
                );
                const txSnap = await getDocs(q);
                setTransactions(txSnap.docs.map(doc => doc.data()));

            } catch (err) {
                console.error("Error fetching profile data:", err);
            } finally {
                setPageLoading(false);
            }
        };

        fetchData();
    }, [user, loading, router]);

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/");
    };

    if (loading || pageLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
        );
    }

    if (!user) return null;

    const isActive = profile?.subscriptionStatus === 'active';

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-3xl mx-auto">
                <Link href="/" className="inline-flex items-center text-gray-500 hover:text-white mb-8">
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                {/* Profile Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 border-b border-white/10 pb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-2xl">
                            {profile?.name ? profile.name[0].toUpperCase() : user.email?.[0].toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{profile?.name || "User"}</h1>
                            <p className="text-gray-400">{user.email}</p>
                            <p className="text-xs text-gray-600 font-mono mt-1">ID: {user.uid.slice(0, 8)}...</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleSignOut} className="border-red-500/20 text-red-500 hover:bg-red-500/10">
                        <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </Button>
                </div>

                <div className="grid gap-8">

                    {/* Subscription Status */}
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-yellow-500" /> Subscription Status
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">Manage your access plan</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                                {isActive ? "Active" : "Inactive"}
                            </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-black/50 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-400">Current Plan</p>
                                <p className="text-xl font-bold text-white max-w-[200px] truncate">
                                    {isActive ? (profile?.tier?.toUpperCase() || "PREMIUM") : "Free Tier"}
                                </p>
                            </div>

                            <PaymentModal>
                                <Button className="bg-yellow-500 text-black hover:bg-yellow-400 font-bold w-full sm:w-auto">
                                    {isActive ? "Extend Access" : "Upgrade Now"}
                                </Button>
                            </PaymentModal>
                        </div>
                    </div>

                    {/* Transaction History */}
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <History className="w-5 h-5 text-gray-400" /> Transaction History
                        </h2>
                        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            {transactions.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-black/50 text-gray-400">
                                            <tr>
                                                <th className="p-4 font-medium">Date</th>
                                                <th className="p-4 font-medium">Item</th>
                                                <th className="p-4 font-medium">Ref</th>
                                                <th className="p-4 font-medium text-right">Amount</th>
                                                <th className="p-4 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {transactions.map((tx, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4 whitespace-nowrap text-gray-300">
                                                        {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                                    </td>
                                                    <td className="p-4 font-bold uppercase text-white">
                                                        {tx.tier} Access
                                                    </td>
                                                    <td className="p-4 font-mono text-xs text-gray-500 truncate max-w-[100px]">
                                                        {tx.reference}
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-yellow-500">
                                                        KES {tx.amount}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-emerald-500/20">
                                                            {tx.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                                    <History className="w-8 h-8 mb-3 opacity-20" />
                                    <p>No transactions found.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
