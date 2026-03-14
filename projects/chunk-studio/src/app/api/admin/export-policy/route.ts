import { NextResponse } from "next/server";
import { appendAuditLog } from "@/lib/admin/auditLog";
import { getExportPolicy, saveExportPolicy } from "@/lib/admin/adminConfigStore";

interface UpdateBody {
  ragEnabled?: boolean;
  graphEnabled?: boolean;
  includeMetadata?: boolean;
  allowedFormats?: Array<"json" | "jsonl" | "csv">;
}

export async function GET() {
  try {
    const policy = await getExportPolicy();
    return NextResponse.json({ policy });
  } catch (error) {
    console.error("[GET /api/admin/export-policy]", error);
    return NextResponse.json({ error: "Failed to load export policy" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpdateBody;
    const saved = await saveExportPolicy({
      ragEnabled: Boolean(body.ragEnabled),
      graphEnabled: Boolean(body.graphEnabled),
      includeMetadata: Boolean(body.includeMetadata),
      allowedFormats:
        body.allowedFormats?.filter((fmt): fmt is "json" | "jsonl" | "csv" =>
          ["json", "jsonl", "csv"].includes(fmt)
        ) ?? ["jsonl"],
    });
    await appendAuditLog({
      category: "system",
      action: "update_export_policy",
      level: "info",
      detail: { ...saved },
    });
    return NextResponse.json({ policy: saved });
  } catch (error) {
    console.error("[POST /api/admin/export-policy]", error);
    return NextResponse.json({ error: "Failed to save export policy" }, { status: 500 });
  }
}
