import { NextRequest, NextResponse } from "next/server";
import { resolveProvider, getClarifyingQuestions } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = resolveProvider(body);
    const questions = await getClarifyingQuestions(provider, body.task_or_prompt, body.mode);
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
