import { NextResponse } from "next/server";
import { loadJobExtractedText } from "@/lib/template/jobDocument";
import { getTemplate } from "@/lib/template/templateRepository";
import { runTemplateDiff } from "@/lib/templateDiff/templateDiffEngine";

interface DiffBody {
  docAId?: string;
  docBId?: string;
  templateId?: string;
  family?: string;
  version?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as DiffBody;
  const docAId = body.docAId?.trim();
  const docBId = body.docBId?.trim();
  const templateId = body.templateId?.trim();
  const family = body.family?.trim() || "default/general";

  if (!docAId || !docBId || !templateId) {
    return NextResponse.json(
      { error: "docAId, docBId, templateId are required" },
      { status: 400 }
    );
  }

  const [docA, docB, template] = await Promise.all([
    loadJobExtractedText(docAId),
    loadJobExtractedText(docBId),
    getTemplate(family, templateId, body.version),
  ]);
  if (!docA?.text || !docB?.text) {
    return NextResponse.json({ error: "Document text not found" }, { status: 404 });
  }
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const diff = runTemplateDiff({
    docA: docA.text,
    docB: docB.text,
    template,
  });

  return NextResponse.json(diff);
}
