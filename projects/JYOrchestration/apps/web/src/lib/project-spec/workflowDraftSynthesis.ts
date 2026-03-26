import {
  LANE_LAYOUT,
  WORKFLOW_STAGES,
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
};

export type WorkflowDraftSynthesized = {
  id: string;
  stage: WorkflowStage;
  dependsOnIds: string[];
  positionX: number;
  positionY: number;
};

function stageIndex(stage: WorkflowStage): number {
  return WORKFLOW_STAGES.indexOf(stage);
}

function inferStageFromText(text: string): WorkflowStage {
  const t = text.toLowerCase();
  if (/(기획|요구사항|설계|planning|scope|요약)/.test(t)) return "Planning";
  if (/(test|qa|검증|테스트|e2e|unit)/.test(t)) return "Test";
  if (/(review|검토|승인|pr|code review)/.test(t)) return "Review";
  if (/(배포|적용|apply|release|rollout)/.test(t)) return "Apply";
  return "Build";
}

function priorityWeight(p: string): number {
  const u = String(p ?? "").toUpperCase().trim();
  if (u === "HIGH") return 0;
  if (u === "MEDIUM") return 1;
  return 2;
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

/**
 * 초기 TaskDraft를 "이해 가능한 실행 흐름"으로 자동 합성한다.
 * - stage/priority 기반 정렬
 * - stage 경계에서 fan-out / fan-in 연결
 * - 고립 노드가 생기지 않도록 기본 DAG 보장
 * - 좌표는 workflowLaneLayout 밴드와 동일 규칙(스윔레인 Y)
 */
export function synthesizeWorkflowDrafts(seeds: WorkflowDraftSeed[]): WorkflowDraftSynthesized[] {
  if (seeds.length === 0) return [];
  if (seeds.length === 1) {
    const only = seeds[0];
    const text = `${only.title}\n${only.description ?? ""}`;
    const stage =
      only.stage != null && String(only.stage).trim()
        ? normalizeWorkflowStage(only.stage)
        : inferStageFromText(text);
    return [
      {
        id: only.id,
        stage,
        dependsOnIds: [],
        positionX: LANE_LAYOUT.LEFT_MARGIN,
        positionY: snapYInBand(stage, 0),
      },
    ];
  }

  const rows = seeds.map((s, idx) => {
    const text = `${s.title}\n${s.description ?? ""}`;
    const guessed = inferStageFromText(text);
    const stage =
      s.stage != null && String(s.stage).trim() ? normalizeWorkflowStage(s.stage) : guessed;
    return { ...s, _idx: idx, stage };
  });

  rows.sort((a, b) => {
    const sa = stageIndex(a.stage);
    const sb = stageIndex(b.stage);
    if (sa !== sb) return sa - sb;
    const pa = priorityWeight(a.priority);
    const pb = priorityWeight(b.priority);
    if (pa !== pb) return pa - pb;
    return a._idx - b._idx;
  });

  const deps = new Map<string, string[]>();
  for (const r of rows) deps.set(r.id, []);

  let prevStage: WorkflowStage | null = null;
  let prevStageIds: string[] = [];
  let currentStageIds: string[] = [];

  const flushStageBoundary = () => {
    if (prevStageIds.length === 0 || currentStageIds.length === 0) return;
    for (const id of currentStageIds) {
      deps.set(id, uniqueStrings([...(deps.get(id) ?? []), ...prevStageIds]));
    }
  };

  for (const r of rows) {
    if (prevStage === null) {
      prevStage = r.stage;
      currentStageIds.push(r.id);
      continue;
    }
    if (r.stage !== prevStage) {
      flushStageBoundary();
      prevStageIds = [...currentStageIds];
      currentStageIds = [r.id];
      prevStage = r.stage;
    } else {
      currentStageIds.push(r.id);
    }
  }
  flushStageBoundary();

  const hasAnyEdge = [...deps.values()].some((a) => a.length > 0);
  if (!hasAnyEdge) {
    for (let i = 1; i < rows.length; i++) {
      deps.set(rows[i].id, [rows[i - 1].id]);
    }
  }

  const laneCounter = new Map<WorkflowStage, number>();
  const X_GAP = 320;

  function snapYInBand(stage: WorkflowStage, localIndex: number): number {
    const top = laneBandTopY(stage) + LANE_LAYOUT.V_PAD;
    const step = LANE_LAYOUT.NODE_HEIGHT + 20;
    const y = top + localIndex * step;
    const maxY = laneBandTopY(stage) + LANE_LAYOUT.BAND_HEIGHT - LANE_LAYOUT.NODE_HEIGHT - LANE_LAYOUT.V_PAD;
    return Math.min(maxY, y);
  }

  return rows.map((r) => {
    const stage = r.stage;
    const local = laneCounter.get(stage) ?? 0;
    laneCounter.set(stage, local + 1);
    const d = uniqueStrings((deps.get(r.id) ?? []).filter((x) => x !== r.id));
    const depth = d.length === 0 ? 0 : 1;
    return {
      id: r.id,
      stage,
      dependsOnIds: d,
      positionX: LANE_LAYOUT.LEFT_MARGIN + depth * X_GAP,
      positionY: snapYInBand(stage, local),
    };
  });
}
