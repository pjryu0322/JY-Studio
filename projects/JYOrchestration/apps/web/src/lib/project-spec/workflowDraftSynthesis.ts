import {
  LANE_LAYOUT,
  WORKFLOW_STAGES,
  computeStageAwareLaneLayout,
  laneBandTopY,
  normalizeWorkflowStage,
  type WorkflowStage,
} from "@/lib/project-spec/workflowLaneLayout";

export { WORKFLOW_STAGES, type WorkflowStage } from "@/lib/project-spec/workflowLaneLayout";

export type WorkflowDraftSeed = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  stage?: string | null;
  createdAt?: string | Date | number;
  dependsOnIds?: string[] | null;
};

export type WorkflowDraftSynthesized = {
  id: string;
  stage: WorkflowStage;
  dependsOnIds: string[];
  positionX: number;
  positionY: number;
};

/** UI: HIGH→P0 … 실행 Task는 DB에 P0|P1|P2로 저장될 수 있음 */
export function priorityToPLabel(p: string): "P0" | "P1" | "P2" | "P3" {
  const u = String(p ?? "").toUpperCase().trim();
  if (u === "P0" || u === "HIGH") return "P0";
  if (u === "P1" || u === "MEDIUM") return "P1";
  if (u === "P2" || u === "LOW") return "P2";
  return "P3";
}

function inferStageFromText(text: string): WorkflowStage {
  const t = text.toLowerCase();
  if (/(요구|requirement|\[r\])/.test(t)) return "Requirement";
  if (/(설계|design|feature|\[d\]|\[f\])/.test(t)) return "Design";
  return "Development";
}

function priorityWeight(p: string): number {
  const u = String(p ?? "").toUpperCase().trim();
  if (u === "HIGH" || u === "P0") return 0;
  if (u === "MEDIUM" || u === "P1") return 1;
  if (u === "LOW" || u === "P2") return 2;
  return 3;
}

