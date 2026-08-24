import { NextResponse } from "next/server";
import { fulfillSubscription, isPlanId, paymentMetadata, verifyPaystackSignature } from "@/lib/paystack";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    const event = JSON.parse(rawBody);
    if (event.event !== "charge.success") return NextResponse.json({ received: true });
    const metadata = paymentMetadata(event.data || {});
    if (!metadata?.userId || !isPlanId(metadata.packageId)) return NextResponse.json({ received: true });
    await fulfillSubscription(event.data, metadata.userId, metadata.packageId);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook processing failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
