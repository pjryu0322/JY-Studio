import { NextResponse } from "next/server";
import { addDiffToGraph } from "@/lib/graph/addDiffToGraph";
import {
  loadGraph,
  saveGraph,
} from "@/lib/graph/buildGraphFromTemplate";
import { runTemplateDiff } from "@/lib/templateDiff/templateDiffEngine";
import { loadJobExtractedText } from "@/lib/template/jobDocument";
import { getTemplate } from "@/lib/template/templateRepository";

interface GraphDiffBody {
  family?: string;
  docAId?: string;
  docBId?: string;
  templateId?: string;
  version?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as GraphDiffBody;
  const family = body.family?.trim() || "default/general";
  const docAId = body.docAId?.trim();
  const docBId = body.docBId?.trim();
  const templateId = body.templateId?.trim();
  if (!docAId || !docBId || !templateId) {
    return NextResponse.json(
      { error: "family/docAId/docBId/templateId required" },
      { status: 400 }
    );
  }

  const [docA, docB, template, existingGraph] = await Promise.all([
    loadJobExtractedText(docAId),
    loadJobExtractedText(docBId),
    getTemplate(family, templateId, body.version),
    loadGraph(family, docAId),
  ]);
  if (!docA?.text || !docB?.text) {
    return NextResponse.json({ error: "document text not found" }, { status: 404 });
  }
  if (!template) {
    return NextResponse.json({ error: "template not found" }, { status: 404 });
  }
  if (!existingGraph) {
    return NextResponse.json({ error: "base graph not found. build first." }, { status: 404 });
  }

  const diff = runTemplateDiff({
    docA: docA.text,
    docB: docB.text,
    template,
  });
  const graphWithDiff = addDiffToGraph(existingGraph, diff, docAId, docBId);
  await saveGraph(family, docAId, graphWithDiff);

  return NextResponse.json({
    family,
    docAId,
    docBId,
    nodes: graphWithDiff.nodes.length,
    edges: graphWithDiff.edges.length,
    diffSummary: {
      fields: diff.fieldsChanged.length,
      sections: diff.sectionsChanged.filter((s) => s.changeType !== "unchanged").length,
      tables: diff.tablesChanged.length,
    },
  });
}
