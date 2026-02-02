"use client";

import { useAuth } from "@/context/AuthContext";
import { Loader2, ChevronLeft, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const { loading } = useAuth();
    const pathname = usePathname();

    // Pages that don't need header or have their own
    const noHeaderPaths = ['/login', '/signup', '/', '/dashboard'];
    const showHeader = !noHeaderPaths.includes(pathname);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            {showHeader && (
                <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center text-gray-500 hover:text-white transition-colors">
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Link>
                    <Link href="/profile" className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                        <UserIcon className="w-4 h-4 text-yellow-500" />
                        <span>My Account</span>
                    </Link>
                </div>
            )}
            {children}
        </div>
    );
}
