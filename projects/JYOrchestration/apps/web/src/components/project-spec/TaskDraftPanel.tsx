"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  deleteProjectTaskDraft,
  fetchProjectTaskDrafts,
  patchProjectTaskDraft,
  postProjectTaskDraftCreate,
  postProjectTaskDraftsAiReorder,
  postProjectTaskDraftsConfirm,
  postProjectTaskDraftsGenerate,
} from "@/components/project-spec/api";
import { formatTestedAt } from "@/components/project-spec/format";
import type { TaskDraftDto, TaskDraftSyncResultDto } from "@/components/project-spec/types";
import { LabelTag } from "@/components/ui/LabelTag";
import type { SpecWorkspaceAiModelId } from "@/lib/project-spec/specWorkspaceModels";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "reactflow";
import dagre from "dagre";

import "reactflow/dist/style.css";

const WORKFLOW_STAGES = ["Planning", "Build", "Test", "Review", "Apply"] as const;
type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
type WorkflowStatus = "CONFIRMED" | "READY" | "BLOCKED" | "INVALID";

function normalizeStage(s: string | null | undefined): WorkflowStage {
  const v = String(s ?? "").trim();
  return (WORKFLOW_STAGES as readonly string[]).includes(v) ? (v as WorkflowStage) : "Build";
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

type TaskDraftNodeData = {
  title: string;
  priority: string;
  workflowStatus: WorkflowStatus;
  stage: WorkflowStage;
  specVersionNumber: number;
  createdByType: string;
  isStart: boolean;
  isTerminal: boolean;
  isParallelCandidate: boolean;
};

const TaskDraftNodeView = memo(function TaskDraftNodeView({
  data,
  selected,
}: NodeProps & { data: TaskDraftNodeData }) {
  const statusBg =
    data.workflowStatus === "READY"
      ? "#dcfce7"
      : data.workflowStatus === "BLOCKED"
        ? "#e2e8f0"
        : data.workflowStatus === "INVALID"
          ? "#fee2e2"
          : "#e0e7ff";
  return (
    <div
      style={{
        width: 280,
        borderRadius: 12,
        border: selected ? "2px solid #7c3aed" : "1px solid #cbd5e1",
        background: "#fff",
        boxShadow: selected ? "0 2px 12px rgba(124,58,237,0.25)" : "0 1px 3px rgba(15,23,42,0.06)",
        overflow: "hidden",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", background: statusBg }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", lineHeight: 1.35 }}>{data.title}</div>
        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={badgeBase("#fff", "#334155")}>P:{data.priority}</span>
          <span style={badgeBase("#fff", "#334155")}>{data.workflowStatus}</span>
          <span style={badgeBase("#fff", "#334155")}>Spec v{data.specVersionNumber}</span>
        </div>
      </div>
      <div style={{ padding: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={badgeBase("#f8fafc", "#475569")}>{data.stage}</span>
        <span style={badgeBase(data.createdByType === "USER" ? "#fff7ed" : "#eff6ff", "#475569")}>
          {data.createdByType === "USER" ? "USER" : "AI"}
        </span>
        {data.isStart ? <span style={badgeBase("#ecfeff", "#0e7490")}>START</span> : null}
        {data.isTerminal ? <span style={badgeBase("#fef3c7", "#92400e")}>TERMINAL</span> : null}
        {data.isParallelCandidate ? <span style={badgeBase("#dcfce7", "#166534")}>PARALLEL</span> : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

function badgeBase(bg: string, color: string): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 900,
    padding: "2px 7px",
    borderRadius: 999,
    background: bg,
    color,
    border: "1px solid #e2e8f0",
  };
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
  currentSpecVersionId,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const savingPositionsRef = useRef(new Map<string, number>());
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
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

  const loadDrafts = useCallback(async () => {
    if (!projectId) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      // Workflow Builder는 DRAFT + CONFIRMED를 함께 보여줘야 READY/BLOCKED 계산이 가능하다.
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
  }, [projectId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts, refreshKey]);

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

  const parallelCandidateIds = useMemo(() => {
    const s = new Set<string>();
    if (!aiSuggestion?.parallelGroups) return s;
    for (const g of aiSuggestion.parallelGroups) {
      for (const id of g) s.add(id);
    }
    return s;
  }, [aiSuggestion]);

  const cycleEdgeId = useMemo(() => {
    if (validation.cycle) {
      return `${validation.cycle.edge.source}__to__${validation.cycle.edge.target}`;
    }
    if (aiSuggestion?.cycleProblemEdge) {
      return `${aiSuggestion.cycleProblemEdge.source}__to__${aiSuggestion.cycleProblemEdge.target}`;
    }
    return null;
  }, [aiSuggestion, validation.cycle]);

  const nodeTypes = useMemo<NodeTypes>(() => ({ taskDraftNode: TaskDraftNodeView }), []);

  const nodes: Node[] = useMemo(() => {
    return drafts.map((d) => ({
      id: d.id,
      type: "taskDraftNode",
      position: { x: d.positionX ?? 0, y: d.positionY ?? 0 },
      data: {
        title: d.title,
        priority: d.priority,
        workflowStatus: workflowStatusById.get(d.id) ?? "BLOCKED",
        stage: normalizeStage(d.stage),
        specVersionNumber: d.specVersionNumber,
        createdByType: d.createdByType,
        isStart: validation.startIds.includes(d.id),
        isTerminal: validation.terminalIds.includes(d.id),
        isParallelCandidate: parallelCandidateIds.has(d.id),
      },
    }));
  }, [drafts, parallelCandidateIds, validation.startIds, validation.terminalIds, workflowStatusById]);

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
          style:
            cycleEdgeId && cycleEdgeId === id
              ? { stroke: "#dc2626", strokeWidth: 3 }
              : parallelCandidateIds.has(depId) && parallelCandidateIds.has(d.id)
                ? { stroke: "#16a34a", strokeWidth: 2 }
                : undefined,
          animated: Boolean(cycleEdgeId && cycleEdgeId === id),
        });
      }
    }
    return out;
  }, [byId, cycleEdgeId, drafts, parallelCandidateIds]);

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
      await loadDrafts();
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

  async function handleAddDraft() {
    if (!projectId || !canEdit) return;
    if (!currentSpecVersionId) {
      setMessage("확정된 Spec 버전이 없어 Task 초안을 추가할 수 없습니다. 먼저 Spec을 확정하세요.");
      return;
    }
    setAddMenuOpen(false);
    setBusy("add");
    setMessage(null);
    try {
      const { res, json } = await postProjectTaskDraftCreate(projectId, {
        specVersionId: currentSpecVersionId,
        title: "새 Task",
        description: null,
        priority: "MEDIUM",
        acceptanceCriteria: [],
        positionX: 40,
        positionY: drafts.length * 40,
        dependsOnIds: [],
        stage: "Build",
      });
      if (!res.ok || !json.success || !json.data) {
        setMessage(json.message || "Task 초안 추가에 실패했습니다.");
        return;
      }
      setSelectedId(json.data.id);
      openEdit(json.data);
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("Task 초안 추가 중 오류가 발생했습니다.");
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
    try {
      await patchProjectTaskDraft(projectId, node.id, { positionX: node.position.x, positionY: node.position.y });
      await loadDrafts();
    } catch (e) {
      console.error(e);
      setMessage("위치 저장 중 오류가 발생했습니다.");
    }
  }

  function computeDagreLayout(): { id: string; x: number; y: number }[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120 });
    for (const n of nodes) {
      g.setNode(n.id, { width: 260, height: 120 });
    }
    for (const e of edges) {
      g.setEdge(e.source, e.target);
    }
    dagre.layout(g);

    return nodes.map((n) => {
      const p = g.node(n.id);
      if (!p) return { id: n.id, x: n.position.x, y: n.position.y };
      return { id: n.id, x: p.x - 130, y: p.y - 60 };
    });
  }

  async function handleAutoLayoutPersist() {
    if (!canEdit || drafts.length === 0) return;
    setBusy("layout");
    setMessage(null);
    const layout = computeDagreLayout();
    try {
      for (const p of layout) {
        await patchProjectTaskDraft(projectId, p.id, { positionX: p.x, positionY: p.y });
      }
      setMessage("워크플로우를 자동 정렬했습니다.");
      await loadDrafts();
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
      await patchProjectTaskDraft(projectId, editing.id, { stage: nextStage });
      setEditing({ ...editing, stage: nextStage });
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
    try {
      const { res, json } = await postProjectTaskDraftsAiReorder(projectId, { model: selectedModel });
      if (!res.ok || !json.success || !json.data) {
        setMessage(json.message || "AI 재정렬에 실패했습니다.");
        return;
      }
      setAiSuggestion({
        cycleDetected: json.data.cycleDetected,
        tasks: json.data.tasks,
        model: json.data.model,
        reason: json.data.reason ?? "의존성과 병렬 실행 가능성을 기준으로 재배치",
        parallelGroups: Array.isArray(json.data.parallelGroups) ? json.data.parallelGroups : [],
        cycleProblemEdge: json.data.cycleProblemEdge ?? null,
        cycleCandidateEdges: Array.isArray(json.data.cycleCandidateEdges) ? json.data.cycleCandidateEdges : [],
      });
      setMessage(json.message || "AI 재정렬 추천을 생성했습니다.");
    } catch (e) {
      console.error(e);
      setMessage("AI 재정렬 중 오류가 발생했습니다.");
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
        const patch: Record<string, unknown> = { positionX: t.positionX, positionY: t.positionY };
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
      await loadDrafts();
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
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <LabelTag label="[F-1-3-5] Workspace — Task drafts (Spec-linked)" />
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Task 초안 (Spec 연동)</h3>
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#5b21b6", lineHeight: 1.5 }}>
        확정 Spec 버전이 바뀔 때마다 AI가 Task 초안을 자동 생성합니다. 검토 후 「확정」하면 실제 Task로 추가되며, 기존 Task는 자동
        삭제되지 않습니다.
      </p>

      {lastAutoSync ? (
        <div
          data-testid="task-draft-auto-sync-banner"
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            background: lastAutoSync.ok ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${lastAutoSync.ok ? "#6ee7b7" : "#fecaca"}`,
            fontSize: 13,
            color: lastAutoSync.ok ? "#065f46" : "#991b1b",
          }}
        >
          {lastAutoSync.ok ? (
            <>
              <strong>Spec 반영:</strong> Task 초안 {lastAutoSync.createdCount ?? 0}개 생성
              {typeof lastAutoSync.supersededCount === "number" && lastAutoSync.supersededCount > 0
                ? ` · 이전 DRAFT ${lastAutoSync.supersededCount}개 SUPERSEDED 처리`
                : ""}
            </>
          ) : (
            <>
              <strong>Task 초안 자동 생성 실패:</strong> {lastAutoSync.message ?? "알 수 없는 오류"}
            </>
          )}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <button
          type="button"
          data-testid="task-draft-refresh"
          disabled={loading}
          onClick={() => void loadDrafts()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #7c3aed",
            background: "#fff",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            fontSize: 12,
          }}
        >
          {loading ? "불러오는 중…" : "Task 초안 새로고침"}
        </button>
        {canEdit ? (
          <>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                data-testid="task-draft-add"
                disabled={busy === "add"}
                onClick={() => setAddMenuOpen((v) => !v)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #4f46e5",
                  background: "#eef2ff",
                  fontWeight: 900,
                  cursor: busy === "add" ? "wait" : "pointer",
                  fontSize: 12,
                }}
              >
                {busy === "add" ? "추가 중…" : "+ Task 추가"}
              </button>
              {addMenuOpen ? (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 20,
                    top: 40,
                    left: 0,
                    minWidth: 240,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    padding: 10,
                    boxShadow: "0 8px 30px rgba(15,23,42,0.12)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void handleAddDraft()}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 12,
                      textAlign: "left",
                    }}
                  >
                    독립 노드로 추가
                  </button>
                  <button
                    type="button"
                    disabled={!selectedId}
                    onClick={() => {
                      const base = selectedId ? byId.get(selectedId) : null;
                      const bx = base?.positionX ?? 0;
                      const by = base?.positionY ?? 0;
                      const stage = normalizeStage(base?.stage);
                      void (async () => {
                        if (!selectedId) return;
                        setAddMenuOpen(false);
                        setBusy("add");
                        setMessage(null);
                        try {
                          const { res, json } = await postProjectTaskDraftCreate(projectId, {
                            specVersionId: currentSpecVersionId ?? "",
                            title: "새 Task",
                            description: null,
                            priority: "MEDIUM",
                            acceptanceCriteria: [],
                            positionX: bx + 340,
                            positionY: by,
                            dependsOnIds: [selectedId],
                            stage,
                          });
                          if (!res.ok || !json.success || !json.data) {
                            setMessage(json.message || "Task 초안 추가에 실패했습니다.");
                            return;
                          }
                          setSelectedId(json.data.id);
                          openEdit(json.data);
                          await loadDrafts();
                        } catch (e) {
                          console.error(e);
                          setMessage("Task 초안 추가 중 오류가 발생했습니다.");
                        } finally {
                          setBusy(null);
                        }
                      })();
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: selectedId ? "#fff" : "#f8fafc",
                      fontWeight: 800,
                      cursor: selectedId ? "pointer" : "not-allowed",
                      fontSize: 12,
                      textAlign: "left",
                      opacity: selectedId ? 1 : 0.65,
                    }}
                  >
                    선택 노드 “뒤(후속)”로 추가 (새 노드가 선택 노드에 의존)
                  </button>
                  <button
                    type="button"
                    disabled={!selectedId}
                    onClick={() => {
                      void (async () => {
                        if (!selectedId) return;
                        const base = byId.get(selectedId);
                        const bx = base?.positionX ?? 0;
                        const by = base?.positionY ?? 0;
                        const stage = normalizeStage(base?.stage);
                        setAddMenuOpen(false);
                        setBusy("add");
                        setMessage(null);
                        try {
                          const { res, json } = await postProjectTaskDraftCreate(projectId, {
                            specVersionId: currentSpecVersionId ?? "",
                            title: "새 Task",
                            description: null,
                            priority: "MEDIUM",
                            acceptanceCriteria: [],
                            positionX: bx - 340,
                            positionY: by,
                            dependsOnIds: [],
                            stage,
                          });
                          if (!res.ok || !json.success || !json.data) {
                            setMessage(json.message || "Task 초안 추가에 실패했습니다.");
                            return;
                          }
                          const cur = uniqueStrings((byId.get(selectedId)?.dependsOnIds ?? []).slice());
                          const next = uniqueStrings([...cur, json.data.id]);
                          await persistDependsOnIds(selectedId, next);
                          setSelectedId(json.data.id);
                          openEdit(json.data);
                          await loadDrafts();
                        } catch (e) {
                          console.error(e);
                          setMessage("Task 초안 추가 중 오류가 발생했습니다.");
                        } finally {
                          setBusy(null);
                        }
                      })();
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: selectedId ? "#fff" : "#f8fafc",
                      fontWeight: 800,
                      cursor: selectedId ? "pointer" : "not-allowed",
                      fontSize: 12,
                      textAlign: "left",
                      opacity: selectedId ? 1 : 0.65,
                    }}
                  >
                    선택 노드 “앞(선행)”으로 추가 (선택 노드가 새 노드에 의존)
                  </button>
                </div>
              ) : null}
            </div>
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
              data-testid="task-draft-auto-layout"
              disabled={busy === "layout" || drafts.length === 0}
              onClick={() => void handleAutoLayoutPersist()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #7c3aed",
                background: "#fff",
                fontWeight: 700,
                cursor: busy === "layout" ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {busy === "layout" ? "정렬 중…" : "자동 정렬"}
            </button>
            <button
              type="button"
              data-testid="task-draft-ai-reorder"
              disabled={busy === "ai-reorder" || drafts.length === 0}
              onClick={() => void handleAiReorder()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: "#0d9488",
                color: "#fff",
                fontWeight: 900,
                cursor: busy === "ai-reorder" ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {busy === "ai-reorder" ? "요청 중…" : "AI로 Workflow 재정렬"}
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
          </>
        ) : null}
      </div>
      {busy === "regen" ? (
        <p
          role="status"
          data-testid="task-draft-inline-ai-generate"
          data-ui-label="[F-1-3-5-s] Inline — Task draft AI generation"
          style={{ margin: "0 0 10px 0", fontSize: 13, fontWeight: 600, color: "#5b21b6" }}
        >
          AI가 현재 Spec 버전 기준으로 Task 초안을 생성하는 중입니다…
        </p>
      ) : null}

      {message ? (
        <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#4c1d95" }} role="status">
          {message}
        </p>
      ) : null}

      {aiSuggestion ? (
        <div
          data-testid="task-draft-ai-suggestion-banner"
          style={{
            margin: "0 0 10px 0",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #99f6e4",
            background: "#f0fdfa",
            color: "#134e4a",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            AI 추천 준비됨 {aiSuggestion.cycleDetected ? "(순환 감지: 의존성 변경 제외)" : ""}
          </div>
          <div style={{ marginBottom: 8, fontSize: 12, color: "#0f766e" }}>모델: {aiSuggestion.model}</div>
          <div style={{ marginBottom: 8, fontSize: 12, color: "#134e4a" }}>
            이유: {aiSuggestion.reason}
            {aiSuggestion.parallelGroups.length > 0 ? (
              <>
                <br />
                병렬 가능:{" "}
                {aiSuggestion.parallelGroups
                  .slice(0, 3)
                  .map((g) => g.slice(0, 3).join(" / "))
                  .join(" | ")}
              </>
            ) : null}
            {aiSuggestion.cycleProblemEdge ? (
              <>
                <br />
                cycle edge: {aiSuggestion.cycleProblemEdge.source} → {aiSuggestion.cycleProblemEdge.target}
              </>
            ) : aiSuggestion.cycleCandidateEdges && aiSuggestion.cycleCandidateEdges.length > 0 ? (
              <>
                <br />
                잠재 cycle edge 후보:{" "}
                {aiSuggestion.cycleCandidateEdges
                  .slice(0, 3)
                  .map((e) => `${e.source}→${e.target}`)
                  .join(", ")}
              </>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy === "apply-ai"}
              onClick={() => void applyAiSuggestion()}
              style={{
                padding: "8px 12px",
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
                padding: "8px 12px",
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
            margin: "0 0 10px 0",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>워크플로우가 유효하지 않습니다</div>
          {validation.cycle ? (
            <div style={{ marginBottom: 6 }}>
              - <strong>순환(cycle)</strong> 감지됨: {validation.cycle.cyclePath.slice(0, 8).join(" → ")}
            </div>
          ) : null}
          {validation.missingDepEdges.length > 0 ? (
            <div>
              - <strong>누락 의존성</strong> {validation.missingDepEdges.length}개 (삭제된 노드를 가리키는 연결이 있습니다)
            </div>
          ) : null}
          <div style={{ marginTop: 6, fontSize: 12 }}>
            유효하지 않은 상태에서는 확정(→Task)을 차단합니다.
          </div>
        </div>
      ) : null}

      <div
        style={{
          margin: "0 0 10px 0",
          padding: 10,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
          fontSize: 12,
          color: "#334155",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span>시작 가능 노드: {validation.startIds.length}</span>
        <span>끝 노드: {validation.terminalIds.length}</span>
        <span>고립 노드: {validation.isolatedIds.length}</span>
        <span>READY: {[...workflowStatusById.values()].filter((s) => s === "READY").length}</span>
        <span>BLOCKED: {[...workflowStatusById.values()].filter((s) => s === "BLOCKED").length}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, alignItems: "start" }}>
        <div
          data-testid="task-draft-workflow-canvas"
          style={{
            borderRadius: 12,
            border: "1px solid #ddd6fe",
            background: "#fff",
            height: 520,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Swimlanes */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(180deg, rgba(2,132,199,0.06) 0%, rgba(2,132,199,0.00) 18%, rgba(99,102,241,0.06) 20%, rgba(99,102,241,0.00) 38%, rgba(16,185,129,0.06) 40%, rgba(16,185,129,0.00) 58%, rgba(245,158,11,0.06) 60%, rgba(245,158,11,0.00) 78%, rgba(239,68,68,0.05) 80%, rgba(239,68,68,0.00) 100%)",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 8,
              left: 10,
              zIndex: 1,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              fontSize: 11,
              fontWeight: 900,
              color: "#475569",
            }}
          >
            {WORKFLOW_STAGES.map((s) => (
              <span key={s} style={{ padding: "2px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                {s}
              </span>
            ))}
          </div>
          {drafts.length === 0 && !loading ? (
            <div style={{ padding: 14, fontSize: 13, color: "#6b21b6" }}>
              아직 DRAFT 초안이 없습니다. Project Spec을 확정하면 자동 생성되거나, 위 버튼으로 수동 생성할 수 있습니다.
            </div>
          ) : (
            <ReactFlow
              nodeTypes={nodeTypes}
              nodes={nodes}
              edges={edges}
              style={{ position: "relative", zIndex: 2 }}
              onConnect={(c) => void handleConnect(c)}
              onNodeClick={(_, n) => {
                setSelectedId(n.id);
                const d = byId.get(n.id);
                if (d) openEdit(d);
              }}
              onNodeDragStop={(_, n) => void handleNodeDragStop(n)}
              onEdgeClick={(_, e) => void handleDeleteEdge(e)}
              fitView
            >
              <Background />
              <MiniMap />
              <Controls />
            </ReactFlow>
          )}
        </div>

        <aside
          data-testid="task-draft-detail-panel"
          style={{
            borderRadius: 12,
            border: "1px solid #ddd6fe",
            background: "#fff",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#1e1b4b" }}>Detail</div>
            {editing ? <div style={{ fontSize: 12, color: "#64748b" }}>Spec v{editing.specVersionNumber}</div> : null}
          </div>

          {!editing ? (
            <p style={{ margin: "10px 0 0 0", fontSize: 13, color: "#64748b" }}>
              노드를 클릭하면 세부 정보를 수정할 수 있습니다. 연결(선행)은 노드에서 드래그로 만들고, 엣지를 클릭하면 삭제됩니다.
            </p>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                  }}
                >
                  {workflowStatusById.get(editing.id) ?? "DRAFT"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                  }}
                >
                  stage: {normalizeStage(editing.stage)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: editing.createdByType === "USER" ? "#fff7ed" : "#eff6ff",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                  }}
                >
                  {editing.createdByType === "USER" ? "사용자 추가" : "AI 생성"}
                </span>
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>제목</span>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>우선순위</span>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Stage (Lane)</span>
                <select
                  value={normalizeStage(editing.stage)}
                  disabled={!canEdit || busy === "stage"}
                  onChange={(e) => void handleStageChange(normalizeStage(e.target.value))}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  {WORKFLOW_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>설명</span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={5}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>수용 기준(줄바꿈 = 항목)</span>
                <textarea
                  value={editCriteria}
                  onChange={(e) => setEditCriteria(e.target.value)}
                  rows={6}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  disabled={busy === "save-edit"}
                  onClick={() => void saveEdit()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
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
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  닫기
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
                        borderRadius: 8,
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
                        borderRadius: 8,
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
            </div>
          )}

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: "#1e1b4b", marginBottom: 8 }}>
              실행 순서 미리보기 (DAG)
            </div>
            {executionLevels.length === 0 ? (
              <div style={{ fontSize: 12, color: "#64748b" }}>DRAFT 노드가 없습니다.</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                {executionLevels.slice(0, 12).map((level, idx) => (
                  <li key={idx} style={{ fontSize: 12, color: "#334155", lineHeight: 1.4 }}>
                    {level
                      .map((id) => byId.get(id)?.title ?? id.slice(0, 8))
                      .slice(0, 6)
                      .join(" / ")}
                    {level.length > 6 ? ` 외 ${level.length - 6}개` : ""}
                  </li>
                ))}
              </ol>
            )}
            {validation.isolatedIds.length > 0 ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "#b45309" }}>
                고립 노드 {validation.isolatedIds.length}개 (연결 없음): 확정 전 흐름에 포함되는지 확인하세요.
              </div>
            ) : null}
          </div>
        </aside>
      </div>

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
