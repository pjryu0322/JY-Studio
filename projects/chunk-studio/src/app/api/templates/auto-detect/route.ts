import { NextResponse } from "next/server";
import {
  autoDetectTemplateFromText,
  generateDraftTemplate,
} from "@/lib/templateAuto/templateAutoDetector";
import { loadJobExtractedText } from "@/lib/template/jobDocument";

interface AutoDetectBody {
  docId?: string;
  jobId?: string;
  family?: string;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const isDebug = url.searchParams.get("debug") === "1";
  const body = (await req.json().catch(() => ({}))) as AutoDetectBody;
  const docId = body.docId?.trim() || body.jobId?.trim();
  const family = body.family?.trim() || "default/general";
  if (!docId) {
    return NextResponse.json({ error: "docId (or jobId) is required" }, { status: 400 });
  }

  const doc = await loadJobExtractedText(docId);
  if (!doc || !doc.text.trim()) {
    return NextResponse.json({ error: "Document text not found" }, { status: 404 });
  }

  const detected = autoDetectTemplateFromText(doc.text);
  const draftTemplate = generateDraftTemplate({
    profile: detected.result,
    family,
    name: `${doc.originalFilename ?? "문서"} 자동 템플릿 초안`,
  });

  return NextResponse.json({
    docType: detected.result.docType,
    sections: detected.result.sections,
    fields: detected.result.fields,
    tables: detected.result.tables,
    confidence: detected.result.confidence,
    draftTemplate,
    ...(isDebug ? detected.debug : {}),
  });
}
