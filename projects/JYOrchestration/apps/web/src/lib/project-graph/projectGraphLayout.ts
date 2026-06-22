export type ProjectGraphNodeUi = Readonly<{
  readonly id: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary?: string;
  readonly lifecycleStatus?: string;
  readonly explainability?: unknown;
}>;

export type ProjectGraphEdgeUi = Readonly<{
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly edgeType: string;
}>;

export type GraphNodePosition = Readonly<{ readonly x: number; readonly y: number }>;

const TYPE_ORDER = [
  "Project",
  "Idea",
  "Requirement",
  "Feature",
  "Actor",
  "Screen",
  "Flow",
  "Task",
  "Prototype",
  "Review",
  "Spec",
];

export function layoutProjectGraphNodes(
  nodes: readonly Pick<ProjectGraphNodeUi, "id" | "nodeType">[],
  width: number,
  height: number,
): Map<string, GraphNodePosition> {
  const positions = new Map<string, GraphNodePosition>();
  const columnWidth = Math.max(120, width / Math.max(TYPE_ORDER.length, 1));
  const byType = new Map<string, Pick<ProjectGraphNodeUi, "id" | "nodeType">[]>();

  for (const n of nodes) {
    const list = byType.get(n.nodeType) ?? [];
    list.push(n);
    byType.set(n.nodeType, list);
  }

  for (const [type, list] of byType.entries()) {
    const col = Math.max(0, TYPE_ORDER.indexOf(type));
    const x = 80 + (col >= 0 ? col : TYPE_ORDER.length) * columnWidth;
    list.forEach((n, i) => {
      const y = 60 + i * 72;
      positions.set(n.id, { x, y: Math.min(y, height - 40) });
    });
  }

  let fallbackCol = 0;
  for (const n of nodes) {
    if (positions.has(n.id)) continue;
    positions.set(n.id, { x: 80 + fallbackCol * columnWidth, y: height / 2 });
    fallbackCol++;
  }

  return positions;
}

export function filterGraphNodes(
  nodes: readonly ProjectGraphNodeUi[],
  input: Readonly<{ readonly search?: string; readonly nodeType?: string; readonly lifecycle?: string }>,
): ProjectGraphNodeUi[] {
  const q = input.search?.trim().toLowerCase() ?? "";
  const nodeType = input.nodeType?.trim();
  const lifecycle = input.lifecycle?.trim();
  return nodes.filter((n) => {
    if (nodeType && n.nodeType !== nodeType) return false;
    if (lifecycle && String(n.lifecycleStatus ?? "") !== lifecycle) return false;
    if (q) {
      const hay = `${n.title} ${n.summary ?? ""} ${n.nodeType}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function relatedNodeIds(
  nodeId: string,
  edges: readonly ProjectGraphEdgeUi[],
): { readonly incoming: string[]; readonly outgoing: string[] } {
  const incoming: string[] = [];
  const outgoing: string[] = [];
  for (const e of edges) {
    if (e.toNodeId === nodeId) incoming.push(e.fromNodeId);
    if (e.fromNodeId === nodeId) outgoing.push(e.toNodeId);
  }
  return { incoming, outgoing };
}
