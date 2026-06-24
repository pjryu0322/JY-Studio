import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

export function knowledgeGraphSnapshotToCanvasGraph(snapshot: KnowledgeGraphRevisionSnapshot): {
  readonly nodes: ProjectGraphNodeDto[];
  readonly edges: ProjectGraphEdgeDto[];
} {
  const entityToCanvasId = new Map<string, string>();
  const nodes: ProjectGraphNodeDto[] = [];

  for (const n of snapshot.nodes) {
    const id = `rev:${n.entityKey}`;
    entityToCanvasId.set(n.entityKey, id);
    nodes.push({
      id,
      nodeType: n.nodeType,
      title: n.title,
      summary: n.summary,
      lifecycleStatus: n.lifecycleStatus,
    });
  }

  const edges: ProjectGraphEdgeDto[] = [];
  let edgeIdx = 0;
  for (const e of snapshot.edges) {
    const fromNodeId = entityToCanvasId.get(e.fromEntityKey);
    const toNodeId = entityToCanvasId.get(e.toEntityKey);
    if (!fromNodeId || !toNodeId) continue;
    edgeIdx += 1;
    edges.push({
      id: `rev-edge:${edgeIdx}`,
      fromNodeId,
      toNodeId,
      edgeType: e.edgeType,
    });
  }

  return { nodes, edges };
}

export function formatKnowledgeRevisionTimelineLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

export function formatKnowledgeRevisionTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

/** Timeline card: "항목 2개 추가 · 연결 3개 추가" */
export function formatKnowledgeRevisionChangeHintInline(lines: readonly string[]): string | null {
  const filtered = lines.filter((line) => line !== "변화 없음");
  if (filtered.length === 0) return null;
  return filtered
    .map((line) => line.replace(/^[+-]\s*/, ""))
    .join(" · ");
}

export const KNOWLEDGE_REVISION_DIFF_MAX_VISIBLE_LINES = 3;

export function summarizeKnowledgeRevisionDiffLines(
  lines: readonly string[],
  maxVisible = KNOWLEDGE_REVISION_DIFF_MAX_VISIBLE_LINES,
): Readonly<{ readonly visibleLines: readonly string[]; readonly overflowCount: number }> {
  const filtered = lines.filter((line) => line !== "변화 없음");
  if (filtered.length <= maxVisible) {
    return { visibleLines: filtered, overflowCount: 0 };
  }
  return {
    visibleLines: filtered.slice(0, maxVisible),
    overflowCount: filtered.length - maxVisible,
  };
}

export function formatKnowledgeRevisionDiffOverflowMessage(overflowCount: number): string | null {
  if (overflowCount <= 0) return null;
  return `외 ${overflowCount}개 변경 더 있음`;
}
