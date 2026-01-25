import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Disclaimer",
    description: "Important legal disclaimer regarding betting advice and financial risk.",
};

export default function DisclaimerPage() {
    return (
        <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-yellow-500/30 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-8">

                <Link href="/" className="inline-flex items-center text-sm text-yellow-500 hover:text-yellow-400 transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                <div className="flex items-center gap-4 mb-8">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                    <h1 className="text-4xl font-bold text-white">Disclaimer</h1>
                </div>

                <section className="p-6 bg-red-900/10 border border-red-500/20 rounded-xl space-y-4">
                    <h2 className="text-xl font-semibold text-red-400">Not Financial Advice</h2>
                    <p className="text-white">
                        The content provided by Funmo Tips is for informational and entertainment purposes only. It does not constitute financial, investment, or betting advice.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">1. Risk Warning</h2>
                    <p>
                        Betting on sports involves a high degree of risk. You should only bet with money you can afford to lose. Past performance of our AI models is not indicative of future results.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">2. Accuracy of Information</h2>
                    <p>
                        While we strive to provide accurate and up-to-date information, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability or availability of the website or the information.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">3. Responsible Gambling</h2>
                    <p>
                        If you or someone you know has a gambling problem, please seek help.
                    </p>
                </section>
            </div>
        </div>
    );
}