function seedTime(s: WorkflowDraftSeed): number {
  if (s.createdAt == null) return 0;
  const t = new Date(s.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function uniqueStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const v = String(x ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeStageForSeed(s: WorkflowDraftSeed): WorkflowStage {
  const text = `${s.title}\n${s.description ?? ""}`;
  if (s.stage != null && String(s.stage).trim()) {
    return normalizeWorkflowStage(s.stage);
  }
  return inferStageFromText(text);
}

/** depMap[target] = 선행 노드 집합. 방향 엣지: d → target */
function hasDirectedCycle(allIds: string[], depMap: Map<string, Set<string>>): boolean {
  const adj = new Map<string, string[]>();
  for (const id of allIds) adj.set(id, []);
  for (const t of allIds) {
    for (const d of depMap.get(t) ?? []) {
      adj.get(d)!.push(t);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (u: string): boolean => {
    if (visiting.has(u)) return true;
    if (visited.has(u)) return false;
    visiting.add(u);
    for (const v of adj.get(u) ?? []) {
      if (dfs(v)) return true;
    }
    visiting.delete(u);
    visited.add(u);
    return false;
  };
  for (const id of allIds) {
    if (!visited.has(id) && dfs(id)) return true;
  }
  return false;
}

function stripCycles(
  allIds: string[],
  depMap: Map<string, Set<string>>,
  explicitPairs: Set<string>
): void {
  const nonExplicitEdges: Array<{ t: string; d: string }> = [];
  for (const t of allIds) {
    for (const d of depMap.get(t) ?? []) {
      if (!explicitPairs.has(`${t}:${d}`)) {
        nonExplicitEdges.push({ t, d });
      }
    }
  }
  let guard = 0;
  while (hasDirectedCycle(allIds, depMap) && guard++ < 800 && nonExplicitEdges.length > 0) {
    const e = nonExplicitEdges.pop()!;
    depMap.get(e.t)?.delete(e.d);
  }
}

function computeIndegOutdeg(allIds: string[], depMap: Map<string, Set<string>>) {
  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  for (const id of allIds) {
    indeg.set(id, depMap.get(id)?.size ?? 0);
    outdeg.set(id, 0);
  }
  for (const t of allIds) {
    for (const d of depMap.get(t) ?? []) {
      outdeg.set(d, (outdeg.get(d) ?? 0) + 1);
    }
  }
  return { indeg, outdeg };
}

/**
 * 실행 가능한 단일 DAG: 명시 의존 → 스테이지 내 선형 → 스테이지 백본 → 고립 복구 → 순환 제거.
 */
export function synthesizeWorkflowDrafts(seeds: WorkflowDraftSeed[]): WorkflowDraftSynthesized[] {
  if (seeds.length === 0) return [];
  const allIds = new Set(seeds.map((s) => s.id));

  if (seeds.length === 1) {
    const only = seeds[0];
    const stage = normalizeStageForSeed(only);
    return [
      {
        id: only.id,
        stage,
        dependsOnIds: [],
        positionX: LANE_LAYOUT.LEFT_MARGIN,
        positionY: laneBandTopY(stage) + LANE_LAYOUT.V_PAD,
      },
    ];
  }

  const depMap = new Map<string, Set<string>>();
  for (const s of seeds) depMap.set(s.id, new Set());
  const explicitPairs = new Set<string>();

  const addDep = (targetId: string, depId: string, isExplicit: boolean) => {
    if (depId === targetId) return;
    if (!allIds.has(depId) || !allIds.has(targetId)) return;
    depMap.get(targetId)!.add(depId);
    if (isExplicit) explicitPairs.add(`${targetId}:${depId}`);
  };

  // Step 1: explicit dependsOnIds
  for (const s of seeds) {
    for (const d of s.dependsOnIds ?? []) {
      addDep(s.id, d, true);
    }
  }

  const staged = new Map<WorkflowStage, WorkflowDraftSeed[]>();
  for (const s of seeds) {
    const st = normalizeStageForSeed(s);
    const arr = staged.get(st) ?? [];
    arr.push(s);
    staged.set(st, arr);
  }
  for (const st of WORKFLOW_STAGES) {
    const arr = staged.get(st);
    if (!arr) continue;
    arr.sort((a, b) => {
      const pa = priorityWeight(a.priority);
      const pb = priorityWeight(b.priority);
      if (pa !== pb) return pa - pb;
      return seedTime(a) - seedTime(b);
    });
  }

  // Step 3: intra-stage linear
  for (const st of WORKFLOW_STAGES) {
    const arr = staged.get(st);
    if (!arr || arr.length < 2) continue;
    for (let i = 1; i < arr.length; i++) {
      addDep(arr[i].id, arr[i - 1].id, false);
    }
  }

  // Step 2: stage backbone — last(stage N) → first(stage N+1)
  let prevLast: WorkflowDraftSeed | null = null;
  for (const st of WORKFLOW_STAGES) {
    const arr = staged.get(st);
    if (!arr?.length) continue;
    const first = arr[0];
    if (prevLast) {
      addDep(first.id, prevLast.id, false);
    }
    prevLast = arr[arr.length - 1];
  }

  // Step 5: isolated repair (indeg=0 & outdeg=0)
  const globalOrder: WorkflowDraftSeed[] = [];
  for (const st of WORKFLOW_STAGES) {
    const arr = staged.get(st);
    if (arr?.length) globalOrder.push(...arr);
  }

  let { indeg, outdeg } = computeIndegOutdeg([...allIds], depMap);
  for (const s of globalOrder) {
    const id = s.id;
    if ((indeg.get(id) ?? 0) === 0 && (outdeg.get(id) ?? 0) === 0) {
      const idx = globalOrder.findIndex((x) => x.id === id);
      if (idx > 0) {
        addDep(id, globalOrder[idx - 1].id, false);
      } else if (idx === 0 && globalOrder.length > 1) {
        addDep(globalOrder[1].id, id, false);
      }
      const io = computeIndegOutdeg([...allIds], depMap);
      indeg = io.indeg;
      outdeg = io.outdeg;
    }
  }

  stripCycles([...allIds], depMap, explicitPairs);

  const draftRows = seeds.map((s) => ({ id: s.id, stage: normalizeStageForSeed(s) }));
  const laneEdges: Array<{ source: string; target: string }> = [];
  for (const t of allIds) {
    for (const d of depMap.get(t) ?? []) {
      laneEdges.push({ source: d, target: t });
    }
  }
  const posList = computeStageAwareLaneLayout(draftRows, laneEdges);
  const posById = new Map(posList.map((p) => [p.id, p] as const));

  return seeds.map((s) => {
    const st = normalizeStageForSeed(s);
    const p = posById.get(s.id);
    return {
      id: s.id,
      stage: st,
      dependsOnIds: uniqueStrings([...(depMap.get(s.id) ?? [])]),
      positionX: p?.x ?? LANE_LAYOUT.LEFT_MARGIN,
      positionY: p?.y ?? laneBandTopY(st) + LANE_LAYOUT.V_PAD,
    };
  });
}
