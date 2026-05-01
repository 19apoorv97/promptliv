import { NextRequest, NextResponse } from "next/server";
import { resolveProvider, runGenerate } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = resolveProvider(body);
    const result = await runGenerate(provider, body.task, body.context ?? "");
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
