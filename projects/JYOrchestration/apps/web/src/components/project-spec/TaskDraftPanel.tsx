"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProjectTaskDrafts,
  postProjectTaskDraftsGenerate,
  fetchProjectTaskGenerationPrompt,
  patchProjectTaskGenerationPrompt,
} from "@/components/project-spec/api";
import type { TaskDraftSyncResultDto } from "@/components/project-spec/types";
import { WorkspaceLabelBadge } from "@/components/project-spec/WorkspaceLabelBadge";
import { WORKSPACE_SECTION_META } from "@/components/project-spec/workspaceSectionMeta";
import type { SpecWorkspaceAiModelId } from "@/lib/project-spec/specWorkspaceModels";

export type TaskDraftWorkflowExecutionProps = {
  hasPrimaryTasksForCurrentSpec: boolean;
  canRunExecution: boolean;
  execSetupReady: boolean;
  executionLoopBusy: boolean;
  onStartExecution: () => void;
};

type TaskDraftPanelProps = {
  projectId: string;
  canEdit: boolean;
  selectedModel: SpecWorkspaceAiModelId;
  currentSpecVersionId: string | null;
  refreshKey: number;
  lastAutoSync: TaskDraftSyncResultDto | null;
  workflowExecution: TaskDraftWorkflowExecutionProps;
  onAfterTaskDraftsGenerate?: () => void | Promise<void>;
};

