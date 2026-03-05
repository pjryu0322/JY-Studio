import { NextResponse } from "next/server";
import { runTemplateAwareChunking } from "@/lib/chunking/templateChunkEngine";
import { loadJobExtractedText } from "@/lib/template/jobDocument";
import { getTemplate } from "@/lib/template/templateRepository";

interface ApplyBody {
  jobId?: string;
  family?: string;
  templateId?: string;
  version?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ApplyBody;
  const jobId = body.jobId?.trim();
  const family = body.family?.trim() || "default/general";
  const templateId = body.templateId?.trim();
  if (!jobId || !templateId) {
    return NextResponse.json({ error: "jobId and templateId are required" }, { status: 400 });
  }

  const [doc, template] = await Promise.all([
    loadJobExtractedText(jobId),
    getTemplate(family, templateId, body.version),
  ]);
  if (!doc || !doc.text.trim()) {
    return NextResponse.json({ error: "Document text not found" }, { status: 404 });
  }
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const chunks = runTemplateAwareChunking({
    text: doc.text,
    template,
  });
  return NextResponse.json({
    templateId: template.templateId,
    version: template.version,
    chunks,
    chunkMeta: {
      total: chunks.length,
      sectionChunks: chunks.filter((c) => c.type === "section").length,
      tableChunks: chunks.filter((c) => c.type === "table").length,
      repeatChunks: chunks.filter((c) => c.type === "repeat").length,
    },
  });
}

