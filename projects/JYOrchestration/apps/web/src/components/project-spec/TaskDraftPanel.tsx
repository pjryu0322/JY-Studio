"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteProjectTaskDraft,
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
  snapNodeYToLaneCenter,
  normalizeWorkflowStage,
  type WorkflowStage,
} from "@/lib/project-spec/workflowLaneLayout";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editCriteria, setEditCriteria] = useState("");
  const savingPositionsRef = useRef(new Map<string, number>());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [executionPreviewOpen, setExecutionPreviewOpen] = useState(false);
  const autoWireRanRef = useRef(false);
  const initialCanvasFitRef = useRef(false);
  const [canvasFitRevision, setCanvasFitRevision] = useState(0);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
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

  const validation = useMemo(() => {
    const allIds = drafts.map((d) => d.id);
    const missingDepEdges: Array<{ targetId: string; missingId: string }> = [];
    for (const d of drafts) {
      for (const dep of depsById.get(d.id) ?? []) {
        if (!byId.has(dep)) {
          missingDepEdges.push({ targetId: d.id, missingId: dep });
        }
      }
    }
    const cycle = detectCycle(allIds, depsById);

    const incomingCount = new Map<string, number>();
    const outgoingCount = new Map<string, number>();
    for (const id of allIds) {
      incomingCount.set(id, 0);
      outgoingCount.set(id, 0);
    }
    for (const d of drafts) {
      const deps = depsById.get(d.id) ?? [];
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
  }, [byId, depsById, drafts]);

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

  const detailDependsTitles = useMemo(() => {
    if (!editing) return [];
    return (editing.dependsOnIds ?? []).map((id) => byId.get(id)?.title ?? id.slice(0, 8));
  }, [byId, editing]);

  const detailBlockingDrafts = useMemo(() => {
    if (!editing) return [];
    return drafts.filter((d) => (d.dependsOnIds ?? []).includes(editing.id));
  }, [drafts, editing]);

  const nodeTypes = useMemo<NodeTypes>(() => ({ taskDraftNode: TaskDraftWorkflowNode }), []);

  const nodes: Node[] = useMemo(() => {
    return drafts.map((d) => {
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
          priority: d.priority,
          visualState,
        },
      };
    });
  }, [drafts, workflowStatusById]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const d of drafts) {
      for (const depId of d.dependsOnIds ?? []) {
        if (!byId.has(depId)) continue;
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
  }, [byId, drafts]);

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
      const n = json.data?.createdCount ?? 0;
      setMessage(`Task 초안 ${n}개를(을) 생성했습니다.`);
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
    if (!projectId || !canEdit || drafts.length === 0) {
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
    if (!projectId || !canEdit || drafts.length === 0) return;
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

  async function handleDelete(draftId: string) {
    if (!projectId || !canEdit) {
      return;
    }
    setBusy(`del-${draftId}`);
    setMessage(null);
    try {
      const { res, json } = await deleteProjectTaskDraft(projectId, draftId);
      if (!res.ok || !json.success) {
        setMessage(json.message || "삭제에 실패했습니다.");
        return;
      }
      setMessage("초안을 삭제했습니다.");
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("삭제 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  function openEdit(d: TaskDraftDto) {
    setEditing(d);
    setEditTitle(d.title);
    setEditDescription(d.description ?? "");
    setEditPriority(d.priority);
    setEditCriteria((d.acceptanceCriteria ?? []).join("\n"));
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
      const { res, json } = await patchProjectTaskDraft(projectId, editing.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        acceptanceCriteria: criteria,
      });
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
    const stage = draft ? normalizeWorkflowStage(draft.stage) : "Build";
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

  async function handleStageChange(nextStage: WorkflowStage) {
    if (!editing || !canEdit) return;
    setBusy("stage");
    setMessage(null);
    try {
      await patchProjectTaskDraft(projectId, editing.id, {
        stage: nextStage,
        positionY: snapNodeYToLaneCenter(nextStage),
      });
      setEditing({ ...editing, stage: nextStage, positionY: snapNodeYToLaneCenter(nextStage) });
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("stage 변경 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

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
        const st = dRow ? normalizeWorkflowStage(dRow.stage) : "Build";
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
              {busy === "regen" ? "생성 중…" : "AI로 Task 초안 다시 생성"}
            </button>
            <button
              type="button"
              data-testid="task-draft-confirm-all"
              disabled={busy === "confirm-all" || drafts.length === 0 || !validation.ok}
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

      {!validation.ok ? (
        <div
          data-testid="task-draft-workflow-invalid-banner"
          style={{
            margin: "0 0 8px 0",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>확정할 수 없음 · 그래프를 수정하세요</div>
          {validation.cycle ? (
            <div style={{ marginBottom: 4 }}>
              순환: {validation.cycle.cyclePath.slice(0, 8).join(" → ")}
            </div>
          ) : null}
          {validation.missingDepEdges.length > 0 ? (
            <div>누락된 선행 Task 참조 {validation.missingDepEdges.length}개</div>
          ) : null}
        </div>
      ) : null}

      {/* 상태 요약/실행 순서 텍스트는 Detail Panel로 이동 */}

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
              생성」을 누를 수 있습니다.
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
              <MiniMap />
              <Controls />
            </ReactFlow>
          )}
      </div>

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
              <div style={{ fontWeight: 900, fontSize: 14, color: "#1e1b4b" }}>Detail</div>
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
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>실행</div>
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
                  {detailDependsTitles.length ? detailDependsTitles.join(", ") : "없음"}
                </div>
                <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
                  이 작업이 막는 후속:{" "}
                  {detailBlockingDrafts.length
                    ? detailBlockingDrafts.map((d) => d.title).join(", ")
                    : "없음"}
                </div>
              </div>

              {aiSuggestion ? (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>AI 분석</div>
                  <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
                    {aiSuggestion.reason || "—"}
                  </div>
                  {aiSuggestion.parallelGroups.length > 0 ? (
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
                      병렬 후보:{" "}
                      {aiSuggestion.parallelGroups
                        .slice(0, 6)
                        .map((g) => g.map((id) => byId.get(id)?.title ?? id.slice(0, 6)).join(" / "))
                        .join(" · ")}
                    </div>
                  ) : null}
                  {aiSuggestion.cycleProblemEdge ? (
                    <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 6 }}>
                      순환 엣지: {aiSuggestion.cycleProblemEdge.source} → {aiSuggestion.cycleProblemEdge.target}
                    </div>
                  ) : null}
                  {aiSuggestion.cycleCandidateEdges && aiSuggestion.cycleCandidateEdges.length > 0 ? (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                      잠재 순환 후보:{" "}
                      {aiSuggestion.cycleCandidateEdges
                        .slice(0, 5)
                        .map((e) => `${e.source}→${e.target}`)
                        .join(", ")}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{aiSuggestion.model}</div>
                </div>
              ) : null}

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
                  <option value="HIGH">HIGH (P0)</option>
                  <option value="MEDIUM">MEDIUM (P1)</option>
                  <option value="LOW">LOW (P2)</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Stage (Lane)</span>
                <select
                  value={normalizeWorkflowStage(editing.stage)}
                  disabled={!canEdit || busy === "stage"}
                  onChange={(e) => void handleStageChange(normalizeWorkflowStage(e.target.value))}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
                >
                  {WORKFLOW_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>설명</span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

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
                      disabled={busy?.startsWith("confirm-") || busy === `del-${editing.id}`}
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
                    <button
                      type="button"
                      disabled={busy?.startsWith("confirm-") || busy === `del-${editing.id}`}
                      onClick={() => void handleDelete(editing.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #dc2626",
                        background: "#fff",
                        color: "#dc2626",
                        fontWeight: 900,
                        cursor: busy === `del-${editing.id}` ? "wait" : "pointer",
                        fontSize: 12,
                      }}
                    >
                      삭제
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
              - DRAFT {drafts.filter((d) => d.status === "DRAFT").length}개를 실제 Task로 추가합니다.
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