export function TaskDraftPanel({
  projectId,
  canEdit,
  selectedModel,
  currentSpecVersionId,
  refreshKey,
  lastAutoSync,
  workflowExecution,
  onAfterTaskDraftsGenerate,
}: TaskDraftPanelProps) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [taskGenerationPromptText, setTaskGenerationPromptText] = useState<string>("");
  const [promptDefaultText, setPromptDefaultText] = useState<string>("");
  const [promptError, setPromptError] = useState<string | null>(null);

  const loadDrafts = useCallback(
    async (opts?: { clearMessage?: boolean }) => {
      if (!projectId) return;
      const clearMessage = opts?.clearMessage !== false;
      if (clearMessage) setMessage(null);
      setLoading(true);
      try {
        const { res, json } = await fetchProjectTaskDrafts(projectId);
        if (!res.ok || !json.success || !json.data) {
          setMessage(json.message || "Task 초안을 불러오지 못했습니다.");
          return;
        }
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
    if (!promptModalOpen || !projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        setPromptLoading(true);
        setPromptError(null);
        const { res, json } = await fetchProjectTaskGenerationPrompt(projectId);
        if (!res.ok || !json.success || !json.data) {
          if (!cancelled) setPromptError(json.message || "프롬프트를 불러오지 못했습니다.");
          return;
        }
        if (cancelled) return;
        setPromptDefaultText(json.data.defaultPrompt);
        setTaskGenerationPromptText(
          json.data.taskGenerationPrompt ?? json.data.defaultPrompt
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) setPromptError("프롬프트 조회 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setPromptLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [promptModalOpen, projectId]);

  async function handleRegenerate() {
    if (!projectId) return;
    if (!canEdit) {
      setMessage("Task 생성·확정은 편집 권한이 있는 멤버만 수행할 수 있습니다.");
      return;
    }
    const specVersionIdForApi = String(currentSpecVersionId ?? "").trim() || undefined;
    setBusy("regen");
    setMessage(null);
    try {
      const payload = {
        model: selectedModel,
        mode: "regenerate" as const,
        ...(specVersionIdForApi ? { specVersionId: specVersionIdForApi } : {}),
      };

      const { res, json } = await postProjectTaskDraftsGenerate(projectId, payload);
      if (!res.ok || !json.success) {
        setMessage(json.message || "Task 초안 재생성에 실패했습니다.");
        return;
      }
      setMessage(json.message ?? null);
      await loadDrafts({ clearMessage: false });
      await onAfterTaskDraftsGenerate?.();
    } catch (e) {
      console.error(e);
      setMessage("Task 초안 재생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveTaskGenerationPromptOnly(): Promise<boolean> {
    if (!projectId) return false;
    if (!canEdit) {
      setPromptError("프롬프트 편집 권한이 없습니다.");
      return false;
    }
    setPromptSaving(true);
    setPromptError(null);
    try {
      const next = taskGenerationPromptText ?? "";
      const { res, json } = await patchProjectTaskGenerationPrompt(projectId, {
        taskGenerationPrompt: next,
      });
      if (!res.ok || !json.success) {
        setPromptError(json.message || "프롬프트 저장에 실패했습니다.");
        return false;
      }
      setPromptError(null);
      return true;
    } catch (e) {
      console.error(e);
      setPromptError("프롬프트 저장 중 오류가 발생했습니다.");
      return false;
    } finally {
      setPromptSaving(false);
    }
  }

  async function handleSaveTaskGenerationPromptAndGenerate() {
    const ok = await handleSaveTaskGenerationPromptOnly();
    if (!ok) return;
    if (!canEdit) return;
    await handleRegenerate();
  }

  const hasTasks = workflowExecution.hasPrimaryTasksForCurrentSpec;
  const primaryDisabled = !canEdit || busy === "regen" || loading;

  return (
    <>
      <div
        data-testid="task-draft-panel"
        data-has-last-auto-sync={lastAutoSync ? "true" : "false"}
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #c4b5fd",
          background: "#faf5ff",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <WorkspaceLabelBadge section="taskDrafts" />
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1e1b4b" }}>
            {WORKSPACE_SECTION_META.taskDrafts.title}
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>실행 워크플로</div>

        {hasTasks ? (
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.45 }}>
            Task가 생성되었습니다.
          </div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.45 }}>
            현재 확정된 실행 계획에 Task가 없습니다.
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            data-testid="task-draft-regenerate"
            disabled={primaryDisabled}
            onClick={() => void handleRegenerate()}
            style={{
              padding: "12px 22px",
              borderRadius: 10,
              border: "1px solid #0f766e",
              background: primaryDisabled ? "#e2e8f0" : "#0d9488",
              color: primaryDisabled ? "#94a3b8" : "#fff",
              fontWeight: 900,
              fontSize: 15,
              cursor: primaryDisabled ? "not-allowed" : "pointer",
              boxShadow: primaryDisabled ? "none" : "0 2px 8px rgba(13,148,136,0.25)",
            }}
          >
            {busy === "regen" ? "생성·확정 중…" : "AI로 Task 생성 및 확정"}
          </button>
          <button
            type="button"
            data-testid="task-draft-prompt-open"
            onClick={() => setPromptModalOpen(true)}
            disabled={promptLoading}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #a5b4fc",
              background: promptLoading ? "#e2e8f0" : "#eef2ff",
              color: promptLoading ? "#94a3b8" : "#3730a3",
              fontWeight: 900,
              fontSize: 15,
              cursor: promptLoading ? "not-allowed" : "pointer",
            }}
          >
            프롬프트 보기
          </button>
        </div>

        {message ? (
          <div role="status" style={{ marginTop: 12, fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
            {message}
          </div>
        ) : null}
      </div>

      {promptModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.55)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPromptModalOpen(false);
          }}
        >
          <div
            style={{
              width: "min(980px, 96vw)",
              maxHeight: "84vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #c4b5fd",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 950, color: "#0f172a" }}>Task 생성 프롬프트</div>
              <button
                type="button"
                onClick={() => setPromptModalOpen(false)}
                disabled={promptSaving || promptLoading}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: promptSaving || promptLoading ? "#f1f5f9" : "#fff",
                  color: "#334155",
                  fontWeight: 800,
                  cursor: promptSaving || promptLoading ? "not-allowed" : "pointer",
                }}
              >
                닫기
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, color: "#64748b" }}>
              {"{{projectName}}, {{projectType}}, {{projectDescription}}, {{specMarkdown}}"} 는 생성 시 서버에서
              치환됩니다. 저장하지 않은 내용은 「AI로 Task 생성 및 확정」에 반영되지 않습니다.
            </div>

            <div style={{ marginTop: 12 }}>
              <textarea
                value={taskGenerationPromptText}
                onChange={(e) => setTaskGenerationPromptText(e.target.value)}
                disabled={!canEdit || promptSaving || promptLoading}
                style={{
                  width: "100%",
                  minHeight: 320,
                  resize: "vertical",
                  borderRadius: 12,
                  border: "1px solid #dbeafe",
                  padding: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "#0f172a",
                  background: !canEdit ? "#f8fafc" : "#fff",
                  outline: "none",
                }}
              />
              {promptLoading ? (
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>프롬프트를 불러오는 중…</div>
              ) : null}
              {promptError ? (
                <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13, fontWeight: 800 }}>{promptError}</div>
              ) : null}
            </div>

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                disabled={!canEdit || promptSaving || promptLoading}
                onClick={() => void handleSaveTaskGenerationPromptOnly()}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid #a5b4fc",
                  background: !canEdit || promptSaving || promptLoading ? "#e2e8f0" : "#eef2ff",
                  color: !canEdit || promptSaving || promptLoading ? "#94a3b8" : "#3730a3",
                  fontWeight: 950,
                  cursor: !canEdit || promptSaving || promptLoading ? "not-allowed" : "pointer",
                }}
              >
                저장
              </button>
              <button
                type="button"
                disabled={!canEdit || promptSaving || promptLoading}
                onClick={() => void handleSaveTaskGenerationPromptAndGenerate()}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid #0f766e",
                  background: !canEdit || promptSaving || promptLoading ? "#e2e8f0" : "#0d9488",
                  color: !canEdit || promptSaving || promptLoading ? "#94a3b8" : "#fff",
                  fontWeight: 950,
                  cursor: !canEdit || promptSaving || promptLoading ? "not-allowed" : "pointer",
                  boxShadow: !canEdit || promptSaving || promptLoading ? "none" : "0 2px 8px rgba(13,148,136,0.25)",
                }}
              >
                저장 후 실행
              </button>
              <button
                type="button"
                disabled={promptSaving || promptLoading}
                onClick={() => {
                  setTaskGenerationPromptText(promptDefaultText);
                  setPromptError(null);
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#f8fafc",
                  color: "#475569",
                  fontWeight: 800,
                  cursor: promptSaving || promptLoading ? "not-allowed" : "pointer",
                }}
              >
                권장 기본값으로 되돌리기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
