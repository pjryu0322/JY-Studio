import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/template/templateRepository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const family = searchParams.get("family")?.trim() || "default/general";
  const templates = await listTemplates(family);
  return NextResponse.json({ family, templates });
}

