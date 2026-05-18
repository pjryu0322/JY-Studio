"use client";

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { TaskExecutionReadiness } from "@/lib/workflow/collaborationSessionResultStore";
import { getTaskExecutionReadiness } from "@/lib/workflow/collaborationSessionResultStore";
import {
  formatCollaborationTaskDraftStatusForUi,
  formatCollaborationTaskDraftTypeForUi,
} from "@/lib/ui/workflowUiCopy";
import type { TaskSequenceReviewControls } from "@/components/workflow/TaskSequence";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";

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

export function TaskDraftsPanel({
  tasks,
  emptyLabel,
  review,
  executionReadiness,
  onSetExecutionReadiness,
  highlightExecutionReady,
}: {
  tasks: CollaborationOfficialTaskDraft[];
  emptyLabel?: string;
  review?: TaskSequenceReviewControls;
  /** When no `review`, use these for read-only readiness (e.g. requirement tab). */
  executionReadiness?: Record<string, TaskExecutionReadiness>;
  onSetExecutionReadiness?: (taskId: string, readiness: TaskExecutionReadiness) => void;
  /** Left accent on cards marked execution-ready (e.g. requirement view). */
  highlightExecutionReady?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <section aria-label="작업 초안">
        <WorkflowEmptyState title="작업 초안" message={emptyLabel ?? "작업 초안이 없습니다."} />
      </section>
    );
  }

  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <section aria-label="작업 초안" style={{ display: "grid", gap: 10 }}>
      {sorted.map((t, index) => {
        const confirmed = review && review.reviewById[t.id] === "confirmed";
        const isLast = index === sorted.length - 1;
        const execMap = executionReadiness ?? review?.executionReadiness;
        const execOnSet = onSetExecutionReadiness ?? review?.onSetExecutionReadiness;
        const execR = execMap ? getTaskExecutionReadiness(execMap, t.id) : null;
        const execReady = execR === "ready";
        const showReadinessControls = Boolean(confirmed && execOnSet);
        const showReadinessRead = Boolean(execMap && !showReadinessControls);
        const cardFrame =
          highlightExecutionReady && execReady ? { borderLeft: "4px solid #22c55e", paddingLeft: 10 } : undefined;

        return (
          <WorkflowCard key={t.id} padding={12} style={cardFrame}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 900, minWidth: 0 }}>
                <span style={{ color: "#6b7280", fontWeight: 800, marginRight: 8 }}>#{t.order}</span>
                {t.name}
                {t.taskType ? (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.05em",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                    }}
                  >
                    {formatCollaborationTaskDraftTypeForUi(t.taskType) ?? t.taskType}
                  </span>
                ) : null}
                {review && !confirmed ? (
                  <span
                    style={{
                      marginLeft: 8,
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
                {confirmed ? (
                  <span style={{ marginLeft: 8 }}>
                    <WorkflowBadge>확정</WorkflowBadge>
                  </span>
                ) : null}
                {showReadinessRead || showReadinessControls ? (
                  execReady ? (
                    <span style={{ marginLeft: 8 }}>
                      <WorkflowBadge>실행 준비됨</WorkflowBadge>
                    </span>
                  ) : (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#b45309",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      미준비
                    </span>
                  )
                ) : null}
              </div>
              <WorkflowBadge>{formatCollaborationTaskDraftStatusForUi(t.status)}</WorkflowBadge>
            </div>
            <div style={{ fontSize: 13, color: "#111827", marginTop: 8, lineHeight: 1.55 }}>{t.description}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10, lineHeight: 1.45 }}>
              관련 기능: <span style={{ color: "#374151" }}>{t.relatedFeatureName}</span>
              <span style={{ marginLeft: 8, fontFamily: "ui-monospace, monospace" }}>({t.relatedFeatureId})</span>
            </div>
            {review ? (
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>선행 작업 메모</label>
                <input
                  key={`${t.id}-${t.dependencyNote ?? ""}`}
                  type="text"
                  defaultValue={t.dependencyNote ?? ""}
                  onBlur={(e) => review.onUpdateDependencyNote(t.id, e.target.value)}
                  placeholder="짧은 선행 관계 설명"
                  style={{
                    width: "100%",
                    maxWidth: 480,
                    fontSize: 12,
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : t.dependencyNote ? (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
                선행 작업 메모: {t.dependencyNote}
              </div>
            ) : null}
            {showReadinessControls ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>실행 준비도</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {seqBtn("준비로 표시", () => execOnSet!(t.id, "ready"), execReady)}
                  {seqBtn("미준비로 표시", () => execOnSet!(t.id, "not_ready"), !execReady)}
                </div>
              </div>
            ) : null}
            {review ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
                {seqBtn("확정", () => review.onConfirm(t.id), Boolean(confirmed))}
                {seqBtn("제거", () => review.onRemove(t.id))}
                {seqBtn("위로", () => review.onMoveUp(index), index <= 0)}
                {seqBtn("아래로", () => review.onMoveDown(index), isLast)}
              </div>
            ) : null}
          </WorkflowCard>
        );
      })}
    </section>
  );
}
