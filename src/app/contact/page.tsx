"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, Send, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact Us",
    description: "Get in touch with the Funmo Tips team for support or inquiries.",
};

export default function ContactPage() {
    const { user } = useAuth();
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("submitting");

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            const response = await fetch("https://formspree.io/f/mrepzrdw", {
                method: "POST",
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                setStatus("success");
                form.reset();
            } else {
                setStatus("error");
            }
        } catch (error) {
            setStatus("error");
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-2xl mx-auto">
                <Link href="/" className="inline-flex items-center text-gray-500 hover:text-white mb-8">
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>

                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold mb-2">Contact & Feedback</h1>
                    <p className="text-gray-400">
                        Have a question, suggestion, or issue? Let us know.
                    </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
                    {status === "success" ? (
                        <div className="text-center py-12 animate-in fade-in zoom-in">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                            <p className="text-gray-400 mb-6">Thank you for your feedback. We usually respond within 24 hours.</p>
                            <Button onClick={() => setStatus("idle")} variant="outline" className="border-white/10 hover:bg-white/5 text-white">
                                Send Another
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Hidden Helper Fields */}
                            <input type="hidden" name="_subject" value="New Feedback - Funmo Tips" />
                            {user && <input type="hidden" name="userId" value={user.uid} />}

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Your Name</label>
                                    <input
                                        required
                                        type="text"
                                        name="name"
                                        defaultValue={user?.email?.split('@')[0] || ""}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Email Address</label>
                                    <input
                                        required
                                        type="email"
                                        name="email"
                                        defaultValue={user?.email || ""}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                                        placeholder="john@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Category</label>
                                <select
                                    name="category"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors appearance-none"
                                >
                                    <option value="General">General Inquiry</option>
                                    <option value="Support">Technical Support</option>
                                    <option value="Feedback">Feedback / Suggestion</option>
                                    <option value="Billing">Billing Issue</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Message</label>
                                <textarea
                                    required
                                    name="message"
                                    rows={5}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors resize-none"
                                    placeholder="How can we help you today?"
                                />
                            </div>

                            {status === "error" && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg text-center">
                                    Something went wrong. Please try again.
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={status === "submitting"}
                                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold h-12 text-lg rounded-lg transition-all"
                            >
                                {status === "submitting" ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Send Message <Send className="w-4 h-4" />
                                    </span>
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
