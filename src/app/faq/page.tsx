import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function FAQPage() {
    const faqs = [
        {
            q: "How does the AI Prediction work?",
            a: "Our DeepSeek-powered AI analyzes thousands of data points including team form, head-to-head records, player injuries, and market trends to generate high-confidence probabilities."
        },
        {
            q: "What do the confidence colors mean?",
            a: "Green means High Confidence (>60%), Orange is Medium (31-60%), and Red is Low/Risky (<30%). We recommend avoiding bets on Red flagged matches."
        },
        {
            q: "How do I upgrade my subscription?",
            a: "Go to your Dashboard or Profile page and click 'Upgrade Access'. You can pay via M-Pesa using Paystack."
        },
        {
            q: "Can I cancel my subscription?",
            a: "Subscriptions automatically expire at midnight on the day of purchase (Daily Access). You don't need to cancel anything as we don't auto-renew."
        },
        {
            q: "What if the prediction is wrong?",
            a: "Sports betting always carries risk. While our AI has a high strike rate, we cannot guarantee 100% accuracy. Please gamble responsibly."
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white mb-8">
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                <h1 className="text-4xl font-bold mb-2">Frequently Asked Questions</h1>
                <p className="text-gray-400 mb-12">Everything you need to know about Funmo Tips.</p>

                <div className="space-y-8">
                    {faqs.map((item, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-xl hover:bg-white/10 transition-colors">
                            <h3 className="text-xl font-bold mb-3 text-yellow-500">{item.q}</h3>
                            <p className="text-gray-300 leading-relaxed">{item.a}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-12 p-8 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-center">
                    <h2 className="text-2xl font-bold mb-2">Still have questions?</h2>
                    <p className="text-gray-400 mb-6">Contact our support team for help.</p>
                    <Button asChild>
                        <Link href="mailto:support@funmotips.com">Contact Support</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
