import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/llm";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(PROVIDERS);
}
