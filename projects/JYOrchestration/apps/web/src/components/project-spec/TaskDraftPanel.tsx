"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchProjectTaskDrafts,
  patchProjectTaskDraft,
  postProjectTaskDraftsAiReorder,
  postProjectTaskDraftsConfirm,
  postProjectTaskDraftsGenerate,
} from "@/components/project-spec/api";
import { formatTestedAt } from "@/components/project-spec/format";
import { TaskDraftWorkflowNode } from "@/components/project-spec/TaskDraftWorkflowNode";
import type { TaskDraftDto, TaskDraftSyncResultDto } from "@/components/project-spec/types";
import { LabelTag } from "@/components/ui/LabelTag";
import type { SpecWorkspaceAiModelId } from "@/lib/project-spec/specWorkspaceModels";
import { priorityToPLabel, synthesizeWorkflowDrafts } from "@/lib/project-spec/workflowDraftSynthesis";
import {
  WORKFLOW_STAGES,
  LANE_LAYOUT,
  laneBandTopY,
  totalLaneCanvasHeightPx,
  computeStageAwareLaneLayout,
  clampNodeYToStageBand,
  normalizeWorkflowStage,
} from "@/lib/project-spec/workflowLaneLayout";
import { nodeTypeFromTitle, nodeTypeLabel, stageForNodeType, type TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";
import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "reactflow";

import "reactflow/dist/style.css";

const SWIMLANE_BAND_COLORS = [
  "rgba(2,132,199,0.055)",
  "rgba(99,102,241,0.05)",
  "rgba(16,185,129,0.05)",
  "rgba(245,158,11,0.045)",
  "rgba(239,68,68,0.04)",
];

/** 데이터 로드 후 캔버스가 전체 흐름을 담도록 fitView */
function CanvasFitView({ revision }: { revision: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (revision <= 0) return;
    const t = window.setTimeout(() => {
      fitView({ padding: 0.2, duration: 320, maxZoom: 1.15, minZoom: 0.15 });
    }, 60);
    return () => clearTimeout(t);
  }, [revision, fitView]);
  return null;
}

/** viewport transform과 동일 — 스윔레인이 노드·엣지와 함께 패닝/줌됨 */
function SwimlaneBands() {
  const transform = useStore((s) => s.transform);
  const [tx, ty, zoom] = transform;
  const width = 9600;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {WORKFLOW_STAGES.map((stage, i) => (
          <div
            key={stage}
            style={{
              position: "absolute",
              left: 0,
              top: laneBandTopY(stage),
              width,
              height: LANE_LAYOUT.BAND_HEIGHT,
              background: SWIMLANE_BAND_COLORS[i] ?? SWIMLANE_BAND_COLORS[0],
              borderBottom: "1px solid #e2e8f0",
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 12,
                top: 8,
                fontSize: 12,
                fontWeight: 800,
                color: "#64748b",
                letterSpacing: "0.02em",
              }}
            >
              {stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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

const EXECUTION_KIND_FILTERS = ["api", "logic", "ui", "infra", "test"] as const;
type ExecutionKindFilter = (typeof EXECUTION_KIND_FILTERS)[number];

function featureParentDraftId(d: TaskDraftDto, allById: Map<string, TaskDraftDto>): string | null {
  for (const id of d.dependsOnIds ?? []) {
    const p = allById.get(id);
    const nt = (p?.nodeType ?? nodeTypeFromTitle(p?.title ?? "")) as TaskNodeType;
    if (nt === "feature") return id;
  }
  return null;
}

function StageBoardTaskCard(params: {
  d: TaskDraftDto;
  rows: TaskDraftDto[];
  workflowStatusById: Map<string, "CONFIRMED" | "READY" | "BLOCKED" | "INVALID">;
  hierarchyHighlightIds: Set<string>;
  canEdit: boolean;
  onOpen: (d: TaskDraftDto) => void;
  onMoveInStage: (draftId: string, direction: "up" | "down") => void;
}) {
  const { d, rows, workflowStatusById, hierarchyHighlightIds, canEdit, onOpen, onMoveInStage } = params;
  const idx = rows.findIndex((x) => x.id === d.id);
  const ws = workflowStatusById.get(d.id) ?? "BLOCKED";
  const opacity = ws === "BLOCKED" ? 0.55 : ws === "INVALID" ? 0.55 : 1;
  const nodeType = (d.nodeType ?? nodeTypeFromTitle(d.title)) as TaskNodeType;
  const highlighted = hierarchyHighlightIds.has(d.id);
  const typeColor =
    nodeType === "requirement"
      ? "#2563eb"
      : nodeType === "design"
        ? "#7c3aed"
        : nodeType === "feature"
          ? "#16a34a"
          : "#6b7280";
  const typeBg =
    nodeType === "requirement"
      ? "#dbeafe"
      : nodeType === "design"
        ? "#ede9fe"
        : nodeType === "feature"
          ? "#dcfce7"
          : "#f1f5f9";
  const icon = ws === "CONFIRMED" ? "✓" : ws === "READY" ? "●" : ws === "INVALID" ? "!" : "○";
  const ek = String(d.executionKind ?? "").toLowerCase();
  const edgeW = highlighted ? "2px" : "1px";
  const edgeC = highlighted ? "#0f766e" : "#e2e8f0";
  return (
    <button
      type="button"
      onClick={() => onOpen(d)}
      style={{
        textAlign: "left",
        width: "100%",
        borderRadius: 10,
        borderTop: `${edgeW} solid ${edgeC}`,
        borderRight: `${edgeW} solid ${edgeC}`,
        borderBottom: `${edgeW} solid ${edgeC}`,
        borderLeft: `4px solid ${typeColor}`,
        background: highlighted ? "#f0fdfa" : "#fff",
        boxShadow: highlighted ? "0 2px 12px rgba(13,148,136,0.10)" : "none",
        padding: 10,
        cursor: "pointer",
        opacity,
      }}
    >
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>{d.title}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span
            aria-hidden
            style={{
              fontSize: 10,
              fontWeight: 900,
              padding: "2px 7px",
              borderRadius: 999,
              background: typeBg,
              color: typeColor,
              border: `1px solid ${typeColor}55`,
            }}
          >
            {nodeTypeLabel(nodeType)}
          </span>
          {nodeType === "task" && ek && EXECUTION_KIND_FILTERS.includes(ek as ExecutionKindFilter) ? (
            <span
              aria-hidden
              style={{
                fontSize: 10,
                fontWeight: 900,
                padding: "2px 7px",
                borderRadius: 999,
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
                textTransform: "uppercase",
              }}
            >
              {ek}
            </span>
          ) : null}
          <span aria-hidden style={{ color: typeColor, fontWeight: 900, fontSize: 12 }}>
            {icon}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 900, color: typeColor }}>
        {priorityToPLabel(d.priority)}
      </div>
      {d.taskInput?.trim() || d.taskOutput?.trim() ? (
        <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
          {d.taskInput?.trim() ? (
            <div>
              <span style={{ fontWeight: 800 }}>In:</span> {d.taskInput.trim().slice(0, 100)}
              {d.taskInput.trim().length > 100 ? "…" : ""}
            </div>
          ) : null}
          {d.taskOutput?.trim() ? (
            <div style={{ marginTop: 2 }}>
              <span style={{ fontWeight: 800 }}>Out:</span> {d.taskOutput.trim().slice(0, 100)}
              {d.taskOutput.trim().length > 100 ? "…" : ""}
            </div>
          ) : null}
        </div>
      ) : null}
      {d.description?.trim() ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
          {d.description.trim().slice(0, 120)}
          {d.description.trim().length > 120 ? "…" : ""}
        </div>
      ) : null}
      {canEdit ? (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              void onMoveInStage(d.id, "up");
            }}
            style={{ fontSize: 11, color: "#64748b", cursor: idx <= 0 ? "default" : "pointer", opacity: idx <= 0 ? 0.35 : 1 }}
          >
            ↑
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              void onMoveInStage(d.id, "down");
            }}
            style={{
              fontSize: 11,
              color: "#64748b",
              cursor: idx < 0 || idx >= rows.length - 1 ? "default" : "pointer",
              opacity: idx < 0 || idx >= rows.length - 1 ? 0.35 : 1,
            }}
          >
            ↓
          </span>
        </div>
      ) : null}
    </button>
  );
}

