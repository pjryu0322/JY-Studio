import { NextResponse } from "next/server";
import { readAuditLogs } from "@/lib/admin/auditLog";
import { buildClassifierOverview } from "@/lib/admin/classifierOverview";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "2000");
    const logs = await readAuditLogs(
      Number.isFinite(limit) ? limit : 2000,
    );
    const overview = buildClassifierOverview(logs);
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("[GET /api/admin/classifier-overview]", error);
    return NextResponse.json(
      { error: "Failed to build classifier overview" },
      { status: 500 },
    );
  }
}
