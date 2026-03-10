import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/template/templateRepository";
import { loadJobExtractedText } from "@/lib/template/jobDocument";
import { detectLayoutProfile } from "@/lib/template/templateDetector";
import {
  autoDetectTemplateFromText,
  generateDraftTemplate,
} from "@/lib/templateAuto/templateAutoDetector";
import { detectTemplateDrift } from "@/lib/templateDrift/driftEngine";
import {
  listDriftResults,
  saveDriftResult,
} from "@/lib/templateDrift/driftRepository";

interface DriftBody {
  family?: string;
  templateId?: string;
  version?: string;
  docId?: string;
  jobId?: string;
  options?: {
    debug?: boolean;
  };
}

export async function GET(req: Request) {
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
  const items = await listDriftResults({ family, templateId, version });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as DriftBody;
  const isDebug =
    url.searchParams.get("debug") === "1" || body.options?.debug === true;

  const family = body.family?.trim() || "default/general";
  const templateId = body.templateId?.trim();
  const version = body.version?.trim() || undefined;
  const docId = body.docId?.trim() || body.jobId?.trim();
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }
  if (!docId) {
    return NextResponse.json({ error: "docId (or jobId) is required" }, { status: 400 });
  }

  const templateSchema = await getTemplate(family, templateId, version);
  if (!templateSchema) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const doc = await loadJobExtractedText(docId);
  if (!doc || !doc.text.trim()) {
    return NextResponse.json({ error: "Document text not found" }, { status: 404 });
  }

  const auto = autoDetectTemplateFromText(doc.text);
  const draftTemplate = generateDraftTemplate({
    profile: auto.result,
    family,
    name: `${doc.originalFilename ?? "문서"} 자동 템플릿 초안`,
  });
  const layoutProfile = detectLayoutProfile(doc.text);

  const drift = detectTemplateDrift({
    templateSchema,
    layoutProfile,
    extractedTemplateDraft: draftTemplate,
    docId,
    docType: auto.result.docType,
  });
  await saveDriftResult({
    family,
    templateId: templateSchema.templateId,
    version: templateSchema.version,
    docId,
    driftResult: drift,
  });

  return NextResponse.json({
    drift,
    autoDetect: {
      confidence: auto.result.confidence,
      docType: auto.result.docType,
      ...(isDebug ? { reasoning: auto.debug } : {}),
    },
  });
}
