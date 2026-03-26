"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteProjectTaskDraft,
  fetchProjectTaskDrafts,
  patchProjectTaskDraft,
  postProjectTaskDraftsConfirm,
  postProjectTaskDraftsGenerate,
} from "@/components/project-spec/api";
import { formatTestedAt } from "@/components/project-spec/format";
import type { TaskDraftDto, TaskDraftSyncResultDto } from "@/components/project-spec/types";
import { LabelTag } from "@/components/ui/LabelTag";
import type { SpecWorkspaceAiModelId } from "@/lib/project-spec/specWorkspaceModels";

type TaskDraftPanelProps = {
  projectId: string;
  canEdit: boolean;
  selectedModel: SpecWorkspaceAiModelId;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskDraftDto | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editCriteria, setEditCriteria] = useState("");

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
    setEditCriteria(d.acceptanceCriteria.join("\n"));
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

      <p style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 700, color: "#4c1d95" }}>
        DRAFT {drafts.length}개
        {drafts[0]?.sourceModel ? ` · 모델: ${drafts[0].sourceModel}` : ""}
      </p>

      {drafts.length === 0 && !loading ? (
        <p style={{ margin: 0, fontSize: 13, color: "#6b21a8" }}>
          아직 DRAFT 초안이 없습니다. Project Spec을 확정하면 자동 생성되거나, 위 버튼으로 수동 생성할 수 있습니다.
        </p>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {drafts.map((d) => {
          const exp = expandedId === d.id;
          const b = busy?.startsWith(`confirm-${d.id}`) || busy === `del-${d.id}`;
          return (
            <li
              key={d.id}
              data-testid={`task-draft-row-${d.id}`}
              style={{
                borderRadius: 10,
                border: "1px solid #ddd6fe",
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Spec v{d.specVersionNumber} · {formatTestedAt(d.createdAt)} · 우선순위 {d.priority}
                  </div>
                  <strong style={{ fontSize: 14, color: "#1e1b4b" }}>{d.title}</strong>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(exp ? null : d.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {exp ? "접기" : "Task 초안 보기"}
                  </button>
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #a78bfa",
                          background: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        data-testid={`task-draft-confirm-one-${d.id}`}
                        disabled={b}
                        onClick={() => void handleConfirmOne(d.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #15803d",
                          background: "#dcfce7",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: b ? "wait" : "pointer",
                        }}
                      >
                        확정
                      </button>
                      <button
                        type="button"
                        disabled={b}
                        onClick={() => void handleDelete(d.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #b91c1c",
                          background: "#fef2f2",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: b ? "wait" : "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              {exp ? (
                <div style={{ marginTop: 10, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 800 }}>설명</span>
                    <div style={{ whiteSpace: "pre-wrap" }}>{d.description || "(없음)"}</div>
                  </div>
                  {d.dependsOn.length > 0 ? (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 800 }}>선행(Task 제목)</span>
                      <ul style={{ margin: "4px 0 0 18px" }}>
                        {d.dependsOn.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {d.acceptanceCriteria.length > 0 ? (
                    <div>
                      <span style={{ fontWeight: 800 }}>수용 기준</span>
                      <ul style={{ margin: "4px 0 0 18px" }}>
                        {d.acceptanceCriteria.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {editing ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            border: "2px solid #8b5cf6",
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>초안 수정</div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>제목</label>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: 8, marginBottom: 8, borderRadius: 6 }}
          />
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>설명</label>
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", padding: 8, marginBottom: 8, borderRadius: 6 }}
          />
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>우선순위</label>
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            style={{ padding: 6, marginBottom: 8, borderRadius: 6 }}
          >
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            수용 기준 (줄바꿈으로 구분)
          </label>
          <textarea
            value={editCriteria}
            onChange={(e) => setEditCriteria(e.target.value)}
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", padding: 8, marginBottom: 8, borderRadius: 6 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={busy === "save-edit"}
              onClick={() => void saveEdit()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #7c3aed",
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 700,
                cursor: busy === "save-edit" ? "wait" : "pointer",
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f1f5f9",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
