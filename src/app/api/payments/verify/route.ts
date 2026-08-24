import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { fulfillSubscription, isPlanId, verifyPaystackTransaction } from "@/lib/paystack";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getAdminAuth().verifyIdToken(token);
    const body = await request.json();
    if (typeof body.reference !== "string" || !isPlanId(body.packageId)) return NextResponse.json({ error: "Invalid payment confirmation" }, { status: 400 });
    const transaction = await verifyPaystackTransaction(body.reference);
    await fulfillSubscription(transaction, user.uid, body.packageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment verification failed" }, { status: 400 });
  }
}
