import { NextResponse } from "next/server";
import { getDriftResult } from "@/lib/templateDrift/driftRepository";

type RouteCtx = {
  params: Promise<{ docId: string }>;
};

export async function GET(req: Request, ctx: RouteCtx) {
  const { docId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const family = searchParams.get("family")?.trim() || "default/general";
  const templateId = searchParams.get("templateId")?.trim();
  const version = searchParams.get("version")?.trim();
  if (!templateId || !version) {
    return NextResponse.json(
      { error: "templateId and version are required" },
      { status: 400 }
    );
  }
  const drift = await getDriftResult({ family, templateId, version, docId });
  if (!drift) {
    return NextResponse.json({ error: "Drift not found" }, { status: 404 });
  }
  return NextResponse.json({ drift });
}
