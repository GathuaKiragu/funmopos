import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAiOperations } from "@/lib/ai-analysis";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await getAiOperations(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "AI operations are unavailable" }, { status: 503 }); }
}