const EXECUTION_STAGE_ORDER = ["Requirement", "Design", "Development"] as const;
type ExecutionStage = (typeof EXECUTION_STAGE_ORDER)[number];

function stageLabel(stage: ExecutionStage): string {
  const labels: Record<ExecutionStage, string> = {
    Requirement: "요구",
    Design: "설계",
    Development: "개발",
  };
  return labels[stage];
}

function toExecutionStage(raw: string | null | undefined): ExecutionStage | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "requirement" || v === "요구" || v === "planning") return "Requirement";
  if (v === "design" || v === "설계" || v === "feature") return "Design";
  if (v === "development" || v === "개발" || v === "build" || v === "task") return "Development";
  return null;
}

type CycleHit = { edge: { source: string; target: string }; cyclePath: string[] } | null;

function detectCycle(nodes: string[], depsById: Map<string, string[]>): CycleHit {
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
        // id -> dep creates a back edge (cycle)
        const path: string[] = [dep];
        let cur: string | null = id;
        while (cur && cur !== dep) {
          path.push(cur);
          cur = parent.get(cur) ?? null;
        }
        path.push(dep);
        path.reverse();
        return { edge: { source: dep, target: id }, cyclePath: path };
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

function computeExecutionLevels(input: {
  draftIds: string[];
  depsById: Map<string, string[]>;
  confirmedIds: Set<string>;
}): string[][] {
  const { draftIds, depsById, confirmedIds } = input;
  const indeg = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const id of draftIds) {
    indeg.set(id, 0);
    out.set(id, []);
  }

  for (const id of draftIds) {
    const deps = depsById.get(id) ?? [];
    for (const dep of deps) {
      // CONFIRMED는 이미 충족된 것으로 보고 indegree에 포함하지 않는다
      if (confirmedIds.has(dep)) continue;
      if (!indeg.has(dep)) continue;
      indeg.set(id, (indeg.get(id) ?? 0) + 1);
      out.get(dep)!.push(id);
    }
  }

  const levels: string[][] = [];
  let cur = draftIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const seen = new Set<string>();
  while (cur.length > 0) {
    levels.push(cur);
    const next: string[] = [];
    for (const id of cur) {
      seen.add(id);
      for (const to of out.get(id) ?? []) {
        indeg.set(to, (indeg.get(to) ?? 0) - 1);
        if ((indeg.get(to) ?? 0) === 0) next.push(to);
      }
    }
    cur = next.filter((id) => !seen.has(id));
  }
  return levels;
}

type TaskDraftPanelProps = {
  projectId: string;
  canEdit: boolean;
  selectedModel: SpecWorkspaceAiModelId;
  currentSpecVersionId: string | null;
  refreshKey: number;
  lastAutoSync: TaskDraftSyncResultDto | null;
};

