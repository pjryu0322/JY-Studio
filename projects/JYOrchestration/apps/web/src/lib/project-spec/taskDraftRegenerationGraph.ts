import { computeStageAwareLaneLayout, type WorkflowStage } from "@/lib/project-spec/workflowLaneLayout";
import { stageForNodeType, type TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";
import { synthesizeWorkflowDrafts, type WorkflowDraftSeed } from "@/lib/project-spec/workflowDraftSynthesis";

export type AiCreatedDraftRow = {
  id: string;
  type: TaskNodeType;
  title: string;
  description: string | null;
  priority: string;
  createdAt: Date;
};

function uniqueStrings(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const v = String(id ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** Remove unknown ids, self-deps, duplicates. `dependsOnIds` = prerequisite task ids. */
export function normalizeDependencyReferences(
  depsById: Map<string, string[]>,
  validIds: Set<string>
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of validIds) {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const d of depsById.get(id) ?? []) {
      if (!validIds.has(d) || d === id || seen.has(d)) continue;
      seen.add(d);
      list.push(d);
    }
    out.set(id, list);
  }
  return out;
}

function snapDeps(depsById: Map<string, string[]>): string {
  const keys = [...depsById.keys()].sort();
  return keys.map((k) => `${k}:[${(depsById.get(k) ?? []).slice().sort().join(",")}]`).join("|");
}

type CycleHit = { targetId: string; depId: string } | null;

/** `depsById.get(node)` = prerequisites of `node` (edge dep → node). */
function detectCycleEdge(nodes: string[], depsById: Map<string, string[]>): CycleHit {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string | null>();

  const dfs = (id: string): CycleHit => {
    visited.add(id);
    inStack.add(id);
    for (const dep of depsById.get(id) ?? []) {
      if (!visited.has(dep)) {
        parent.set(dep, id);
        const hit = dfs(dep);
        if (hit) return hit;
      } else if (inStack.has(dep)) {
        return { targetId: id, depId: dep };
      }
    }
    inStack.delete(id);
    return null;
  };

  for (const id of nodes) {
    if (!visited.has(id)) {
      parent.set(id, null);
      const hit = dfs(id);
      if (hit) return hit;
    }
  }
  return null;
}

function removeDep(depsById: Map<string, string[]>, targetId: string, depId: string): void {
  const arr = depsById.get(targetId);
  if (!arr) return;
  depsById.set(
    targetId,
    arr.filter((x) => x !== depId)
  );
}

export function breakCyclesDeterministically(allIds: string[], depsById: Map<string, string[]>): void {
  const idList = [...allIds];
  for (let guard = 0; guard < 4000; guard++) {
    const hit = detectCycleEdge(idList, depsById);
    if (!hit) return;
    removeDep(depsById, hit.targetId, hit.depId);
  }
}

function hasMissingReferences(allIds: Set<string>, depsById: Map<string, string[]>): boolean {
  for (const id of allIds) {
    for (const d of depsById.get(id) ?? []) {
      if (!allIds.has(d)) return true;
    }
  }
  return false;
}

function hasRootNode(allIds: string[], depsById: Map<string, string[]>): boolean {
  return allIds.some((id) => (depsById.get(id) ?? []).length === 0);
}

function mapFromSynthesized(
  syn: Array<{ id: string; dependsOnIds: string[]; stage: WorkflowStage }>
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const s of syn) {
    m.set(s.id, uniqueStrings(s.dependsOnIds ?? []));
  }
  return m;
}

function seedsFromRows(rows: AiCreatedDraftRow[], deps: Map<string, string[]>): WorkflowDraftSeed[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    createdAt: r.createdAt,
    stage: stageForNodeType(r.type),
    dependsOnIds: deps.get(r.id) ?? [],
  }));
}

/**
 * After AI creates TaskDraft rows, normalize deps, synthesize a connected DAG (phase order + sequential),
 * break any remaining cycles, re-synthesize once so backbone / isolates recover, then layout from `dependsOnIds`.
 */
export function finalizeAiGeneratedTaskDraftGraph(
  rows: AiCreatedDraftRow[],
  initialDepsById: Map<string, string[]>
): {
  finalDepsById: Map<string, string[]>;
  positionById: Map<string, { x: number; y: number }>;
  stageById: Map<string, WorkflowStage>;
  graphAutoRepaired: boolean;
} {
  const allIds = new Set(rows.map((r) => r.id));
  if (allIds.size === 0) {
    throw new Error("TASK_DRAFT_GRAPH_EMPTY");
  }

  const normalized = normalizeDependencyReferences(initialDepsById, allIds);
  const beforeSnap = snapDeps(normalized);

  const run = (d: Map<string, string[]>) => {
    const syn = synthesizeWorkflowDrafts(seedsFromRows(rows, d));
    const next = mapFromSynthesized(syn);
    breakCyclesDeterministically([...allIds], next);
    return { syn, next };
  };

  const depsAfter = run(normalized).next;
  const { syn: syn2, next: finalDeps } = run(depsAfter);

  const stageById = new Map<string, WorkflowStage>();
  for (const s of syn2) {
    stageById.set(s.id, s.stage);
  }

  if (hasMissingReferences(allIds, finalDeps)) {
    throw new Error("TASK_DRAFT_GRAPH_MISSING_REF_AFTER_REPAIR");
  }
  if (detectCycleEdge([...allIds], finalDeps)) {
    throw new Error("TASK_DRAFT_GRAPH_CYCLE_AFTER_REPAIR");
  }
  if (allIds.size > 1 && !hasRootNode([...allIds], finalDeps)) {
    throw new Error("TASK_DRAFT_GRAPH_NO_ROOT_AFTER_REPAIR");
  }

  const edges: Array<{ source: string; target: string }> = [];
  for (const id of allIds) {
    for (const dep of finalDeps.get(id) ?? []) {
      if (dep !== id) edges.push({ source: dep, target: id });
    }
  }

  const layoutRows = rows.map((r) => ({
    id: r.id,
    stage: stageById.get(r.id) ?? stageForNodeType(r.type),
  }));
  const posList = computeStageAwareLaneLayout(layoutRows, edges);
  const positionById = new Map(posList.map((p) => [p.id, { x: p.x, y: p.y }] as const));

  const afterSnap = snapDeps(finalDeps);
  const graphAutoRepaired = beforeSnap !== afterSnap;

  return { finalDepsById: finalDeps, positionById, stageById, graphAutoRepaired };
}
