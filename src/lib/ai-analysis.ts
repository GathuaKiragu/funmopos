import "server-only";
import crypto from "crypto";
import { getAdminDb, admin } from "@/lib/firebase-admin";
import type { Fixture } from "@/lib/api-football";

const model = () => process.env.AI_ANALYSIS_MODEL || "gemini-2.5-flash";
const timezone = () => process.env.PLATFORM_TIMEZONE || "Africa/Nairobi";
const dailyBudget = () => Math.max(0, Number(process.env.AI_DAILY_REQUEST_BUDGET || 40));
const promptVersion = "analysis-v1";

type Explanation = { verdict: "supported" | "weakened" | "caution"; summary: string; supportingFactors: string[]; cautions: string[] };

export function isAnalysisWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone(), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.minute === "00" && (values.hour === "00" || values.hour === "12");
}

function inputFor(fixture: Fixture) {
  return {
    fixtureId: fixture.id, competition: fixture.league.name, kickoff: fixture.date,
    teams: { home: fixture.homeTeam.name, away: fixture.awayTeam.name },
    prediction: fixture.prediction ? { picked: fixture.prediction.picked, probabilities: fixture.prediction.probabilities, reasoning: fixture.prediction.reasoning } : null,
    dataAvailable: { stats: Boolean(fixture.stats), lineups: Boolean(fixture.lineups), injuries: Boolean(fixture.injuries?.length), odds: Boolean(fixture.latestOdds?.length) }
  };
}

function hash(value: unknown) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function parseExplanation(value: unknown): Explanation | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!["supported", "weakened", "caution"].includes(String(v.verdict)) || typeof v.summary !== "string" || !Array.isArray(v.supportingFactors) || !Array.isArray(v.cautions)) return null;
  return { verdict: v.verdict as Explanation["verdict"], summary: v.summary.slice(0, 700), supportingFactors: v.supportingFactors.filter(x => typeof x === "string").slice(0, 4), cautions: v.cautions.filter(x => typeof x === "string").slice(0, 4) };
}

async function recordMetric(data: Record<string, unknown>) {
  await getAdminDb().collection("ai_metrics").add({ ...data, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

async function usedToday() {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const snapshot = await getAdminDb().collection("ai_metrics").where("createdAt", ">=", admin.firestore.Timestamp.fromDate(start)).get();
  return snapshot.docs.filter(d => d.data().kind === "request").length;
}

async function generate(input: ReturnType<typeof inputFor>): Promise<{ explanation: Explanation; inputTokens?: number; outputTokens?: number }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const prompt = `You explain a statistical football prediction. Use ONLY this JSON evidence. Never invent injuries, news, odds or statistics. Return strict JSON with verdict (supported|weakened|caution), summary, supportingFactors (max 4), cautions (max 4). If evidence is sparse use caution. Evidence: ${JSON.stringify(input)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 500 } }), signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const body = await response.json();
  const explanation = parseExplanation(JSON.parse(body.candidates?.[0]?.content?.parts?.[0]?.text || "null"));
  if (!explanation) throw new Error("Gemini returned an invalid analysis schema");
  return { explanation, inputTokens: body.usageMetadata?.promptTokenCount, outputTokens: body.usageMetadata?.candidatesTokenCount };
}

export async function runScheduledAnalysis() {
  const db = getAdminDb();
  const lock = db.collection("job_locks").doc("deep-analysis");
  const now = Date.now();
  await db.runTransaction(async tx => {
    const current = await tx.get(lock);
    if (current.exists && Number(current.data()?.expiresAt || 0) > now) throw new Error("Analysis job already running");
    tx.set(lock, { expiresAt: now + 10 * 60_000, startedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  const run = db.collection("ai_analysis_runs").doc();
  const started = Date.now();
  try {
    const snapshot = await db.collection("fixtures").where("sport", "==", "football").get();
    const upcoming = snapshot.docs.map(d => ({ ref: d.ref, fixture: d.data() as Fixture })).filter(({ fixture }) => new Date(fixture.date).getTime() > now && Boolean(fixture.prediction)).sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
    const remaining = Math.max(0, dailyBudget() - await usedToday());
    let succeeded = 0, failed = 0, skipped = 0;
    for (const item of upcoming.slice(0, remaining)) {
      const input = inputFor(item.fixture); const inputHash = hash(input);
      const existing = item.fixture as Fixture & { aiAnalysis?: { inputHash?: string } };
      if (existing.aiAnalysis?.inputHash === inputHash) { skipped++; continue; }
      const began = Date.now();
      try {
        const generated = await generate(input);
        await item.ref.set({ aiAnalysis: { ...generated.explanation, model: model(), promptVersion, inputHash, predictionVersion: "statistical-v1", status: "ready", generatedAt: admin.firestore.FieldValue.serverTimestamp() } }, { merge: true });
        await recordMetric({ kind: "request", status: "success", model: model(), inputTokens: generated.inputTokens || null, outputTokens: generated.outputTokens || null, latencyMs: Date.now() - began }); succeeded++;
      } catch (error) { await item.ref.set({ aiAnalysis: { status: "unavailable", updatedAt: admin.firestore.FieldValue.serverTimestamp() } }, { merge: true }); await recordMetric({ kind: "request", status: "failed", model: model(), latencyMs: Date.now() - began, error: error instanceof Error ? error.message : "unknown" }); failed++; }
    }
    await run.set({ status: "completed", timezone: timezone(), model: model(), candidates: upcoming.length, succeeded, failed, skipped, startedAt: admin.firestore.Timestamp.fromMillis(started), completedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { succeeded, failed, skipped, candidates: upcoming.length };
  } finally { await lock.delete().catch(() => undefined); }
}

export async function getAiOperations() {
  const db = getAdminDb(); const today = await usedToday();
  const runs = await db.collection("ai_analysis_runs").orderBy("startedAt", "desc").limit(1).get();
  return { timezone: timezone(), model: model(), dailyBudget: dailyBudget(), requestsToday: today, lastRun: runs.empty ? null : runs.docs[0].data(), schedule: ["00:00", "12:00"], nextScheduledWindow: "00:00 or 12:00 in configured timezone" };
}
