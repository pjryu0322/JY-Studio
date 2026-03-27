import dagre from "dagre";

/** TaskDraft Workflow — stage(lane) 좌표계 (캔버스·자동정렬·스냅 공통) */
export const WORKFLOW_STAGES = ["Requirement", "Design", "Development"] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const LANE_LAYOUT = {
  NODE_WIDTH: 280,
  NODE_HEIGHT: 120,
  BAND_HEIGHT: 200,
  LEFT_MARGIN: 48,
  TOP_MARGIN: 24,
  H_GAP: 44,
  V_PAD: 10,
} as const;

export function normalizeWorkflowStage(raw: string | null | undefined): WorkflowStage {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "requirement" || v === "planning" || v === "요구" || v === "기획") return "Requirement";
  if (v === "design" || v === "설계" || v === "review" || v === "feature") return "Design";
  if (v === "development" || v === "build" || v === "개발" || v === "task") return "Development";
  return "Development";
}

export function laneBandTopY(stage: WorkflowStage): number {
  const idx = Math.max(0, WORKFLOW_STAGES.indexOf(stage));
  return LANE_LAYOUT.TOP_MARGIN + idx * LANE_LAYOUT.BAND_HEIGHT;
}

/** 노드 top-left Y: 밴드 안 세로 중앙(단일 행 기준) */
export function snapNodeYToLaneCenter(stage: WorkflowStage): number {
  return laneBandTopY(stage) + (LANE_LAYOUT.BAND_HEIGHT - LANE_LAYOUT.NODE_HEIGHT) / 2;
}

/** 드래그 후 Y를 해당 stage 밴드 안으로만 클램프 (여러 줄 dagre 시 약간의 세로 분산 허용) */
export function clampNodeYToStageBand(y: number, stage: WorkflowStage): number {
  const top = laneBandTopY(stage) + LANE_LAYOUT.V_PAD;
  const bottom = laneBandTopY(stage) + LANE_LAYOUT.BAND_HEIGHT - LANE_LAYOUT.NODE_HEIGHT - LANE_LAYOUT.V_PAD;
  if (bottom <= top) return snapNodeYToLaneCenter(stage);
  return Math.min(bottom, Math.max(top, y));
}

export function totalLaneCanvasHeightPx(): number {
  return LANE_LAYOUT.TOP_MARGIN + WORKFLOW_STAGES.length * LANE_LAYOUT.BAND_HEIGHT + 40;
}

export type LaneLayoutEdge = { source: string; target: string };

/**
 * stage(lane)별로 subgraph에 dagre LR 적용 후, 각 밴드 안에 좌표를 맞춘다.
 * stage 간 edge는 dagre에 넣지 않고, X만 lane 내에서 정렬된다.
 */
export function computeStageAwareLaneLayout(
  drafts: Array<{ id: string; stage: string | null | undefined }>,
  edges: LaneLayoutEdge[]
): Array<{ id: string; x: number; y: number }> {
  const out: Array<{ id: string; x: number; y: number }> = [];

  for (const stage of WORKFLOW_STAGES) {
    const ids = drafts.filter((d) => normalizeWorkflowStage(d.stage) === stage).map((d) => d.id);
    if (ids.length === 0) continue;

    const idSet = new Set(ids);
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 56, align: "UL" });
    for (const id of ids) {
      g.setNode(id, { width: LANE_LAYOUT.NODE_WIDTH, height: LANE_LAYOUT.NODE_HEIGHT });
    }
    for (const e of edges) {
      if (idSet.has(e.source) && idSet.has(e.target)) {
        g.setEdge(e.source, e.target);
      }
    }
    dagre.layout(g);

    let minX = Infinity;
    let minY = Infinity;
    for (const id of ids) {
      const p = g.node(id);
      if (!p) continue;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    }
    if (!isFinite(minX)) minX = 0;
    if (!isFinite(minY)) minY = 0;

    const bandTop = laneBandTopY(stage);
    const bandBottom = bandTop + LANE_LAYOUT.BAND_HEIGHT - LANE_LAYOUT.NODE_HEIGHT;

    for (const id of ids) {
      const p = g.node(id);
      if (!p) {
        const idx = ids.indexOf(id);
        out.push({
          id,
          x: LANE_LAYOUT.LEFT_MARGIN + idx * (LANE_LAYOUT.NODE_WIDTH + LANE_LAYOUT.H_GAP),
          y: Math.min(bandBottom, snapNodeYToLaneCenter(stage)),
        });
        continue;
      }
      const x = LANE_LAYOUT.LEFT_MARGIN + (p.x - minX);
      // dagre node (p.x, p.y) = 중심; lane 밴드 안에서 세로로 정렬
      const yTop = bandTop + LANE_LAYOUT.V_PAD + (p.y - minY);
      const y = Math.min(bandBottom - LANE_LAYOUT.V_PAD, Math.max(bandTop + LANE_LAYOUT.V_PAD, yTop));
      out.push({ id, x, y });
    }
  }
  return out;
}
