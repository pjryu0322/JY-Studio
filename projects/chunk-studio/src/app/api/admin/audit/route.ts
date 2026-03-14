import { NextResponse } from "next/server";
import { appendAuditLog, type AuditCategory } from "@/lib/admin/auditLog";

interface AuditBody {
  category?: AuditCategory;
  action?: string;
  jobId?: string | null;
  level?: "info" | "warn" | "error";
  detail?: Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AuditBody;
    if (!body.category || !body.action) {
      return NextResponse.json({ error: "category and action are required" }, { status: 400 });
    }
    await appendAuditLog({
      category: body.category,
      action: body.action,
      jobId: body.jobId ?? null,
      level: body.level ?? "info",
      detail: body.detail,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/admin/audit]", error);
    return NextResponse.json({ error: "Failed to write audit log" }, { status: 500 });
  }
}
