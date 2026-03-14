import { NextResponse } from "next/server";
import { readAuditLogs } from "@/lib/admin/auditLog";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "200");
    const logs = await readAuditLogs(Number.isFinite(limit) ? limit : 200);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[GET /api/admin/logs]", error);
    return NextResponse.json({ error: "Failed to read admin logs" }, { status: 500 });
  }
}
