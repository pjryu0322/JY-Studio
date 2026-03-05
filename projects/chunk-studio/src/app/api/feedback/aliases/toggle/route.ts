import { NextResponse } from "next/server";
import { toggleAlias } from "@/lib/templateFeedback/aliasRepository";

interface ToggleBody {
  family?: string;
  docType?: string;
  type?: "label" | "section";
  from?: string;
  to?: string;
  enabled?: boolean;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ToggleBody;
  const family = body.family?.trim() || "default/general";
  const docType = body.docType?.trim() || "unknown";
  if (!body.type || !body.from?.trim() || !body.to?.trim() || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "type/from/to/enabled are required" },
      { status: 400 }
    );
  }
  const store = await toggleAlias({
    family,
    docType,
    type: body.type,
    from: body.from.trim(),
    to: body.to.trim(),
    enabled: body.enabled,
  });
  return NextResponse.json({
    family,
    docType,
    labels: store.labels,
    sections: store.sections,
  });
}
