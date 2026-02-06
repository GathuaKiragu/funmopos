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
                    <a href="https://t.me/+0PA3S6EyW_MzMjY8" target="_blank" rel="noopener noreferrer" className="ml-2 flex items-center gap-2 text-sm font-bold text-white bg-[#229ED9] hover:bg-[#1e8dbf] transition-all hover:scale-105 active:scale-95 px-4 py-2 rounded-xl shadow-lg shadow-blue-500/20">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                        <span>Join Telegram</span>
                    </a>
                </div>
            )}
            {children}
        </div>
    );
}
