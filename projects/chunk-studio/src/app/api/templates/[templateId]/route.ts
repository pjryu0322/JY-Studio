import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/template/templateRepository";

type RouteCtx = {
  params: Promise<{ templateId: string }>;
};

export async function GET(req: Request, ctx: RouteCtx) {
  const { templateId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const family = searchParams.get("family")?.trim() || "default/general";
  const version = searchParams.get("version")?.trim() || undefined;

  const template = await getTemplate(family, templateId, version);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

