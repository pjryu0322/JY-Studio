import { NextResponse } from "next/server";
import { runTemplateAwareChunking } from "@/lib/chunking/templateChunkEngine";
import type { TemplateSchema } from "@/lib/template/schema";
import { loadJobExtractedText } from "@/lib/template/jobDocument";

interface ApplyDraftBody {
  jobId?: string;
  family?: string;
  draft?: {
    docType?: TemplateSchema["docType"];
    sections?: Array<{
      title: string;
      level?: number;
      bbox?: { page: number; x: number; y: number; w: number; h: number };
    }>;
    fields?: Array<{
      label: string;
      bbox?: { page: number; x: number; y: number; w: number; h: number };
    }>;
    tables?: Array<{
      name?: string;
      headerLabels?: string[];
      bbox?: { page: number; x: number; y: number; w: number; h: number };
    }>;
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ApplyDraftBody;
  const jobId = body.jobId?.trim();
  if (!jobId || !body.draft) {
    return NextResponse.json({ error: "jobId and draft are required" }, { status: 400 });
  }
  const doc = await loadJobExtractedText(jobId);
  if (!doc?.text) {
    return NextResponse.json({ error: "Document text not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const sections = (body.draft.sections ?? []).map((section, idx) => ({
    id: `sec_${idx + 1}`,
    title: section.title,
    level: Math.max(1, Math.min(6, section.level ?? 1)),
    required: true,
    orderHint: idx + 1,
    bboxHint: section.bbox,
  }));
  const template: TemplateSchema = {
    templateId: "draft-auto",
    name: "자동 적용 Draft",
    family: body.family?.trim() || "default/general",
    docType: body.draft.docType ?? "unknown",
    version: "v0.1",
    anchors: [],
    sections,
    fields: (body.draft.fields ?? []).map((field, idx) => ({
      key: `field_${idx + 1}`,
      label: field.label,
      required: false,
      sectionId: sections[0]?.id,
      bboxHint: field.bbox,
    })),
    tables: (body.draft.tables ?? []).map((table, idx) => ({
      id: `tbl_${idx + 1}`,
      sectionId: sections[0]?.id,
      headerLabels: table.headerLabels ?? ["항목", "값"],
      required: false,
      bboxHint: table.bbox,
    })),
    repeatBlocks: [],
    createdAt: now,
    updatedAt: now,
  };

  const chunks = runTemplateAwareChunking({ text: doc.text, template });
  return NextResponse.json({
    templateId: template.templateId,
    version: template.version,
    chunks,
    chunkMeta: {
      total: chunks.length,
      sectionChunks: chunks.filter((chunk) => chunk.type === "section").length,
      tableChunks: chunks.filter((chunk) => chunk.type === "table").length,
      repeatChunks: chunks.filter((chunk) => chunk.type === "repeat").length,
    },
  });
}
