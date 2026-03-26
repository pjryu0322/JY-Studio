"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MiniMap,
  type Connection,
  type Edge,
  type Node,
} from "reactflow";
import dagre from "dagre";

import "reactflow/dist/style.css";

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
  const [aiSuggestion, setAiSuggestion] = useState<
    | null
    | {
        cycleDetected: boolean;
        tasks: Array<{ id: string; dependsOnIds?: string[]; positionX: number; positionY: number }>;
        model: string;
      }
  >(null);

  const loadDrafts = useCallback(async () => {
    if (!projectId) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { res, json } = await fetchProjectTaskDrafts(projectId, { status: "DRAFT" });
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

  const nodes: Node[] = useMemo(() => {
    return drafts.map((d) => ({
      id: d.id,
      position: { x: d.positionX ?? 0, y: d.positionY ?? 0 },
      data: {
        title: d.title,
        priority: d.priority,
      },
      style: {
        border: selectedId === d.id ? "2px solid #7c3aed" : "1px solid #ddd6fe",
        borderRadius: 10,
        padding: 10,
        background: "#fff",
        width: 260,
        boxShadow: selectedId === d.id ? "0 2px 12px rgba(124,58,237,0.25)" : "none",
      },
    }));
  }, [drafts, selectedId]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const d of drafts) {
      for (const depId of d.dependsOnIds ?? []) {
        if (!byId.has(depId)) continue;
        out.push({
          id: `${depId}__to__${d.id}`,
          source: depId,
          target: d.id,
          type: "smoothstep",
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
    const next = [...new Set([...cur, conn.source])];
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
            <button
              type="button"
              data-testid="task-draft-add"
              disabled={busy === "add"}
              onClick={() => void handleAddDraft()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #4f46e5",
                background: "#eef2ff",
                fontWeight: 800,
                cursor: busy === "add" ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {busy === "add" ? "추가 중…" : "+ Task 초안 추가"}
            </button>
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
              disabled={busy === "confirm-all" || drafts.length === 0}
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, alignItems: "start" }}>
        <div
          data-testid="task-draft-workflow-canvas"
          style={{
            borderRadius: 12,
            border: "1px solid #ddd6fe",
            background: "#fff",
            height: 520,
            overflow: "hidden",
          }}
        >
          {drafts.length === 0 && !loading ? (
            <div style={{ padding: 14, fontSize: 13, color: "#6b21b6" }}>
              아직 DRAFT 초안이 없습니다. Project Spec을 확정하면 자동 생성되거나, 위 버튼으로 수동 생성할 수 있습니다.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
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
        </aside>
      </div>
    </div>
  );
}
