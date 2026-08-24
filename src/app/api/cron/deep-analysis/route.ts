import { NextResponse } from "next/server";
import { isAnalysisWindow, runScheduledAnalysis } from "@/lib/ai-analysis";

export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAnalysisWindow()) return NextResponse.json({ success: true, skipped: "Outside configured analysis window" });
  try { return NextResponse.json({ success: true, ...(await runScheduledAnalysis()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis run failed" }, { status: 500 }); }
}
