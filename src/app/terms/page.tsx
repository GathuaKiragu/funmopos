import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "Read our terms of service and usage agreement.",
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-yellow-500/30 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-8">

                <Link href="/" className="inline-flex items-center text-sm text-yellow-500 hover:text-yellow-400 transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
                <p className="text-sm text-gray-500">Last Updated: January 2026</p>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
                    <p>
                        By accessing and using Funmo Tips ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">2. Nature of Service</h2>
                    <p>
                        Funmo Tips is a sports analytics informational platform. We provide statistical models and predictions based on historical data. We are <strong>NOT</strong> a betting operator, bookmaker, or gambling service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">3. No Guaranteed Outcomes</h2>
                    <p>
                        Sports outcomes are inherently unpredictable. While our AI models use advanced statistics to determine probability, <strong>we do not and cannot guarantee accurate predictions</strong>. All content is for informational purposes only.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">4. User Responsibility</h2>
                    <p>
                        You acknowledge that any reliance upon any such information shall be at your sole risk. Funmo Tips shall not be responsible or liable for any trading or investment decisions or damages incurred by you or any third party.
                    </p>
                </section>

                <div className="pt-8 border-t border-white/10">
                    <p className="text-sm text-gray-500">
                        Contact: support@funmotips.com
                    </p>
                </div>
            </div>
        </div>
    );
}
