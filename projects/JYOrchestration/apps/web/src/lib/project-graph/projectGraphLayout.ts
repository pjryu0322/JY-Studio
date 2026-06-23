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

/** 선택 노드를 루트(상단)로 두고 BFS 깊이별로 가로 배치하는 조직도형 레이아웃 */
export function layoutProjectGraphNodesFromRoot(
  rootId: string,
  nodes: readonly Pick<ProjectGraphNodeUi, "id" | "nodeType">[],
  edges: readonly ProjectGraphEdgeUi[],
  width: number,
  height: number,
): Map<string, GraphNodePosition> {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const root = rootId.trim();
  if (!root || !nodeIds.has(root)) {
    return layoutProjectGraphNodes(nodes, width, height);
  }

  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    if (!nodeIds.has(e.fromNodeId) || !nodeIds.has(e.toNodeId)) continue;
    adjacency.get(e.fromNodeId)!.push(e.toNodeId);
    adjacency.get(e.toNodeId)!.push(e.fromNodeId);
  }

  const depth = new Map<string, number>();
  depth.set(root, 0);
  const queue: string[] = [root];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const nb of adjacency.get(cur) ?? []) {
      if (depth.has(nb)) continue;
      depth.set(nb, d + 1);
      queue.push(nb);
    }
  }

  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);
  const orphanDepth = maxDepth + 1;

  const byDepth = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? orphanDepth;
    const list = byDepth.get(d) ?? [];
    list.push(n.id);
    byDepth.set(d, list);
  }

  const positions = new Map<string, GraphNodePosition>();
  const rowGap = 96;
  const topPad = 64;
  const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);

  for (const lvl of sortedDepths) {
    const ids = byDepth.get(lvl) ?? [];
    ids.sort();
    const y = topPad + lvl * rowGap;
    const count = ids.length;
    const usableWidth = Math.max(width - 120, 240);
    ids.forEach((id, i) => {
      const x =
        count === 1
          ? width / 2
          : 60 + (usableWidth * i) / Math.max(count - 1, 1);
      positions.set(id, { x, y: Math.min(y, height - 48) });
    });
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
