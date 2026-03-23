"use client";

import type { ChangeEvent, CSSProperties, DragEvent } from "react";
import { useMemo, useState } from "react";
import { TaskItem } from "@/components/project-spec/types";
import { formatTestedAt } from "@/components/project-spec/format";
import {
  deriveTaskFlowStatus,
  taskFlowBadgeColors,
  taskFlowStatusLabel,
} from "@/lib/ui/taskFlowPresentation";

function parseAutoHealingMeta(task: {
  name: string;
  changeReason: string | null;
  taskKind: string;
}): { failureType?: string; strategy?: string } {
  if (task.taskKind !== "AUTO_HEALING") return {};

  // New format: AUTO_HEALING:<failureTypeKey>:<strategy>:<jobId>
  if (task.changeReason?.startsWith("AUTO_HEALING:")) {
    const parts = task.changeReason.split(":");
    if (parts.length >= 4) {
      return { failureType: parts[1], strategy: parts[2] };
    }
    // Legacy format: AUTO_HEALING:<failureTypeKey>:<jobId>
    if (parts.length === 3) {
      return { failureType: parts[1] };
    }
  }

  // Name format (Phase 5-2): [AUTO][STRATEGY] Recover from FAILURE_TYPE
  const m1 = task.name.match(/^\[AUTO\]\[([^\]]+)\]\s*Recover from\s+(.+)$/);
  if (m1) {
    return { strategy: m1[1], failureType: m1[2] };
  }

  // Name format (legacy): [AUTO] Recover from FAILURE_TYPE
  const m2 = task.name.match(/^\[AUTO\]\s*Recover from\s+(.+)$/);
  if (m2) {
    return { failureType: m2[1] };
  }

  return {};
}

