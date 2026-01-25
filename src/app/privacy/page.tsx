import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "Learn how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-yellow-500/30 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-8">

                <Link href="/" className="inline-flex items-center text-sm text-yellow-500 hover:text-yellow-400 transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
                <p className="text-sm text-gray-500">Last Updated: January 2026</p>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">1. Information We Collect</h2>
                    <p>
                        We collect information you provide directly to us, such as when you create an account, subscribe to our service, or communicate with us. This may include your email address, phone number (for M-Pesa transactions), and payment history.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">2. Use of Information</h2>
                    <p>
                        We use the information we collect to provide, maintain, and improve our services, including to process transactions, send you technical notices, and respond to your comments and questions.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">3. Data Security</h2>
                    <p>
                        We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.
                    </p>
                </section>

                <div className="pt-8 border-t border-white/10">
                    <p className="text-sm text-gray-500">
                        Contact: privacy@funmotips.com
                    </p>
                </div>
            </div>
        </div>
    );
}
