import "server-only";
import crypto from "crypto";
import { admin, getAdminDb } from "@/lib/firebase-admin";

export const SUBSCRIPTION_PLANS = {
  daily: { amount: 10000, days: 1 },
  "3day": { amount: 25000, days: 3 },
  weekly: { amount: 50000, days: 7 },
} as const;
export type PlanId = keyof typeof SUBSCRIPTION_PLANS;

type VerifiedTransaction = { status: string; amount: number; currency: string; reference: string; metadata?: unknown };

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

export function isPlanId(value: unknown): value is PlanId { return typeof value === "string" && value in SUBSCRIPTION_PLANS; }

function metadataValues(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return {} as { userId?: string; packageId?: string };
  const data = metadata as { userId?: string; packageId?: string; custom_fields?: Array<{ variable_name?: string; value?: string }> };
  const fields = Object.fromEntries((data.custom_fields || []).map(field => [field.variable_name, field.value]));
  return { userId: data.userId || fields.user_id, packageId: data.packageId || fields.package_id };
}

export async function verifyPaystackTransaction(reference: string): Promise<VerifiedTransaction> {
  if (!/^[A-Za-z0-9.=\-]{6,128}$/.test(reference)) throw new Error("Invalid payment reference");
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret()}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Payment provider verification failed");
  const body = await response.json();
  if (!body.status || !body.data || body.data.status !== "success") throw new Error("Payment has not completed");
  return body.data;
}

/** Idempotently grants the precise purchased plan after a provider-side verification. */
export async function fulfillSubscription(transaction: VerifiedTransaction, userId: string, planId: PlanId) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (transaction.amount !== plan.amount || transaction.currency !== "KES") throw new Error("Payment amount or currency does not match the selected plan");
  const metadata = metadataValues(transaction.metadata);
  if (metadata.userId !== userId) throw new Error("Payment belongs to a different account");
  if (metadata.packageId !== planId) throw new Error("Payment plan does not match the selected plan");

  const db = getAdminDb();
  const transactionRef = db.collection("transactions").doc(transaction.reference);
  const userRef = db.collection("users").doc(userId);
  await db.runTransaction(async tx => {
    if ((await tx.get(transactionRef)).exists) return;
    const user = await tx.get(userRef);
    const currentExpiry = user.exists ? user.data()?.subscriptionExpiry?.toDate?.() : undefined;
    const start = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
    const expiry = new Date(start.getTime() + plan.days * 24 * 60 * 60 * 1000);
    tx.set(userRef, { subscriptionStatus: "active", tier: "vip", subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiry), lastPaymentRef: transaction.reference, lastPackageId: planId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.create(transactionRef, { userId, amount: plan.amount, currency: "KES", packageId: planId, tier: "vip", reference: transaction.reference, status: "success", provider: "paystack", paidAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

export function paymentMetadata(transaction: { metadata?: unknown }) { return metadataValues(transaction.metadata); }

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secret()).update(rawBody).digest("hex");
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
