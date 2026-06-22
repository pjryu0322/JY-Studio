import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import type { StructureExplainabilityRelatedNode } from "@/lib/project-structure/structureExplainabilityModel";

export type GraphAdjacencyUndirected = Readonly<Map<string, readonly string[]>>;

export type GraphImpactZones = Readonly<{
  readonly depth1: ReadonlySet<string>;
  readonly depth2: ReadonlySet<string>;
}>;

export type GraphExplorationQuery = Readonly<{
  readonly kind: "text" | "question";
  readonly questionId?: string;
  readonly searchText: string;
  readonly nodeTypeFilter?: string;
  readonly edgeTypeFilter?: string;
  readonly emphasizeExplainability?: boolean;
}>;

const EXPLORER_NODE_TYPES = ["Requirement", "Feature", "Screen", "Flow", "Review", "Task"] as const;

export function buildUndirectedAdjacency(
  edges: readonly Pick<ProjectGraphEdgeDto, "fromNodeId" | "toNodeId">[],
): GraphAdjacencyUndirected {
  const map = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    if (!a || !b) return;
    const la = map.get(a) ?? [];
    if (!la.includes(b)) la.push(b);
    map.set(a, la);
    const lb = map.get(b) ?? [];
    if (!lb.includes(a)) lb.push(a);
    map.set(b, lb);
  };
  for (const e of edges) link(e.fromNodeId, e.toNodeId);
  return map;
}

export function collectNeighbors(nodeId: string, adjacency: GraphAdjacencyUndirected): string[] {
  return [...(adjacency.get(nodeId) ?? [])];
}

export function computeImpactZones(
  nodeId: string,
  adjacency: GraphAdjacencyUndirected,
  maxDepth = 2,
): GraphImpactZones {
  const depth1 = new Set<string>();
  const depth2 = new Set<string>();
  const start = String(nodeId).trim();
  if (!start) return { depth1, depth2 };

  const d1 = collectNeighbors(start, adjacency);
  for (const id of d1) depth1.add(id);

  if (maxDepth < 2) return { depth1, depth2 };

  for (const n1 of d1) {
    for (const n2 of collectNeighbors(n1, adjacency)) {
      if (n2 === start || depth1.has(n2)) continue;
      depth2.add(n2);
    }
  }
  return { depth1, depth2 };
}

export function expandVisibleNodeIds(
  focusNodeId: string | null,
  expandedNodeIds: ReadonlySet<string>,
  allNodeIds: readonly string[],
): Set<string> | null {
  if (!focusNodeId) return null;
  const visible = new Set<string>([focusNodeId]);
  for (const id of expandedNodeIds) visible.add(id);
  for (const id of allNodeIds) {
    if (expandedNodeIds.has(id)) visible.add(id);
  }
  return visible;
}

export function parseGraphQuestionQuery(raw: string): GraphExplorationQuery {
  const q = String(raw ?? "").trim();
  const lower = q.toLowerCase();

  if (!q) {
    return { kind: "text", searchText: "" };
  }

  if (/왜\s*.+생성|생성\s*이유|왜\s*만들/.test(q)) {
    return { kind: "question", questionId: "why-created", searchText: q, emphasizeExplainability: true };
  }
  if (/어떤\s*대화|대화\s*에서|출처\s*대화/.test(q)) {
    return { kind: "question", questionId: "source-conversation", searchText: q, emphasizeExplainability: true };
  }
  if (/어떤\s*기능|연결.*기능|기능과\s*연결/.test(q)) {
    return { kind: "question", questionId: "connected-features", searchText: q, nodeTypeFilter: "Feature" };
  }
  if (/어떤\s*화면|화면에\s*영향|영향.*화면/.test(q)) {
    return { kind: "question", questionId: "connected-screens", searchText: q, nodeTypeFilter: "Screen" };
  }
  if (/어떤\s*review|리뷰|검토/.test(lower) || /Review/.test(q)) {
    return { kind: "question", questionId: "connected-reviews", searchText: q, nodeTypeFilter: "Review" };
  }

  return { kind: "text", searchText: q };
}

export function applyGraphExplorationQuery(
  nodes: readonly ProjectGraphNodeDto[],
  query: GraphExplorationQuery,
): { readonly nodes: ProjectGraphNodeDto[]; readonly highlightIds: ReadonlySet<string> } {
  let list = [...nodes];
  const highlightIds = new Set<string>();

  if (query.nodeTypeFilter) {
    list = list.filter((n) => n.nodeType === query.nodeTypeFilter);
  }

  if (query.kind === "question") {
    if (query.questionId === "why-created") {
      for (const n of list) {
        if (n.explainability?.reason) highlightIds.add(n.id);
      }
      list = list.filter((n) => Boolean(n.explainability?.reason));
    } else if (query.questionId === "source-conversation") {
      list = list.filter(
        (n) =>
          Boolean(n.explainability?.sourceConversation.excerpt && n.explainability.sourceConversation.excerpt !== "—"),
      );
      for (const n of list) highlightIds.add(n.id);
    } else if (
      query.questionId === "connected-features" ||
      query.questionId === "connected-screens" ||
      query.questionId === "connected-reviews"
    ) {
      for (const n of list) highlightIds.add(n.id);
    }
  } else if (query.searchText) {
    const t = query.searchText.toLowerCase();
    list = list.filter((n) => {
      const hay = `${n.title} ${n.summary ?? ""} ${n.nodeType} ${n.explainability?.reason ?? ""} ${n.explainability?.sourceConversation.excerpt ?? ""}`.toLowerCase();
      return hay.includes(t);
    });
    for (const n of list) highlightIds.add(n.id);
  }

  return { nodes: list, highlightIds };
}

export function findGraphNodeIdsForSourceMessageId(
  nodes: readonly ProjectGraphNodeDto[],
  sourceMessageId: string,
): string[] {
  const mid = String(sourceMessageId ?? "").trim();
  if (!mid) return [];
  return nodes
    .filter((n) => {
      const ex = n.explainability;
      if (!ex) return false;
      return ex.createdFrom.messageId === mid || ex.sourceConversation.messageId === mid;
    })
    .map((n) => n.id);
}

export function buildKnowledgeGraphHref(
  projectId: string,
  input?: Readonly<{ readonly focusNodeId?: string; readonly sourceMessageId?: string }>,
): string {
  const pid = String(projectId).trim();
  const base = `/projects/${encodeURIComponent(pid)}/knowledge-graph`;
  const params = new URLSearchParams();
  if (input?.focusNodeId) params.set("focusNodeId", input.focusNodeId);
  if (input?.sourceMessageId) params.set("sourceMessageId", input.sourceMessageId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function groupRelatedNodesForExplorer(
  related: readonly StructureExplainabilityRelatedNode[],
): Record<(typeof EXPLORER_NODE_TYPES)[number] | "Other", StructureExplainabilityRelatedNode[]> {
  const buckets = {
    Requirement: [] as StructureExplainabilityRelatedNode[],
    Feature: [] as StructureExplainabilityRelatedNode[],
    Screen: [] as StructureExplainabilityRelatedNode[],
    Flow: [] as StructureExplainabilityRelatedNode[],
    Review: [] as StructureExplainabilityRelatedNode[],
    Task: [] as StructureExplainabilityRelatedNode[],
    Other: [] as StructureExplainabilityRelatedNode[],
  };
  for (const r of related) {
    const key = r.nodeType as (typeof EXPLORER_NODE_TYPES)[number];
    if (EXPLORER_NODE_TYPES.includes(key)) buckets[key].push(r);
    else buckets.Other.push(r);
  }
  return buckets;
}