export type TaskPromptItem = {
  id: string;
  taskId: string;
  projectId: string;
  promptText: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskRunItem = {
  id: string;
  taskId: string;
  taskPromptId: string;
  status: string;
  resultText: string | null;
  /** 구조화 실행 결과 (API가 내려줄 때만 존재) */
  resultJson?: unknown;
  createdAt: string;
  updatedAt: string;
};

export type TaskFollowUpDraft = {
  sourceTaskId: string;
  name: string;
  description: string;
  changeReason: string;
};

export type GitChangeRequestFileItem = {
  path: string;
  type: "MODIFY" | "CREATE";
};

export type GitChangeRequestItem = {
  id: string;
  projectId: string;
  taskId: string;
  taskRunId: string;
  /** 승인 정책만 (push와 무관) */
  gitApprovalMode?: string;
  /** push 기본값 정책만 (승인과 무관) */
  gitPushMode?: string;
  rejectionReason?: string | null;
  status: string;
  requestNote: string | null;
  files: GitChangeRequestFileItem[] | null;
  diffText: string | null;
  commitMessage: string | null;
  applyStatus: string | null;
  applyLog: string | null;
  latestExecutionJobId?: string | null;
  branchName?: string | null;
  applyStartedAt?: string | null;
  applyFinishedAt?: string | null;
  retryCount?: number;
  lastError?: string | null;
  lastRetryAt?: string | null;
  pullRequestUrl?: string | null;
  pullRequestNumber?: number | null;
  pullRequestState?: string | null;
  reviewStatus?: string | null;
  mergedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskListSectionProps = {
  tasks: TaskItem[];
  loadingTasks: boolean;
  loadingTaskPrompts: boolean;
  loadingTaskRuns: boolean;
  promptMessage: string | null;
  generatingPromptTaskId: string | null;
  taskPromptMap: Record<string, TaskPromptItem>;
  runningPromptId: string | null;
  markingReadyTaskId: string | null;
  registeringGitRequestRunId: string | null;
  taskRunMap: Record<string, TaskRunItem>;
  canGeneratePrompt: boolean;
  canRunTask: boolean;
  canMarkReadyForGit: boolean;
  canRegisterGitRequest: boolean;
  canReorderTasks: boolean;
  reorderSaving: boolean;
  abortingTaskId: string | null;
  blockingTaskId: string | null;
  unblockingTaskId: string | null;
  forceCompletingTaskId: string | null;
  onGeneratePrompt: (taskId: string) => void;
  onRunTask: (taskId: string) => void;
  onMarkReadyForGit: (taskId: string) => void;
  onRegisterGitRequest: (taskId: string) => void;
  onViewTaskHistory: (taskId: string) => void;
  onReorderTasks: (orderedTaskIds: string[]) => void;
  onAbortRun: (taskId: string) => void;
  onForceCompleteRun: (taskId: string) => void;
  onBlockTask: (taskId: string) => void;
  onUnblockTask: (taskId: string) => void;
  canCreateFollowUp: boolean;
  followUpDraft: TaskFollowUpDraft | null;
  followUpSaving: boolean;
  onRequestFollowUp: (taskId: string) => void;
  onFollowUpDraftChange: (draft: TaskFollowUpDraft) => void;
  onCancelFollowUp: () => void;
  onSubmitFollowUp: () => void;
};

const btnBase: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};

export function TaskListSection({
  tasks,
  loadingTasks,
  loadingTaskPrompts,
  loadingTaskRuns,
  promptMessage,
  generatingPromptTaskId,
  taskPromptMap,
  runningPromptId,
  markingReadyTaskId,
  registeringGitRequestRunId,
  taskRunMap,
  canGeneratePrompt,
  canRunTask,
  canMarkReadyForGit,
  canRegisterGitRequest,
  canReorderTasks,
  reorderSaving,
  abortingTaskId,
  blockingTaskId,
  unblockingTaskId,
  forceCompletingTaskId,
  onGeneratePrompt,
  onRunTask,
  onMarkReadyForGit,
  onRegisterGitRequest,
  onViewTaskHistory,
  onReorderTasks,
  onAbortRun,
  onForceCompleteRun,
  onBlockTask,
  onUnblockTask,
  canCreateFollowUp,
  followUpDraft,
  followUpSaving,
  onRequestFollowUp,
  onFollowUpDraftChange,
  onCancelFollowUp,
  onSubmitFollowUp,
}: TaskListSectionProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [tasks]
  );

  function handleDragStart(e: React.DragEvent, taskId: string) {
    if (!canReorderTasks || reorderSaving) {
      e.preventDefault();
      return;
    }
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  }

  function handleDragOver(e: React.DragEvent, taskId: string) {
    if (!canReorderTasks || reorderSaving) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(taskId);
  }

  function handleDragLeaveLi(e: DragEvent<HTMLLIElement>) {
    const rel = e.relatedTarget as Node | null;
    if (rel && e.currentTarget.contains(rel)) {
      return;
    }
    setDragOverId(null);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!canReorderTasks || reorderSaving) {
      return;
    }
    const sourceId = e.dataTransfer.getData("text/plain") || draggingId;
    setDragOverId(null);
    setDraggingId(null);
    if (!sourceId || sourceId === targetId) {
      return;
    }
    const ids = sortedTasks.map((t) => t.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      return;
    }
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorderTasks(next);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
  }

  return (
    <section
      style={{
        borderTop: "1px solid #e5e5e5",
        marginTop: 16,
        paddingTop: 12,
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px 0" }}>Task 실행 흐름</h3>
      <p style={{ margin: "0 0 10px 0", color: "#555", fontSize: 14, lineHeight: 1.55 }}>
        번호는 저장된 <strong>order</strong> 기준 실행 순서입니다. 배지는 Task.status·프롬프트·최신 Run·클라이언트
        실행 상태를 함께 봅니다 (TODO / READY / RUNNING / DONE / FAILED / BLOCKED / CANCELLED). 감사 이력은 읽기
        전용입니다.
      </p>
      {canReorderTasks ? (
        <p style={{ margin: "0 0 10px 0", color: "#37474f", fontSize: 13, lineHeight: 1.5 }}>
          <strong>순서 변경:</strong> 왼쪽 ⋮⋮ 핸들을 잡아 다른 행 위에 놓으면{" "}
          <code style={{ fontSize: 12 }}>POST /api/task/reorder</code>로 저장됩니다 (OPERATOR·REVIEWER·OWNER,
          실행 권한과 동일).
        </p>
      ) : null}
      {canRunTask ? (
        <p style={{ margin: "0 0 10px 0", color: "#37474f", fontSize: 13, lineHeight: 1.5 }}>
          <strong>실행 제어:</strong> 흐름 상태에 따라 실행·중단·재시도·강제완료·승인(Git 준비)·차단/해제가
          표시됩니다. 제어 결과는 Task 감사 이력에 기록됩니다.
        </p>
      ) : null}
      {promptMessage ? <p style={{ margin: "0 0 8px 0", color: "#333" }}>{promptMessage}</p> : null}
      {reorderSaving ? (
        <p style={{ margin: "0 0 8px 0", color: "#1565c0", fontSize: 14 }}>순서를 저장하는 중...</p>
      ) : null}
      {loadingTaskPrompts ? (
        <p style={{ margin: "0 0 8px 0", color: "#555" }}>Task 프롬프트를 불러오는 중...</p>
      ) : null}
      {loadingTaskRuns ? <p style={{ margin: "0 0 8px 0", color: "#555" }}>Task 실행 이력을 불러오는 중...</p> : null}
      {loadingTasks ? (
        <p style={{ margin: 0, color: "#555" }}>Task 목록을 불러오는 중...</p>
      ) : tasks.length === 0 ? (
        <p style={{ margin: 0, color: "#555" }}>아직 생성된 Task가 없습니다.</p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {sortedTasks.map((task, index) => {
            const prompt = taskPromptMap[task.id];
            const run = taskRunMap[task.id];
            const flow = deriveTaskFlowStatus({
              taskStatus: task.status,
              prompt,
              run,
              isRunningClient: Boolean(prompt && runningPromptId === prompt.id),
            });
            const runDisabled =
              !taskPromptMap[task.id] ||
              runningPromptId === taskPromptMap[task.id]?.id ||
              task.status === "BLOCKED";
            const runLabel = (() => {
              const p = taskPromptMap[task.id];
              if (!p) {
                return "실행";
              }
              if (runningPromptId === p.id) {
                return "실행 중...";
              }
              if (flow === "FAILED") {
                return "재시도";
              }
              if (flow === "TODO" || flow === "READY" || flow === "CANCELLED") {
                return "실행";
              }
              return "Run 실행";
            })();
            const taskKind = task.taskKind ?? "PRIMARY";
            const parentName = task.parentTaskId
              ? sortedTasks.find((t) => t.id === task.parentTaskId)?.name ?? task.parentTaskId
              : null;
            const autoMeta = parseAutoHealingMeta({
              name: task.name,
              changeReason: task.changeReason,
              taskKind,
            });
            const runMeta = taskRunMap[task.id]?.resultJson as unknown as
              | { autoExecution?: boolean; initiatedBy?: string }
              | undefined;
            const autoRunConnected = Boolean(runMeta?.autoExecution === true);
            const badge = taskFlowBadgeColors(flow);
            const flowLabel = taskFlowStatusLabel(flow);
            const isDragOver = dragOverId === task.id && draggingId !== task.id;
            const isDragging = draggingId === task.id;

            const isAutoHealing = taskKind === "AUTO_HEALING";
            const parentTaskButton =
              isAutoHealing && task.parentTaskId ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`task-li-${task.parentTaskId}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#dbeafe",
                    color: "#1d4ed8",
                    border: "1px solid #93c5fd",
                    cursor: "pointer",
                    marginLeft: 8,
                  }}
                >
                  🔗 원본 Task 보기
                </button>
              ) : null;

            return (
              <li
                key={task.id}
                id={`task-li-${task.id}`}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragLeave={handleDragLeaveLi}
                onDrop={(e) => handleDrop(e, task.id)}
                style={{
                  display: "flex",
                  gap: 0,
                  alignItems: "stretch",
                  marginBottom: index === sortedTasks.length - 1 ? 0 : 10,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 4,
                    flexShrink: 0,
                    background: "linear-gradient(180deg, #00897b 0%, #4db6ac 100%)",
                    borderRadius: 4,
                    opacity: 0.85,
                  }}
                  aria-hidden
                />
                <div
                  draggable={canReorderTasks && !reorderSaving}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    handleDragStart(e, task.id);
                  }}
                  onDragEnd={handleDragEnd}
                  title={canReorderTasks && !reorderSaving ? "드래그하여 순서 변경" : undefined}
                  style={{
                    width: 28,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#fafafa",
                    border: "1px solid #e0e0e0",
                    borderLeft: "none",
                    borderRadius: "0 0 0 0",
                    cursor: canReorderTasks && !reorderSaving ? "grab" : "default",
                    color: "#78909c",
                    fontSize: 14,
                    userSelect: "none",
                  }}
                >
                  ⋮⋮
                </div>
                <div
                  style={{
                    flex: 1,
                    border: isDragOver ? "2px dashed #00897b" : "1px solid #e0e0e0",
                    borderLeft: "none",
                    borderRadius: "0 8px 8px 0",
                    padding: 12,
                    background: isDragging ? "#f5f5f5" : "#fff",
                    opacity: isDragging ? 0.92 : 1,
                    transition: "border-color 0.12s ease, background 0.12s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 28,
                        height: 28,
                        padding: "0 8px",
                        borderRadius: 8,
                        background: "#263238",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {index + 1}
                    </span>
                    <strong style={{ fontSize: 16, flex: "1 1 160px" }}>
                      {isAutoHealing ? "⚙️ " : null}
                      {isAutoHealing && autoMeta.strategy ? (
                        <span>
                          [{autoMeta.strategy}] {" "}
                          {`Recover from ${autoMeta.failureType ?? "UNKNOWN"}`}
                        </span>
                      ) : isAutoHealing && autoMeta.failureType ? (
                        <span>{`[AUTO] Recover from ${autoMeta.failureType}`}</span>
                      ) : (
                        task.name
                      )}
                      {!isAutoHealing ? task.name : null}
                    </strong>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        padding: "4px 10px",
                        borderRadius: 999,
                        ...badge,
                      }}
                    >
                      {flowLabel}
                    </span>
                    {taskKind === "FOLLOW_UP" ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "#ede7f6",
                          color: "#4527a0",
                          border: "1px solid #b39ddb",
                        }}
                      >
                        FOLLOW-UP
                      </span>
                    ) : null}
                    {taskKind === "AUTO_HEALING" ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: 0.6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "#e3f2fd",
                          color: "#1565c0",
                          border: "1px solid #90caf9",
                        }}
                      >
                        ⚙ {autoMeta.strategy ? `[${autoMeta.strategy}]` : "[AUTO]"}
                      </span>
                    ) : null}
                    {taskKind === "AUTO_HEALING" && autoRunConnected ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: 0.6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "#f1f5f9",
                          color: "#0f172a",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        ⚡ AUTO-RUN
                      </span>
                    ) : null}
                    {parentTaskButton}
                    <span style={{ fontSize: 12, color: "#78909c" }}>
                      DB status: <code style={{ fontSize: 12 }}>{task.status}</code>
                    </span>
                  </div>
                  {taskKind === "FOLLOW_UP" && parentName ? (
                    <p style={{ margin: "0 0 6px 0", fontSize: 13, color: "#5e35b1" }}>
                      <strong>원본 Task:</strong> {parentName}
                    </p>
                  ) : null}
                  {taskKind === "FOLLOW_UP" && task.changeReason ? (
                    <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#6a1b9a", lineHeight: 1.45 }}>
                      <strong>보완 사유:</strong> {task.changeReason}
                    </p>
                  ) : null}
                  {task.description ? (
                    <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#546e7a" }}>{task.description}</p>
                  ) : null}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => onViewTaskHistory(task.id)}
                      style={{
                        ...btnBase,
                        border: "1px solid #1976d2",
                        color: "#1976d2",
                      }}
                    >
                      감사 이력
                    </button>
                    {canGeneratePrompt ? (
                      <button
                        type="button"
                        onClick={() => onGeneratePrompt(task.id)}
                        disabled={generatingPromptTaskId === task.id}
                        style={{
                          ...btnBase,
                          cursor: generatingPromptTaskId === task.id ? "not-allowed" : "pointer",
                          opacity: generatingPromptTaskId === task.id ? 0.7 : 1,
                        }}
                      >
                        {generatingPromptTaskId === task.id ? "프롬프트 생성 중..." : "프롬프트 생성"}
                      </button>
                    ) : null}
                    {canRunTask ? (
                      <button
                        type="button"
                        onClick={() => onRunTask(task.id)}
                        disabled={runDisabled}
                        style={{
                          ...btnBase,
                          cursor: runDisabled ? "not-allowed" : "pointer",
                          opacity: runDisabled ? 0.7 : 1,
                          fontWeight: flow === "TODO" || flow === "READY" || flow === "CANCELLED" ? 600 : undefined,
                        }}
                      >
                        {runLabel}
                      </button>
                    ) : null}
                    {canRunTask && taskPromptMap[task.id] && task.status !== "BLOCKED" ? (
                      <button
                        type="button"
                        onClick={() => onAbortRun(task.id)}
                        disabled={taskRunMap[task.id]?.status !== "PENDING" || abortingTaskId === task.id}
                        style={{
                          ...btnBase,
                          border: "1px solid #c62828",
                          color: "#c62828",
                          cursor:
                            taskRunMap[task.id]?.status !== "PENDING" || abortingTaskId === task.id
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            taskRunMap[task.id]?.status !== "PENDING" || abortingTaskId === task.id ? 0.55 : 1,
                        }}
                        title="PENDING 상태의 실행만 중단할 수 있습니다."
                      >
                        {abortingTaskId === task.id ? "중단 처리 중..." : "중단"}
                      </button>
                    ) : null}
                    {canMarkReadyForGit && taskRunMap[task.id]?.status === "DONE" ? (
                      <button
                        type="button"
                        onClick={() => onMarkReadyForGit(task.id)}
                        disabled={markingReadyTaskId === task.id}
                        style={{
                          ...btnBase,
                          border: "1px solid #2e7d32",
                          color: "#2e7d32",
                          fontWeight: 600,
                          cursor: markingReadyTaskId === task.id ? "not-allowed" : "pointer",
                          opacity: markingReadyTaskId === task.id ? 0.7 : 1,
                        }}
                        title="DONE Run을 Git 반영 준비(READY_FOR_GIT)로 승인합니다."
                      >
                        {markingReadyTaskId === task.id ? "승인 처리 중..." : "승인 · Git 반영 준비"}
                      </button>
                    ) : null}
                    {canRegisterGitRequest && taskRunMap[task.id]?.status === "READY_FOR_GIT" ? (
                      <button
                        type="button"
                        onClick={() => onRegisterGitRequest(task.id)}
                        disabled={registeringGitRequestRunId === taskRunMap[task.id]?.id}
                        style={{
                          ...btnBase,
                          marginLeft: 0,
                          cursor:
                            registeringGitRequestRunId === taskRunMap[task.id]?.id
                              ? "not-allowed"
                              : "pointer",
                          opacity: registeringGitRequestRunId === taskRunMap[task.id]?.id ? 0.7 : 1,
                        }}
                      >
                        {registeringGitRequestRunId === taskRunMap[task.id]?.id
                          ? "요청 등록 중..."
                          : "Git 요청 등록"}
                      </button>
                    ) : null}
                    {canRunTask && flow === "FAILED" && taskRunMap[task.id] ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            !window.confirm(
                              "최신 FAILED/PENDING Run을 DONE으로 강제 완료합니다. Git 요청이 연결된 Run은 거절됩니다. 계속할까요?"
                            )
                          ) {
                            return;
                          }
                          onForceCompleteRun(task.id);
                        }}
                        disabled={forceCompletingTaskId === task.id}
                        style={{
                          ...btnBase,
                          border: "1px solid #6a1b9a",
                          color: "#6a1b9a",
                          cursor: forceCompletingTaskId === task.id ? "not-allowed" : "pointer",
                          opacity: forceCompletingTaskId === task.id ? 0.65 : 1,
                        }}
                      >
                        {forceCompletingTaskId === task.id ? "강제완료 처리 중..." : "강제완료"}
                      </button>
                    ) : null}
                    {canRunTask && task.status !== "BLOCKED" ? (
                      <button
                        type="button"
                        onClick={() => onBlockTask(task.id)}
                        disabled={blockingTaskId === task.id}
                        style={{
                          ...btnBase,
                          border: "1px solid #5e35b1",
                          color: "#5e35b1",
                          cursor: blockingTaskId === task.id ? "not-allowed" : "pointer",
                          opacity: blockingTaskId === task.id ? 0.65 : 1,
                        }}
                        title="Task를 BLOCKED로 두어 실행을 막습니다."
                      >
                        {blockingTaskId === task.id ? "차단 처리 중..." : "차단"}
                      </button>
                    ) : null}
                    {canRunTask && task.status === "BLOCKED" ? (
                      <button
                        type="button"
                        onClick={() => onUnblockTask(task.id)}
                        disabled={unblockingTaskId === task.id}
                        style={{
                          ...btnBase,
                          border: "1px solid #00897b",
                          color: "#00897b",
                          cursor: unblockingTaskId === task.id ? "not-allowed" : "pointer",
                          opacity: unblockingTaskId === task.id ? 0.65 : 1,
                        }}
                      >
                        {unblockingTaskId === task.id ? "해제 중..." : "차단 해제"}
                      </button>
                    ) : null}
                    {canCreateFollowUp && task.status === "DONE" ? (
                      <button
                        type="button"
                        onClick={() => onRequestFollowUp(task.id)}
                        disabled={followUpSaving}
                        style={{
                          ...btnBase,
                          border: "1px solid #1565c0",
                          color: "#1565c0",
                          fontWeight: 600,
                          cursor: followUpSaving ? "not-allowed" : "pointer",
                          opacity: followUpSaving ? 0.7 : 1,
                        }}
                        title="완료된 Task를 열지 않고 보완용 Follow-up Task를 붙입니다."
                      >
                        보완 작업 생성
                      </button>
                    ) : null}
                  </div>

                  {followUpDraft && followUpDraft.sourceTaskId === task.id ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        border: "1px dashed #00897b",
                        borderRadius: 8,
                        background: "#f1f8f6",
                      }}
                    >
                      <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: "#004d40" }}>
                        보완 Follow-up Task
                      </p>
                      <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#333" }}>
                        작업명
                        <input
                          type="text"
                          value={followUpDraft.name}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            onFollowUpDraftChange({ ...followUpDraft, name: e.target.value })
                          }
                          style={{
                            display: "block",
                            width: "100%",
                            maxWidth: 480,
                            marginTop: 4,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                          }}
                        />
                      </label>
                      <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#333" }}>
                        설명 (선택)
                        <textarea
                          value={followUpDraft.description}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                            onFollowUpDraftChange({ ...followUpDraft, description: e.target.value })
                          }
                          rows={2}
                          style={{
                            display: "block",
                            width: "100%",
                            maxWidth: 480,
                            marginTop: 4,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            resize: "vertical",
                          }}
                        />
                      </label>
                      <label style={{ display: "block", marginBottom: 10, fontSize: 13, color: "#333" }}>
                        변경 사유 <span style={{ color: "#c62828" }}>*</span>
                        <textarea
                          value={followUpDraft.changeReason}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                            onFollowUpDraftChange({ ...followUpDraft, changeReason: e.target.value })
                          }
                          rows={2}
                          placeholder="왜 보완 작업이 필요한지 적어 주세요."
                          style={{
                            display: "block",
                            width: "100%",
                            maxWidth: 480,
                            marginTop: 4,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            resize: "vertical",
                          }}
                        />
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button
                          type="button"
                          onClick={onSubmitFollowUp}
                          disabled={followUpSaving}
                          style={{
                            ...btnBase,
                            background: "#00897b",
                            color: "#fff",
                            border: "1px solid #00695c",
                            cursor: followUpSaving ? "not-allowed" : "pointer",
                            opacity: followUpSaving ? 0.75 : 1,
                          }}
                        >
                          {followUpSaving ? "생성 중..." : "보완 Task 생성"}
                        </button>
                        <button
                          type="button"
                          onClick={onCancelFollowUp}
                          disabled={followUpSaving}
                          style={{
                            ...btnBase,
                            cursor: followUpSaving ? "not-allowed" : "pointer",
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {taskPromptMap[task.id] ? (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ cursor: "pointer", fontSize: 13 }}>프롬프트 미리보기</summary>
                      <pre
                        style={{
                          marginTop: 8,
                          background: "#f7f7f7",
                          border: "1px solid #e0e0e0",
                          borderRadius: 8,
                          padding: 10,
                          whiteSpace: "pre-wrap",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {taskPromptMap[task.id].promptText}
                      </pre>
                    </details>
                  ) : null}

                  <div style={{ marginTop: 10, fontSize: 13, color: "#455a64", lineHeight: 1.6 }}>
                    <p style={{ margin: "4px 0" }}>
                      <strong>프롬프트:</strong> {taskPromptMap[task.id] ? "생성됨" : "미생성"} · v
                      {taskPromptMap[task.id]?.version ?? "-"} ·{" "}
                      <span style={{ fontWeight: 600 }}>{taskPromptMap[task.id]?.status || "-"}</span>
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>최신 Run:</strong> {taskRunMap[task.id]?.status || "-"}{" "}
                      {taskRunMap[task.id]?.status === "READY_FOR_GIT" ? (
                        <span style={{ color: "#0a7d2e", fontWeight: 600 }}>(Git 반영 준비)</span>
                      ) : null}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>resultText:</strong> {taskRunMap[task.id]?.resultText || "-"}
                    </p>
                    {taskRunMap[task.id]?.resultJson != null ? (
                      <details style={{ margin: "6px 0" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 600, color: "#37474f" }}>
                          resultJson (구조화 결과)
                        </summary>
                        <pre
                          style={{
                            margin: "6px 0 0 0",
                            padding: 8,
                            background: "#f5f5f5",
                            borderRadius: 4,
                            fontSize: 11,
                            overflow: "auto",
                            maxHeight: 160,
                          }}
                        >
                          {JSON.stringify(taskRunMap[task.id]?.resultJson, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                    <p style={{ margin: "4px 0" }}>
                      <strong>run 시각:</strong>{" "}
                      {taskRunMap[task.id]?.createdAt ? formatTestedAt(taskRunMap[task.id].createdAt) : "-"}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
