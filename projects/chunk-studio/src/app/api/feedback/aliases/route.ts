import { NextResponse } from "next/server";
import { buildAliasMap } from "@/lib/templateFeedback/aliasRepository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const family = searchParams.get("family")?.trim() || "default/general";
  const docType = searchParams.get("docType")?.trim() || "unknown";
  const aliases = await buildAliasMap({ family, docType });
  return NextResponse.json({
    family,
    docType,
    source: aliases.source,
    labels: aliases.labels,
    sections: aliases.sections,
  });
}