export function TaskDraftPanel({
  projectId,
  canEdit,
  selectedModel,
  refreshKey,
  lastAutoSync,
}: TaskDraftPanelProps) {
  const [drafts, setDrafts] = useState<TaskDraftDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskDraftDto | null>(null);
  const [editNodeType, setEditNodeType] = useState<TaskNodeType>("task");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editCriteria, setEditCriteria] = useState("");
  const [editTaskInput, setEditTaskInput] = useState("");
  const [editTaskOutput, setEditTaskOutput] = useState("");
  const [editEstimatedSize, setEditEstimatedSize] = useState("");
  const [editExecutionKind, setEditExecutionKind] = useState("");
  const savingPositionsRef = useRef(new Map<string, number>());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [executionPreviewOpen, setExecutionPreviewOpen] = useState(false);
  const [childrenCollapsed, setChildrenCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<"stage" | "graph">("stage");
  const autoWireRanRef = useRef(false);
  const initialCanvasFitRef = useRef(false);
  const [canvasFitRevision, setCanvasFitRevision] = useState(0);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [executionKindFilter, setExecutionKindFilter] = useState<"" | ExecutionKindFilter>("");
  const [collapsedFeatureIds, setCollapsedFeatureIds] = useState<Set<string>>(() => new Set());
  const [aiSuggestion, setAiSuggestion] = useState<
    | null
    | {
        cycleDetected: boolean;
        tasks: Array<{ id: string; dependsOnIds?: string[]; positionX: number; positionY: number }>;
        model: string;
        reason: string;
        parallelGroups: string[][];
        cycleProblemEdge?: { source: string; target: string } | null;
        cycleCandidateEdges?: Array<{ source: string; target: string }>;
      }
  >(null);

  const loadDrafts = useCallback(
    async (opts?: { clearMessage?: boolean }) => {
      if (!projectId) {
        return;
      }
      const clearMessage = opts?.clearMessage !== false;
      if (clearMessage) setMessage(null);
      setLoading(true);
      try {
        const { res, json } = await fetchProjectTaskDrafts(projectId);
        if (!res.ok || !json.success || !json.data) {
          setMessage(json.message || "Task 초안을 불러오지 못했습니다.");
          setDrafts([]);
          return;
        }
        setDrafts(json.data);
      } catch (e) {
        console.error(e);
        setMessage("Task 초안 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts, refreshKey]);

  useEffect(() => {
    autoWireRanRef.current = false;
    initialCanvasFitRef.current = false;
  }, [projectId]);

  const byId = useMemo(() => {
    const m = new Map<string, TaskDraftDto>();
    for (const d of drafts) m.set(d.id, d);
    return m;
  }, [drafts]);

  const draftsForView = useMemo(() => {
    if (!executionKindFilter) return drafts;
    const f = executionKindFilter.toLowerCase();
    return drafts.filter((d) => {
      const nt = d.nodeType ?? nodeTypeFromTitle(d.title);
      if (nt !== "task") return true;
      return String(d.executionKind ?? "").toLowerCase() === f;
    });
  }, [drafts, executionKindFilter]);

  const visibleDraftIdSet = useMemo(() => new Set(draftsForView.map((d) => d.id)), [draftsForView]);

  const confirmedIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of drafts) {
      if (d.status === "CONFIRMED") s.add(d.id);
    }
    return s;
  }, [drafts]);

  const depsById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of drafts) {
      m.set(d.id, uniqueStrings(d.dependsOnIds ?? []).filter((x) => x !== d.id));
    }
    return m;
  }, [drafts]);

  /** SUPERSEDED 등은 그래프 검증에서 제외 — 끊긴 참조로 확정 플로우가 막히지 않게 함 */
  const validationScopeDrafts = useMemo(
    () => drafts.filter((d) => d.status === "DRAFT" || d.status === "CONFIRMED"),
    [drafts]
  );

  const validation = useMemo(() => {
    const byVal = new Map(validationScopeDrafts.map((d) => [d.id, d] as const));
    const depsVal = new Map<string, string[]>();
    for (const d of validationScopeDrafts) {
      depsVal.set(d.id, uniqueStrings(d.dependsOnIds ?? []).filter((x) => x !== d.id));
    }
    const allIds = validationScopeDrafts.map((d) => d.id);
    const missingDepEdges: Array<{ targetId: string; missingId: string }> = [];
    for (const d of validationScopeDrafts) {
      for (const dep of depsVal.get(d.id) ?? []) {
        if (!byVal.has(dep)) {
          missingDepEdges.push({ targetId: d.id, missingId: dep });
        }
      }
    }
    const cycle = detectCycle(allIds, depsVal);

    const incomingCount = new Map<string, number>();
    const outgoingCount = new Map<string, number>();
    for (const id of allIds) {
      incomingCount.set(id, 0);
      outgoingCount.set(id, 0);
    }
    for (const d of validationScopeDrafts) {
      const deps = depsVal.get(d.id) ?? [];
      outgoingCount.set(d.id, deps.length);
      for (const dep of deps) {
        incomingCount.set(dep, (incomingCount.get(dep) ?? 0) + 1);
      }
    }
    const startIds = allIds.filter((id) => (outgoingCount.get(id) ?? 0) === 0);
    const terminalIds = allIds.filter((id) => (incomingCount.get(id) ?? 0) === 0);
    const isolatedIds = allIds.filter(
      (id) => (incomingCount.get(id) ?? 0) === 0 && (outgoingCount.get(id) ?? 0) === 0
    );

    return {
      ok: !cycle && missingDepEdges.length === 0,
      cycle,
      missingDepEdges,
      startIds,
      terminalIds,
      isolatedIds,
    };
  }, [validationScopeDrafts]);

  const shouldAutoWire = useMemo(() => {
    if (autoWireRanRef.current) return false;
    const draftOnly = drafts.filter((d) => d.status === "DRAFT");
    if (draftOnly.length < 2) return false;
    const allEmpty = draftOnly.every((d) => (d.dependsOnIds ?? []).length === 0);
    if (allEmpty) return true;
    const draftIds = new Set(draftOnly.map((d) => d.id));
    let draftDraftEdgeCount = 0;
    for (const d of draftOnly) {
      for (const dep of d.dependsOnIds ?? []) {
        if (draftIds.has(dep)) draftDraftEdgeCount++;
      }
    }
    const isolatedDraftCount = validation.isolatedIds.filter((id) => byId.get(id)?.status === "DRAFT").length;
    if (draftDraftEdgeCount === 0) return true;
    if (isolatedDraftCount >= 2) return true;
    return false;
  }, [byId, drafts, validation.isolatedIds]);

  const needsDefaultFlowCta = useMemo(() => {
    if (!canEdit) return false;
    const draftOnly = drafts.filter((d) => d.status === "DRAFT");
    if (draftOnly.length < 2) return false;
    const draftIds = new Set(draftOnly.map((d) => d.id));
    let draftDraftEdgeCount = 0;
    for (const d of draftOnly) {
      for (const dep of d.dependsOnIds ?? []) {
        if (draftIds.has(dep)) draftDraftEdgeCount++;
      }
    }
    const isolatedDraftCount = validation.isolatedIds.filter((id) => byId.get(id)?.status === "DRAFT").length;
    return isolatedDraftCount >= 2 || draftDraftEdgeCount === 0;
  }, [byId, canEdit, drafts, validation.isolatedIds]);

  const executableDraftCount = useMemo(() => {
    return drafts.filter((d) => {
      if (d.status !== "DRAFT") return false;
      const t = (d.nodeType ?? nodeTypeFromTitle(d.title)) as TaskNodeType;
      return t === "task";
    }).length;
  }, [drafts]);

  const showDefaultFlowCta = useMemo(() => {
    if (!canEdit || !needsDefaultFlowCta) return false;
    if (shouldAutoWire) return false;
    return true;
  }, [canEdit, needsDefaultFlowCta, shouldAutoWire]);

  const persistSynthesizedDrafts = useCallback(
    async (draftOnly: TaskDraftDto[], synthesized: ReturnType<typeof synthesizeWorkflowDrafts>) => {
      const synById = new Map(synthesized.map((x) => [x.id, x] as const));
      for (const d of draftOnly) {
        const s = synById.get(d.id);
        if (!s) continue;
        await patchProjectTaskDraft(projectId, d.id, {
          dependsOnIds: s.dependsOnIds,
          positionX: s.positionX,
          positionY: s.positionY,
          stage: s.stage,
          dependsOn: [],
        });
      }
    },
    [projectId]
  );

  const runSynthesizeDefaultFlow = useCallback(async () => {
    if (!projectId || !canEdit) return;
    const draftOnly = drafts.filter((d) => d.status === "DRAFT");
    if (draftOnly.length < 2) return;
    setBusy("auto-wire");
    try {
      const synthesized = synthesizeWorkflowDrafts(
        draftOnly.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          priority: d.priority,
          stage: d.stage,
          createdAt: d.createdAt,
          dependsOnIds: d.dependsOnIds,
        }))
      );
      await persistSynthesizedDrafts(draftOnly, synthesized);
      await loadDrafts({ clearMessage: false });
      setMessage("기본 워크플로를 적용했습니다.");
      setCanvasFitRevision((x) => x + 1);
    } catch (e) {
      console.error(e);
      setMessage("기본 워크플로를 구성하는 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }, [canEdit, drafts, loadDrafts, persistSynthesizedDrafts, projectId]);

  useEffect(() => {
    if (!canEdit || !projectId) return;
    if (!shouldAutoWire) return;
    autoWireRanRef.current = true;
    void runSynthesizeDefaultFlow();
  }, [canEdit, projectId, runSynthesizeDefaultFlow, shouldAutoWire]);

  useEffect(() => {
    if (loading || drafts.length === 0) return;
    if (initialCanvasFitRef.current) return;
    initialCanvasFitRef.current = true;
    setCanvasFitRevision((x) => x + 1);
  }, [drafts.length, loading]);

  const workflowStatusById = useMemo(() => {
    const m = new Map<string, "CONFIRMED" | "READY" | "BLOCKED" | "INVALID">();
    for (const d of drafts) {
      if (d.status === "CONFIRMED") {
        m.set(d.id, "CONFIRMED");
        continue;
      }
      const deps = depsById.get(d.id) ?? [];
      const hasMissing = deps.some((x) => !byId.has(x));
      if (hasMissing) {
        m.set(d.id, "INVALID");
        continue;
      }
      const ready = deps.length === 0 || deps.every((x) => confirmedIds.has(x));
      m.set(d.id, ready ? "READY" : "BLOCKED");
    }
    return m;
  }, [byId, confirmedIds, depsById, drafts]);

  const executionLevels = useMemo(() => {
    const draftIds = drafts.filter((d) => d.status === "DRAFT").map((d) => d.id);
    return computeExecutionLevels({ draftIds, depsById, confirmedIds });
  }, [confirmedIds, depsById, drafts]);

  const inferredStageByDraftId = useMemo(() => {
    const m = new Map<string, ExecutionStage>();
    for (let i = 0; i < executionLevels.length; i++) {
      const stage = EXECUTION_STAGE_ORDER[Math.min(i, EXECUTION_STAGE_ORDER.length - 1)];
      for (const draftId of executionLevels[i] ?? []) {
        m.set(draftId, stage);
      }
    }
    return m;
  }, [executionLevels]);

  const groupedByExecutionStage = useMemo(() => {
    const groups = new Map<ExecutionStage, TaskDraftDto[]>();
    for (const s of EXECUTION_STAGE_ORDER) groups.set(s, []);
    for (const d of drafts) {
      const explicit = toExecutionStage(d.stage);
      const inferred = inferredStageByDraftId.get(d.id);
      const st = explicit ?? inferred ?? "Development";
      groups.get(st)!.push(d);
    }
    for (const s of EXECUTION_STAGE_ORDER) {
      groups.get(s)!.sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === "CONFIRMED") return -1;
          if (b.status === "CONFIRMED") return 1;
        }
        const px = (a.positionX ?? 0) - (b.positionX ?? 0);
        if (px !== 0) return px;
        return a.createdAt.localeCompare(b.createdAt);
      });
    }
    return groups;
  }, [drafts, inferredStageByDraftId]);

  const groupedByExecutionStageView = useMemo(() => {
    const groups = new Map<ExecutionStage, TaskDraftDto[]>();
    for (const s of EXECUTION_STAGE_ORDER) groups.set(s, []);
    for (const d of drafts) {
      if (!visibleDraftIdSet.has(d.id)) continue;
      const explicit = toExecutionStage(d.stage);
      const inferred = inferredStageByDraftId.get(d.id);
      const st = explicit ?? inferred ?? "Development";
      groups.get(st)!.push(d);
    }
    for (const s of EXECUTION_STAGE_ORDER) {
      groups.get(s)!.sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === "CONFIRMED") return -1;
          if (b.status === "CONFIRMED") return 1;
        }
        const px = (a.positionX ?? 0) - (b.positionX ?? 0);
        if (px !== 0) return px;
        return a.createdAt.localeCompare(b.createdAt);
      });
    }
    return groups;
  }, [drafts, inferredStageByDraftId, visibleDraftIdSet]);

  const flowPathText = useMemo(() => EXECUTION_STAGE_ORDER.map(stageLabel).join(" → "), []);

  const activeStage = useMemo(() => {
    for (const st of EXECUTION_STAGE_ORDER) {
      const rows = groupedByExecutionStage.get(st) ?? [];
      if (rows.some((d) => d.status !== "CONFIRMED")) return st;
    }
    return EXECUTION_STAGE_ORDER[EXECUTION_STAGE_ORDER.length - 1];
  }, [groupedByExecutionStage]);

  const detailBlockingDrafts = useMemo(() => {
    if (!editing) return [];
    return drafts.filter((d) => (d.dependsOnIds ?? []).includes(editing.id));
  }, [drafts, editing]);

  const nodeTypes = useMemo<NodeTypes>(() => ({ taskDraftNode: TaskDraftWorkflowNode }), []);

  const hierarchyHighlightIds = useMemo(() => {
    if (!editing) return new Set<string>();
    const hit = new Set<string>([editing.id]);
    const stack = [editing.id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const dep of depsById.get(id) ?? []) {
        if (!hit.has(dep)) {
          hit.add(dep);
          stack.push(dep);
        }
      }
      for (const d of drafts) {
        if ((d.dependsOnIds ?? []).includes(id) && !hit.has(d.id)) {
          hit.add(d.id);
          stack.push(d.id);
        }
      }
    }
    return hit;
  }, [depsById, drafts, editing]);

  const nodes: Node[] = useMemo(() => {
    return draftsForView.map((d) => {
      const nodeType = d.nodeType ?? nodeTypeFromTitle(d.title);
      const ws = workflowStatusById.get(d.id) ?? "BLOCKED";
      const visualState =
        ws === "CONFIRMED"
          ? "confirmed"
          : ws === "INVALID"
            ? "invalid"
            : ws === "BLOCKED"
              ? "blocked"
              : "ready";
      return {
        id: d.id,
        type: "taskDraftNode",
        position: { x: d.positionX ?? 0, y: d.positionY ?? 0 },
        data: {
          title: d.title,
          nodeType,
          priority: d.priority,
          executionKind: d.executionKind ?? null,
          highlighted: hierarchyHighlightIds.has(d.id),
          visualState,
        },
      };
    });
  }, [draftsForView, workflowStatusById, hierarchyHighlightIds]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const d of draftsForView) {
      for (const depId of d.dependsOnIds ?? []) {
        if (!byId.has(depId) || !visibleDraftIdSet.has(depId)) continue;
        const id = `${depId}__to__${d.id}`;
        out.push({
          id,
          source: depId,
          target: d.id,
          type: "smoothstep",
          style: { stroke: "#64748b", strokeWidth: 2 },
        });
      }
    }
    return out;
  }, [byId, draftsForView, visibleDraftIdSet]);

  async function handleMoveInStage(draftId: string, direction: "up" | "down") {
    if (!canEdit) return;
    const target = byId.get(draftId);
    if (!target) return;
    const stage = toExecutionStage(target.stage) ?? inferredStageByDraftId.get(draftId) ?? "Development";
    const rows = [...(groupedByExecutionStage.get(stage) ?? [])];
    const idx = rows.findIndex((d) => d.id === draftId);
    if (idx < 0) return;
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= rows.length) return;
    const a = rows[idx];
    const b = rows[nextIdx];
    setBusy("reorder");
    setMessage(null);
    try {
      await patchProjectTaskDraft(projectId, a.id, { positionX: b.positionX ?? 0 });
      await patchProjectTaskDraft(projectId, b.id, { positionX: a.positionX ?? 0 });
      await loadDrafts({ clearMessage: false });
    } catch (e) {
      console.error(e);
      setMessage("순서 변경 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRegenerate() {
    if (!projectId || !canEdit) {
      return;
    }
    setBusy("regen");
    setMessage(null);
    try {
      const { res, json } = await postProjectTaskDraftsGenerate(projectId, {
        model: selectedModel,
        mode: "regenerate",
      });
      if (!res.ok || !json.success) {
        setMessage(json.message || "Task 초안 재생성에 실패했습니다.");
        return;
      }
      setMessage(json.message ?? null);
      await loadDrafts({ clearMessage: false });
      setCanvasFitRevision((x) => x + 1);
    } catch (e) {
      console.error(e);
      setMessage("Task 초안 재생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirmAll() {
    if (!projectId || !canEdit || executableDraftCount === 0) {
      return;
    }
    if (!validation.ok) {
      setMessage("워크플로우가 유효하지 않아 확정할 수 없습니다. (순환/누락 의존성 확인)");
      return;
    }
    setConfirmModalOpen(true);
    return;
  }

  async function runConfirmAll() {
    if (!projectId || !canEdit || executableDraftCount === 0) return;
    setBusy("confirm-all");
    setMessage(null);
    try {
      const { res, json } = await postProjectTaskDraftsConfirm(projectId, { confirmAll: true });
      if (!res.ok || !json.success) {
        setMessage(json.message || "전체 확정에 실패했습니다.");
        return;
      }
      setMessage(json.message || "전체 확정했습니다.");
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("전체 확정 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirmOne(draftId: string) {
    if (!projectId || !canEdit) {
      return;
    }
    const row = byId.get(draftId);
    const t = (row?.nodeType ?? nodeTypeFromTitle(row?.title ?? "")) as TaskNodeType;
    if (t !== "task") {
      setMessage("Task 노드만 확정→Task 할 수 있습니다.");
      return;
    }
    if (!validation.ok) {
      setMessage("워크플로우가 유효하지 않아 확정할 수 없습니다. (순환/누락 의존성 확인)");
      return;
    }
    setBusy(`confirm-${draftId}`);
    setMessage(null);
    try {
      const { res, json } = await postProjectTaskDraftsConfirm(projectId, { draftIds: [draftId] });
      if (!res.ok || !json.success) {
        setMessage(json.message || "확정에 실패했습니다.");
        return;
      }
      setMessage(json.message || "확정했습니다.");
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("확정 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  function openEdit(d: TaskDraftDto) {
    setEditing(d);
    setEditNodeType(d.nodeType ?? nodeTypeFromTitle(d.title));
    setChildrenCollapsed(false);
    setEditTitle(d.title);
    setEditDescription(d.description ?? "");
    setEditPriority(d.priority);
    setEditCriteria((d.acceptanceCriteria ?? []).join("\n"));
    setEditTaskInput(d.taskInput ?? "");
    setEditTaskOutput(d.taskOutput ?? "");
    setEditEstimatedSize(d.estimatedSize ?? "");
    setEditExecutionKind(d.executionKind ?? "");
  }

  async function saveEdit() {
    if (!projectId || !canEdit || !editing) {
      return;
    }
    const criteria = editCriteria
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy("save-edit");
    setMessage(null);
    try {
      const patch: Parameters<typeof patchProjectTaskDraft>[2] = {
        title: editTitle.trim(),
        nodeType: editNodeType,
        description: editDescription.trim() || null,
        priority: editPriority,
        acceptanceCriteria: criteria,
        stage: stageForNodeType(editNodeType),
      };
      if (editNodeType === "task") {
        patch.taskInput = editTaskInput.trim() || null;
        patch.taskOutput = editTaskOutput.trim() || null;
        const es = editEstimatedSize.toUpperCase().trim();
        patch.estimatedSize = es === "S" || es === "M" || es === "L" ? es : null;
        const ek = editExecutionKind.toLowerCase().trim();
        patch.executionKind = EXECUTION_KIND_FILTERS.includes(ek as ExecutionKindFilter) ? ek : null;
      }
      const { res, json } = await patchProjectTaskDraft(projectId, editing.id, patch);
      if (!res.ok || !json.success) {
        setMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      setMessage("초안을 저장했습니다.");
      setEditing(null);
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function persistDependsOnIds(targetId: string, nextDependsOnIds: string[]) {
    const titleById = new Map<string, string>();
    for (const d of drafts) titleById.set(d.id, d.title);
    const dependsOnTitles = nextDependsOnIds.map((id) => titleById.get(id) ?? "").filter(Boolean);
    await patchProjectTaskDraft(projectId, targetId, {
      dependsOnIds: nextDependsOnIds,
      dependsOn: dependsOnTitles,
    });
  }

  async function handleConnect(conn: Connection) {
    if (!canEdit || !conn.source || !conn.target) return;
    const target = byId.get(conn.target);
    if (!target) return;
    const source = byId.get(conn.source);
    const sourceType = (source?.nodeType ?? nodeTypeFromTitle(source?.title ?? "")) as TaskNodeType;
    const targetType = (target.nodeType ?? nodeTypeFromTitle(target.title)) as TaskNodeType;

    // 계층을 건너뛰는 연결은 금지 (Requirement→Design→Feature→Task)
    const allowed =
      (sourceType === "requirement" && targetType === "design") ||
      (sourceType === "design" && targetType === "feature") ||
      (sourceType === "feature" && targetType === "task") ||
      (sourceType === "task" && targetType === "task");
    if (!allowed) {
      setMessage(
        "허용: 요구→설계→기능→Task, 또는 Task→Task(같은 개발 단계 내 선행 관계)만 연결할 수 있습니다."
      );
      return;
    }

    const cur = Array.isArray(target.dependsOnIds) ? target.dependsOnIds : [];
    const next = uniqueStrings([...cur, conn.source]).filter((x) => x !== conn.target);
    // cycle 검증
    const nextDepsById = new Map(depsById);
    nextDepsById.set(conn.target, next);
    const cycle = detectCycle(drafts.map((d) => d.id), nextDepsById);
    if (cycle) {
      setMessage(`순환 의존성이 생겨 연결을 만들 수 없습니다. (${cycle.cyclePath.slice(0, 6).join(" → ")})`);
      return;
    }
    setBusy("edge");
    setMessage(null);
    try {
      await persistDependsOnIds(conn.target, next);
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("연결 생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteEdge(edge: Edge) {
    if (!canEdit) return;
    const target = byId.get(edge.target);
    if (!target) return;
    const cur = Array.isArray(target.dependsOnIds) ? target.dependsOnIds : [];
    const next = cur.filter((x) => x !== edge.source);
    setBusy("edge-del");
    setMessage(null);
    try {
      await persistDependsOnIds(edge.target, next);
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("연결 삭제 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleNodeDragStop(node: Node) {
    if (!canEdit) return;
    const now = Date.now();
    const last = savingPositionsRef.current.get(node.id) ?? 0;
    if (now - last < 250) return;
    savingPositionsRef.current.set(node.id, now);
    const draft = byId.get(node.id);
    const stage = draft ? normalizeWorkflowStage(draft.stage) : "Development";
    const y = clampNodeYToStageBand(node.position.y, stage);
    try {
      await patchProjectTaskDraft(projectId, node.id, { positionX: node.position.x, positionY: y });
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("위치 저장 중 오류가 발생했습니다.");
    }
  }

  function computeStageLaneLayout(): { id: string; x: number; y: number }[] {
    return computeStageAwareLaneLayout(
      drafts.map((d) => ({ id: d.id, stage: d.stage })),
      edges.map((e) => ({ source: e.source, target: e.target }))
    );
  }

  async function handleAutoLayoutPersist() {
    if (!canEdit || drafts.length === 0) return;
    setBusy("layout");
    setMessage(null);
    const layout = computeStageLaneLayout();
    try {
      for (const p of layout) {
        await patchProjectTaskDraft(projectId, p.id, { positionX: p.x, positionY: p.y });
      }
      setMessage("워크플로우를 자동 정렬했습니다.");
      await loadDrafts({ clearMessage: false });
      setCanvasFitRevision((x) => x + 1);
    } catch (e) {
      console.error(e);
      setMessage("자동 정렬 저장 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  // Node type 변경 시 stage는 자동 매핑되므로, 기존 stage(Lane) 직접 편집 UI/핸들러는 사용하지 않는다.

  async function handleAiReorder() {
    if (!projectId || !canEdit || drafts.length === 0) return;
    setBusy("ai-reorder");
    setMessage(null);
    setAiSuggestion(null);
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const draftOnly = drafts.filter((d) => d.status === "DRAFT");
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { res, json } = await postProjectTaskDraftsAiReorder(projectId, { model: selectedModel });
          if (res.ok && json.success && json.data) {
            setAiSuggestion({
              cycleDetected: json.data.cycleDetected,
              tasks: json.data.tasks,
              model: json.data.model,
              reason: json.data.reason ?? "",
              parallelGroups: Array.isArray(json.data.parallelGroups) ? json.data.parallelGroups : [],
              cycleProblemEdge: json.data.cycleProblemEdge ?? null,
              cycleCandidateEdges: Array.isArray(json.data.cycleCandidateEdges) ? json.data.cycleCandidateEdges : [],
            });
            setMessage(json.message || "재정렬 제안을 불러왔습니다.");
            return;
          }
        } catch (e) {
          console.error(e);
        }
        if (attempt < 2) await delay(450);
      }
      if (draftOnly.length >= 1) {
        const synthesized = synthesizeWorkflowDrafts(
          draftOnly.map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description,
            priority: d.priority,
            stage: d.stage,
            createdAt: d.createdAt,
            dependsOnIds: d.dependsOnIds,
          }))
        );
        await persistSynthesizedDrafts(draftOnly, synthesized);
        await loadDrafts({ clearMessage: false });
        setCanvasFitRevision((x) => x + 1);
      }
      setMessage(
        "AI workflow optimization failed. Fallback structure applied. · AI 재정렬에 실패했습니다. 기본 워크플로로 대체되었습니다."
      );
    } catch (e) {
      console.error(e);
      setMessage(
        "AI workflow optimization failed. Fallback structure applied. · AI 재정렬에 실패했습니다. 기본 워크플로로 대체되었습니다."
      );
    } finally {
      setBusy(null);
    }
  }

  async function applyAiSuggestion() {
    if (!aiSuggestion || !canEdit) return;
    setBusy("apply-ai");
    setMessage(null);
    try {
      for (const t of aiSuggestion.tasks) {
        const dRow = byId.get(t.id);
        const st = dRow ? normalizeWorkflowStage(dRow.stage) : "Development";
        const patch: Record<string, unknown> = {
          positionX: t.positionX,
          positionY: clampNodeYToStageBand(t.positionY, st),
        };
        if (Array.isArray(t.dependsOnIds)) {
          const deps = t.dependsOnIds;
          const titleById = new Map<string, string>();
          for (const d of drafts) titleById.set(d.id, d.title);
          const dependsOnTitles = deps.map((id) => titleById.get(id) ?? "").filter(Boolean);
          patch.dependsOnIds = deps;
          patch.dependsOn = dependsOnTitles;
        }
        await patchProjectTaskDraft(projectId, t.id, patch as never);
      }
      setMessage("AI 추천을 적용했습니다.");
      setAiSuggestion(null);
      await loadDrafts({ clearMessage: false });
      setCanvasFitRevision((x) => x + 1);
    } catch (e) {
      console.error(e);
      setMessage("AI 추천 적용 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      data-testid="task-draft-panel"
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 10,
        border: "1px solid #c4b5fd",
        background: "#faf5ff",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <LabelTag label="[F-1-3-5] Workspace — Task drafts (Spec-linked)" />
        <div style={{ flex: "1 1 220px" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#1e1b4b" }}>실행 워크플로</h3>
        </div>
      </div>

      {lastAutoSync ? (
        <div
          data-testid="task-draft-auto-sync-banner"
          style={{
            marginBottom: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: lastAutoSync.ok ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${lastAutoSync.ok ? "#6ee7b7" : "#fecaca"}`,
            fontSize: 12,
            color: lastAutoSync.ok ? "#065f46" : "#991b1b",
            lineHeight: 1.45,
          }}
        >
          {lastAutoSync.ok ? (
            <>
              Spec 반영 · Task 초안 {lastAutoSync.createdCount ?? 0}개 생성
              {typeof lastAutoSync.supersededCount === "number" && lastAutoSync.supersededCount > 0
                ? ` · 이전 DRAFT ${lastAutoSync.supersededCount}개 정리됨`
                : ""}
            </>
          ) : (
            <>
              <strong>자동 생성 실패:</strong> {lastAutoSync.message ?? "알 수 없는 오류"}
            </>
          )}
        </div>
      ) : null}

      <div
        style={{
          marginBottom: 12,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #ddd6fe",
          background: "#fff",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1f2937" }}>
          총 Task: {drafts.length}개 · 단계: {EXECUTION_STAGE_ORDER.length}단계
        </div>
        <div style={{ fontSize: 12, color: "#475569" }}>예상 흐름: [{flowPathText}]</div>
        <div style={{ fontSize: 12, color: "#0f766e", fontWeight: 700 }}>현재 단계: {stageLabel(activeStage)} 진행 중</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setViewMode("stage")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: viewMode === "stage" ? "1px solid #7c3aed" : "1px solid #cbd5e1",
            background: viewMode === "stage" ? "#ede9fe" : "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          단계 보기
        </button>
        <button
          type="button"
          onClick={() => setViewMode("graph")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: viewMode === "graph" ? "1px solid #7c3aed" : "1px solid #cbd5e1",
            background: viewMode === "graph" ? "#ede9fe" : "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          그래프 보기
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>실행 Task 유형</span>
        <button
          type="button"
          onClick={() => setExecutionKindFilter("")}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: executionKindFilter === "" ? "1px solid #7c3aed" : "1px solid #e2e8f0",
            background: executionKindFilter === "" ? "#ede9fe" : "#fff",
            fontWeight: 800,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          전체
        </button>
        {EXECUTION_KIND_FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setExecutionKindFilter(k)}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: executionKindFilter === k ? "1px solid #7c3aed" : "1px solid #e2e8f0",
              background: executionKindFilter === k ? "#ede9fe" : "#fff",
              fontWeight: 800,
              fontSize: 11,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, alignItems: "center" }}>
        {canEdit ? (
          <>
            <button
              type="button"
              data-testid="task-draft-regenerate"
              disabled={busy === "regen"}
              onClick={() => void handleRegenerate()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #7c3aed",
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 700,
                cursor: busy === "regen" ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {busy === "regen" ? "생성·확정 중…" : "AI로 Task 초안 다시 생성 및 전체 확정"}
            </button>
            <button
              type="button"
              data-testid="task-draft-confirm-all"
              disabled={busy === "confirm-all" || executableDraftCount === 0 || !validation.ok}
              onClick={() => void handleConfirmAll()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #15803d",
                background: "#22c55e",
                color: "#fff",
                fontWeight: 800,
                cursor: busy === "confirm-all" ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {busy === "confirm-all" ? "확정 중…" : "전체 DRAFT 확정 → Task"}
            </button>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                data-testid="task-draft-more-menu"
                disabled={drafts.length === 0 && !loading}
                onClick={() => setMoreMenuOpen((v) => !v)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#334155",
                }}
              >
                더보기
              </button>
              {moreMenuOpen ? (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 30,
                    top: 40,
                    left: 0,
                    minWidth: 200,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    padding: 8,
                    boxShadow: "0 8px 30px rgba(15,23,42,0.12)",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    data-testid="task-draft-auto-layout"
                    disabled={busy === "layout" || drafts.length === 0}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      void handleAutoLayoutPersist();
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      fontWeight: 700,
                      cursor: busy === "layout" ? "wait" : "pointer",
                      fontSize: 12,
                      textAlign: "left",
                    }}
                  >
                    {busy === "layout" ? "정렬 중…" : "자동 정렬 (lane 맞춤)"}
                  </button>
                  <button
                    type="button"
                    data-testid="task-draft-refresh"
                    disabled={loading}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      void loadDrafts();
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      fontWeight: 700,
                      cursor: loading ? "wait" : "pointer",
                      fontSize: 12,
                      textAlign: "left",
                    }}
                  >
                    새로고침
                  </button>
                  <button
                    type="button"
                    data-testid="task-draft-ai-reorder"
                    disabled={busy === "ai-reorder" || drafts.length === 0}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      void handleAiReorder();
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      fontWeight: 700,
                      cursor: busy === "ai-reorder" ? "wait" : "pointer",
                      fontSize: 12,
                      textAlign: "left",
                    }}
                  >
                    {busy === "ai-reorder" ? "요청 중…" : "AI로 Workflow 재정렬"}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      {busy === "regen" ? (
        <p
          role="status"
          data-testid="task-draft-inline-ai-generate"
          data-ui-label="[F-1-3-5-s] Inline — Task draft AI generation"
          style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "#5b21b6" }}
        >
          Spec 기준으로 Task 초안을 생성하는 중…
        </p>
      ) : null}
      {busy === "auto-wire" ? (
        <p role="status" style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "#0f766e" }}>
          기본 워크플로우(연결·배치)를 구성하는 중…
        </p>
      ) : null}

      {message ? (
        <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#4c1d95", lineHeight: 1.45 }} role="status">
          {message}
        </p>
      ) : null}

      {aiSuggestion ? (
        <div
          data-testid="task-draft-ai-suggestion-banner"
          style={{
            margin: "0 0 8px 0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #99f6e4",
            background: "#f0fdfa",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: "#0f766e" }}>
            AI 재정렬 제안{aiSuggestion.cycleDetected ? " · 순환 제외" : ""}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            <button
              type="button"
              disabled={busy === "apply-ai"}
              onClick={() => void applyAiSuggestion()}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: "#0d9488",
                color: "#fff",
                fontWeight: 900,
                cursor: busy === "apply-ai" ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {busy === "apply-ai" ? "적용 중…" : "적용"}
            </button>
            <button
              type="button"
              onClick={() => setAiSuggestion(null)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              무시
            </button>
          </div>
        </div>
      ) : null}

      {!validation.ok && validationScopeDrafts.some((d) => d.status === "DRAFT") ? (
        <div
          data-testid="task-draft-workflow-invalid-banner"
          style={{
            margin: "0 0 8px 0",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            워크플로 점검 · 수동 확정 전에 선행 관계를 정리해 주세요
          </div>
          {validation.cycle ? (
            <div style={{ marginBottom: 4 }}>
              순환: {validation.cycle.cyclePath.slice(0, 8).join(" → ")}
            </div>
          ) : null}
          {validation.missingDepEdges.length > 0 ? (
            <div>유효하지 않은 선행 참조 {validation.missingDepEdges.length}개</div>
          ) : null}
        </div>
      ) : null}

      {/* 상태 요약/실행 순서 텍스트는 Detail Panel로 이동 */}

      {viewMode === "stage" ? (
        <div
          data-testid="task-draft-stage-board"
          style={{
            borderRadius: 12,
            border: "1px solid #ddd6fe",
            background: "#fff",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            {EXECUTION_STAGE_ORDER.map((s, idx) => (
              <div key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>{stageLabel(s)}</span>
                {idx < EXECUTION_STAGE_ORDER.length - 1 ? (
                  <span aria-hidden style={{ color: "#94a3b8", fontWeight: 900 }}>
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              alignItems: "start",
            }}
          >
            {EXECUTION_STAGE_ORDER.map((st) => {
              const rows = groupedByExecutionStageView.get(st) ?? [];
              return (
                <section key={st} style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 8 }}>
                    {stageLabel(st)} ({rows.length})
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {rows.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#94a3b8", padding: "4px 2px" }}>Task 없음</div>
                    ) : st !== "Development" ? (
                      rows.map((d) => (
                        <StageBoardTaskCard
                          key={d.id}
                          d={d}
                          rows={rows}
                          workflowStatusById={workflowStatusById}
                          hierarchyHighlightIds={hierarchyHighlightIds}
                          canEdit={canEdit}
                          onOpen={openEdit}
                          onMoveInStage={handleMoveInStage}
                        />
                      ))
                    ) : (
                      <>
                        {(() => {
                          const nt = (x: TaskDraftDto) => (x.nodeType ?? nodeTypeFromTitle(x.title)) as TaskNodeType;
                          const devNonTask = rows.filter((x) => nt(x) !== "task");
                          const devTasks = rows.filter((x) => nt(x) === "task");
                          const byF = new Map<string, TaskDraftDto[]>();
                          for (const t of devTasks) {
                            const fid = featureParentDraftId(t, byId) ?? "_ungrouped";
                            if (!byF.has(fid)) byF.set(fid, []);
                            byF.get(fid)!.push(t);
                          }
                          const keys = [...byF.keys()].sort((a, b) => {
                            if (a === "_ungrouped") return 1;
                            if (b === "_ungrouped") return -1;
                            const ta = byId.get(a)?.title ?? a;
                            const tb = byId.get(b)?.title ?? b;
                            return ta.localeCompare(tb, "ko");
                          });
                          return (
                            <>
                              {devNonTask.map((d) => (
                                <StageBoardTaskCard
                                  key={d.id}
                                  d={d}
                                  rows={rows}
                                  workflowStatusById={workflowStatusById}
                                  hierarchyHighlightIds={hierarchyHighlightIds}
                                  canEdit={canEdit}
                                  onOpen={openEdit}
                                  onMoveInStage={handleMoveInStage}
                                />
                              ))}
                              {keys.map((fid) => {
                                const tasks = byF.get(fid)!;
                                const collapsed = fid !== "_ungrouped" && collapsedFeatureIds.has(fid);
                                const feat = fid === "_ungrouped" ? null : byId.get(fid);
                                return (
                                  <div key={fid} style={{ display: "grid", gap: 6 }}>
                                    {fid !== "_ungrouped" ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCollapsedFeatureIds((prev) => {
                                            const n = new Set(prev);
                                            if (n.has(fid)) n.delete(fid);
                                            else n.add(fid);
                                            return n;
                                          });
                                        }}
                                        style={{
                                          textAlign: "left",
                                          padding: "8px 10px",
                                          borderRadius: 8,
                                          border: "1px solid #bbf7d0",
                                          background: "#f0fdf4",
                                          fontWeight: 900,
                                          fontSize: 12,
                                          color: "#166534",
                                          cursor: "pointer",
                                        }}
                                      >
                                        {collapsed ? "▶" : "▼"} Feature · {feat?.title ?? fid} · {tasks.length} Tasks
                                      </button>
                                    ) : null}
                                    {fid === "_ungrouped" || !collapsed ? (
                                      tasks.map((d) => (
                                        <StageBoardTaskCard
                                          key={d.id}
                                          d={d}
                                          rows={rows}
                                          workflowStatusById={workflowStatusById}
                                          hierarchyHighlightIds={hierarchyHighlightIds}
                                          canEdit={canEdit}
                                          onOpen={openEdit}
                                          onMoveInStage={handleMoveInStage}
                                        />
                                      ))
                                    ) : (
                                      <div style={{ fontSize: 11, color: "#64748b", paddingLeft: 8 }}>
                                        {tasks.length}개 접힘 — 헤더를 눌러 펼칩니다.
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          data-testid="task-draft-workflow-canvas"
          style={{
            borderRadius: 12,
            border: "1px solid #ddd6fe",
            background: "#fff",
            height: "70vh",
            minHeight: Math.max(520, totalLaneCanvasHeightPx()),
            overflow: "hidden",
            position: "relative",
          }}
        >
          {showDefaultFlowCta ? (
            <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5, maxWidth: "min(100% - 20px, 320px)" }}>
              <button
                type="button"
                data-testid="task-draft-rebuild-default-flow"
                disabled={busy === "auto-wire"}
                onClick={() => void runSynthesizeDefaultFlow()}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #0d9488",
                  background: "#f0fdfa",
                  color: "#115e59",
                  fontWeight: 800,
                  cursor: busy === "auto-wire" ? "wait" : "pointer",
                  fontSize: 12,
                  lineHeight: 1.35,
                  textAlign: "left",
                }}
              >
                기본 흐름 다시 만들기
              </button>
            </div>
          ) : null}
          {drafts.length === 0 && !loading ? (
            <div style={{ padding: 14, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              아직 표시할 흐름이 없습니다. Spec을 확정하면 AI가 Task 초안과 연결을 자동으로 만들거나, 위에서 「AI로 Task 초안 다시
              생성 및 전체 확정」을 누를 수 있습니다.
            </div>
          ) : (
            <ReactFlow
              nodeTypes={nodeTypes}
              nodes={nodes}
              edges={edges}
              style={{ position: "relative", zIndex: 2 }}
              defaultEdgeOptions={{
                style: { stroke: "#64748b", strokeWidth: 2 },
                type: "smoothstep",
              }}
              elevateEdgesOnSelect
              onPaneClick={() => setEditing(null)}
              onConnect={(c) => void handleConnect(c)}
              onNodeClick={(_, n) => {
                const d = byId.get(n.id);
                if (d) openEdit(d);
              }}
              onNodeDragStop={(_, n) => void handleNodeDragStop(n)}
              onEdgeClick={(_, e) => void handleDeleteEdge(e)}
            >
              <CanvasFitView revision={canvasFitRevision} />
              <SwimlaneBands />
              <Background gap={20} size={1.2} color="#cbd5e1" />
              <Controls />
            </ReactFlow>
          )}
        </div>
      )}

      {/* Detail drawer: 선택 시에만 표시 */}
      {editing ? (
        <div
          data-testid="task-draft-detail-panel"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            pointerEvents: "none",
          }}
        >
          <div
            onClick={() => setEditing(null)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15,23,42,0.40)",
              pointerEvents: "auto",
            }}
          />
          <aside
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              height: "100%",
              width: "min(420px, 92vw)",
              background: "#fff",
              borderLeft: "1px solid #e2e8f0",
              boxShadow: "-8px 0 30px rgba(15,23,42,0.18)",
              padding: 14,
              overflow: "auto",
              pointerEvents: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: "#1e1b4b" }}>Task 상세</div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                닫기
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>Spec v{editing.specVersionNumber}</div>

            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>실행 상태</div>
                <div style={{ fontSize: 12, color: "#334155", marginBottom: 6 }}>
                  노드 타입:{" "}
                  <span style={{ color: "#0f766e", fontWeight: 900 }}>
                    {nodeTypeLabel(editNodeType)} {stageLabel(normalizeWorkflowStage(stageForNodeType(editNodeType)) as ExecutionStage)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
                  상태:{" "}
                  {(() => {
                    const ws = workflowStatusById.get(editing.id) ?? "BLOCKED";
                    if (editing.status === "CONFIRMED" || ws === "CONFIRMED") return "확정됨";
                    if (ws === "INVALID") return "그래프 오류(선행 참조)";
                    if (ws === "READY") return "실행 가능";
                    if (ws === "BLOCKED") return "선행 대기";
                    return editing.status;
                  })()}
                </div>
                <div style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>
                  선행(dependsOn):{" "}
                  {(editing.dependsOnIds ?? []).length > 0 ? (
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
                      {(editing.dependsOnIds ?? []).map((id) => {
                        const row = byId.get(id);
                        const nt = row ? (row.nodeType ?? nodeTypeFromTitle(row.title)) as TaskNodeType : null;
                        return (
                          <li key={id}>
                            {nt ? `${nodeTypeLabel(nt)} · ` : ""}
                            {row?.title ?? id.slice(0, 10)}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    "없음"
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
                  자식(후속):{" "}
                  {detailBlockingDrafts.length === 0 ? (
                    "없음"
                  ) : childrenCollapsed ? (
                    `${detailBlockingDrafts.length}개`
                  ) : (
                    detailBlockingDrafts.map((d) => d.title).join(", ")
                  )}
                  {detailBlockingDrafts.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setChildrenCollapsed((v) => !v)}
                      style={{
                        marginLeft: 10,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      {childrenCollapsed ? "펼치기" : "접기"}
                    </button>
                  ) : null}
                </div>
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>제목</span>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
                  우선순위 · 캔버스 표시 {priorityToPLabel(editPriority)}
                </span>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                >
                  {editNodeType === "task" ? (
                    <>
                      <option value="P0">P0</option>
                      <option value="P1">P1</option>
                      <option value="P2">P2</option>
                    </>
                  ) : null}
                  <option value="HIGH">HIGH (P0)</option>
                  <option value="MEDIUM">MEDIUM (P1)</option>
                  <option value="LOW">LOW (P2)</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>노드 타입</span>
                <select
                  value={editNodeType}
                  disabled={!canEdit || busy === "stage"}
                  onChange={(e) => setEditNodeType(e.target.value as TaskNodeType)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                >
                  <option value="requirement">Requirement [R]</option>
                  <option value="design">Design [D]</option>
                  <option value="feature">Feature [F]</option>
                  <option value="task">Task [T]</option>
                </select>
              </label>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: -6 }}>
                현재 Lane: {normalizeWorkflowStage(stageForNodeType(editNodeType))}
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>설명</span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              {editNodeType === "task" ? (
                <>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Input (무엇을 받는지)</span>
                    <textarea
                      value={editTaskInput}
                      onChange={(e) => setEditTaskInput(e.target.value)}
                      rows={4}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", resize: "vertical" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Output (무엇을 내는지)</span>
                    <textarea
                      value={editTaskOutput}
                      onChange={(e) => setEditTaskOutput(e.target.value)}
                      rows={4}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", resize: "vertical" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>예상 크기</span>
                    <select
                      value={editEstimatedSize}
                      onChange={(e) => setEditEstimatedSize(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                    >
                      <option value="">(미지정)</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>실행 유형</span>
                    <select
                      value={editExecutionKind}
                      onChange={(e) => setEditExecutionKind(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                    >
                      <option value="">(미지정)</option>
                      {EXECUTION_KIND_FILTERS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>수용 기준(줄바꿈 = 항목)</span>
                <textarea
                  value={editCriteria}
                  onChange={(e) => setEditCriteria(e.target.value)}
                  rows={6}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  disabled={busy === "save-edit"}
                  onClick={() => void saveEdit()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #7c3aed",
                    background: "#7c3aed",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: busy === "save-edit" ? "wait" : "pointer",
                    fontSize: 12,
                  }}
                >
                  {busy === "save-edit" ? "저장 중…" : "저장"}
                </button>
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      data-testid={`task-draft-confirm-${editing.id}`}
                      disabled={editNodeType !== "task" || busy?.startsWith("confirm-")}
                      onClick={() => void handleConfirmOne(editing.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #15803d",
                        background: "#16a34a",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: busy?.startsWith("confirm-") ? "wait" : "pointer",
                        fontSize: 12,
                      }}
                    >
                      확정→Task
                    </button>
                  </>
                ) : null}
              </div>

              <div style={{ fontSize: 12, color: "#64748b" }}>updated: {formatTestedAt(editing.updatedAt)}</div>

              <button
                type="button"
                onClick={() => setExecutionPreviewOpen((v) => !v)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                  fontSize: 12,
                  textAlign: "left",
                }}
              >
                {executionPreviewOpen ? "실행 순서(간이) 숨기기" : "실행 순서(간이) 보기"}
              </button>
              {executionPreviewOpen ? (
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
                  {executionLevels.length === 0 ? (
                    <div style={{ color: "#64748b" }}>DRAFT 노드가 없습니다.</div>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                      {executionLevels.slice(0, 10).map((level, idx) => (
                        <li key={idx}>
                          {level
                            .map((id) => byId.get(id)?.title ?? id.slice(0, 8))
                            .slice(0, 6)
                            .join(" / ")}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {confirmModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="task-draft-confirm-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #e2e8f0",
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>전체 DRAFT 확정 → Task</div>
            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
              - Task DRAFT {executableDraftCount}개를 실제 Task로 추가합니다.
              <br />
              - 기존 Task는 삭제되지 않습니다.
              {validation.isolatedIds.length > 0 ? (
                <>
                  <br />- 고립 노드 {validation.isolatedIds.length}개가 있습니다(연결 없음).
                </>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy === "confirm-all"}
                onClick={() => {
                  setConfirmModalOpen(false);
                  void runConfirmAll();
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #15803d",
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: busy === "confirm-all" ? "wait" : "pointer",
                }}
              >
                {busy === "confirm-all" ? "확정 중…" : "확정 실행"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
