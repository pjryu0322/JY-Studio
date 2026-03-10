import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TemplateSchema } from "@/lib/template/schema";
import type { TemplateAwareChunk } from "@/lib/chunking/templateChunkEngine";
import type { DocumentGraph, GraphEdge, GraphNode } from "./graphTypes";

function graphPath(family: string, docId: string): string {
  return path.join(process.cwd(), "data", "graphs", family, docId, "graph.json");
}

export async function loadGraph(
  family: string,
  docId: string
): Promise<DocumentGraph | null> {
  try {
    const raw = await readFile(graphPath(family, docId), "utf-8");
    return JSON.parse(raw) as DocumentGraph;
  } catch {
    return null;
  }
}

export async function saveGraph(
  family: string,
  docId: string,
  graph: DocumentGraph
): Promise<void> {
  const filePath = graphPath(family, docId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(graph, null, 2), "utf-8");
}

export function buildGraphFromTemplate(input: {
  family: string;
  docId: string;
  template: TemplateSchema;
  chunks: TemplateAwareChunk[];
}): DocumentGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const docNodeId = `doc:${input.docId}`;
  nodes.push({
    id: docNodeId,
    type: "doc",
    label: input.docId,
    props: { family: input.family, templateId: input.template.templateId },
  });

  for (const section of input.template.sections) {
    const sectionNodeId = `section:${section.id}`;
    nodes.push({
      id: sectionNodeId,
      type: "section",
      label: section.title,
      props: { level: section.level, orderHint: section.orderHint },
    });
    edges.push({
      id: `edge:${docNodeId}->${sectionNodeId}`,
      from: docNodeId,
      to: sectionNodeId,
      type: "HAS_SECTION",
    });
  }

  for (const field of input.template.fields) {
    const nodeId = `field:${field.key}`;
    nodes.push({
      id: nodeId,
      type: "field",
      label: field.label,
      props: { key: field.key, sectionId: field.sectionId },
    });
    edges.push({
      id: `edge:${docNodeId}->${nodeId}`,
      from: docNodeId,
      to: nodeId,
      type: "HAS_FIELD",
    });
  }

  for (const table of input.template.tables) {
    const nodeId = `table:${table.id}`;
    nodes.push({
      id: nodeId,
      type: "table",
      label: table.headerLabels.join(" | ") || table.id,
      props: { sectionId: table.sectionId, headerLabels: table.headerLabels },
    });
    edges.push({
      id: `edge:${docNodeId}->${nodeId}`,
      from: docNodeId,
      to: nodeId,
      type: "HAS_TABLE",
    });
  }

  input.chunks
    .filter((chunk) => chunk.type === "repeat")
    .forEach((chunk, idx) => {
      const nodeId = `repeat:${idx + 1}`;
      nodes.push({
        id: nodeId,
        type: "repeatItem",
        label: chunk.text.slice(0, 80),
        props: { sectionId: chunk.meta.sectionId },
      });
      edges.push({
        id: `edge:${docNodeId}->${nodeId}`,
        from: docNodeId,
        to: nodeId,
        type: "HAS_REPEAT_ITEM",
      });
    });

  return { nodes, edges };
}
