import { NextResponse } from "next/server";
import { getRuntimeReadiness } from "@/lib/runtime-readiness";

export async function GET() {
  const readiness = await getRuntimeReadiness();
  return NextResponse.json(readiness, { status: readiness.ok ? 200 : 503 });
}
