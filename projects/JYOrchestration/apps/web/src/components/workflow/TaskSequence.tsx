"use client";

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { TaskExecutionReadiness } from "@/lib/workflow/collaborationSessionResultStore";
import { getTaskExecutionReadiness } from "@/lib/workflow/collaborationSessionResultStore";
import {
  formatCollaborationTaskDraftStatusForUi,
  formatCollaborationTaskDraftTypeForUi,
} from "@/lib/ui/workflowUiCopy";
import type { TaskReviewUiStatus } from "@/lib/workflow/useTasksWorkspaceReview";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";

export type TaskSequenceReviewControls = {
  reviewById: Record<string, TaskReviewUiStatus>;
  onConfirm: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onUpdateDependencyNote: (id: string, note: string) => void;
  /** Per-task execution readiness (confirmed rows only in UI). */
  executionReadiness?: Record<string, TaskExecutionReadiness>;
  onSetExecutionReadiness?: (taskId: string, readiness: TaskExecutionReadiness) => void;
};

function seqBtn(label: string, onClick: () => void, disabled?: boolean) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#9ca3af" : "#374151",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Ordered official tasks with compact dependency hints. Full fields live in TaskDraftsPanel.
 */
export function TaskSequence({
  tasks,
  review,
}: {
  tasks: CollaborationOfficialTaskDraft[];
  review?: TaskSequenceReviewControls;
}) {
  if (tasks.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
        아직 이 작업 집합에 항목이 없습니다. 협업에서 초안을 생성하거나 아래에서 작업을 추가하세요.
      </div>
    );
  }

  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <section aria-label="작업 순서" style={{ display: "grid", gap: 0 }}>
      {sorted.map((t, index) => (
        <TaskSequenceRow
          key={t.id}
          task={t}
          index={index}
          isLast={index === sorted.length - 1}
          review={review}
        />
      ))}
    </section>
  );
}

function TaskSequenceRow({
  task,
  index,
  isLast,
  review,
}: {
  task: CollaborationOfficialTaskDraft;
  index: number;
  isLast: boolean;
  review?: TaskSequenceReviewControls;
}) {
  const confirmed = review && review.reviewById[task.id] === "confirmed";
  const execReady =
    review?.executionReadiness !== undefined
      ? getTaskExecutionReadiness(review.executionReadiness, task.id)
      : "not_ready";
  const showReadiness = Boolean(confirmed && review?.onSetExecutionReadiness);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 32,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 900,
            color: "#374151",
            background: "#fafafa",
          }}
          aria-hidden
        >
          {task.order}
        </div>
        {isLast ? null : (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: 10,
              marginTop: 4,
              marginBottom: 4,
              background: "#e5e7eb",
              borderRadius: 1,
            }}
            aria-hidden
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 6 }}>
        <WorkflowCard
          padding={10}
          style={showReadiness && execReady === "ready" ? { borderColor: "#bbf7d0", background: "#f0fdf4" } : undefined}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{task.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {review && !confirmed ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    color: "#9ca3af",
                    textTransform: "uppercase",
                  }}
                >
                  초안
                </span>
              ) : null}
              {confirmed ? <WorkflowBadge>확정</WorkflowBadge> : null}
              {showReadiness ? (
                execReady === "ready" ? (
                  <WorkflowBadge>실행 준비됨</WorkflowBadge>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.04em" }}>미준비</span>
                )
              ) : null}
              <WorkflowBadge>{formatCollaborationTaskDraftStatusForUi(task.status)}</WorkflowBadge>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.4, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}>
            {task.taskType ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {formatCollaborationTaskDraftTypeForUi(task.taskType) ?? task.taskType}
              </span>
            ) : null}
            <span>
              관련 기능: <span style={{ color: "#374151" }}>{task.relatedFeatureName}</span>
            </span>
          </div>
          {task.dependencyNote && !review ? (
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 6, lineHeight: 1.4 }}>
              선행: {task.dependencyNote}
            </div>
          ) : null}
          {review ? (
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>선행 작업 메모</label>
              <input
                key={`${task.id}-${task.dependencyNote ?? ""}`}
                type="text"
                defaultValue={task.dependencyNote ?? ""}
                onBlur={(e) => review.onUpdateDependencyNote(task.id, e.target.value)}
                placeholder="예: 이전 단계 이름에 의존"
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ) : null}
          {showReadiness ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>실행 준비도(확정과 별개)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {seqBtn(
                  "준비로 표시",
                  () => review?.onSetExecutionReadiness?.(task.id, "ready"),
                  execReady === "ready"
                )}
                {seqBtn(
                  "미준비로 표시",
                  () => review?.onSetExecutionReadiness?.(task.id, "not_ready"),
                  execReady === "not_ready"
                )}
              </div>
            </div>
          ) : null}
          {review ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
              {seqBtn("확정", () => review.onConfirm(task.id), confirmed)}
              {seqBtn("제거", () => review.onRemove(task.id))}
              {seqBtn("위로", () => review.onMoveUp(index), index <= 0)}
              {seqBtn("아래로", () => review.onMoveDown(index), isLast)}
            </div>
          ) : null}
        </WorkflowCard>
      </div>
    </div>
  );
}
