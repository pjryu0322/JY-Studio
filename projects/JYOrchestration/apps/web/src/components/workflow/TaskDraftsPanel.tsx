"use client";

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
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
}: {
  tasks: CollaborationOfficialTaskDraft[];
  emptyLabel?: string;
  review?: TaskSequenceReviewControls;
}) {
  if (tasks.length === 0) {
    return (
      <section aria-label="Task drafts">
        <WorkflowEmptyState title="Task drafts" message={emptyLabel ?? "No task drafts"} />
      </section>
    );
  }

  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <section aria-label="Task drafts" style={{ display: "grid", gap: 10 }}>
      {sorted.map((t, index) => {
        const confirmed = review && review.reviewById[t.id] === "confirmed";
        const isLast = index === sorted.length - 1;
        return (
          <WorkflowCard key={t.id} padding={12}>
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
                    {t.taskType}
                  </span>
                ) : null}
                {confirmed ? (
                  <span style={{ marginLeft: 8 }}>
                    <WorkflowBadge>Confirmed</WorkflowBadge>
                  </span>
                ) : null}
              </div>
              <WorkflowBadge>{t.status}</WorkflowBadge>
            </div>
            <div style={{ fontSize: 13, color: "#111827", marginTop: 8, lineHeight: 1.55 }}>{t.description}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10, lineHeight: 1.45 }}>
              Feature: <span style={{ color: "#374151" }}>{t.relatedFeatureName}</span>
              <span style={{ marginLeft: 8, fontFamily: "ui-monospace, monospace" }}>({t.relatedFeatureId})</span>
            </div>
            {review ? (
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>Dependency note</label>
                <input
                  key={`${t.id}-${t.dependencyNote ?? ""}`}
                  type="text"
                  defaultValue={t.dependencyNote ?? ""}
                  onBlur={(e) => review.onUpdateDependencyNote(t.id, e.target.value)}
                  placeholder="Short dependency text"
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
                Dependency note: {t.dependencyNote}
              </div>
            ) : null}
            {review ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
                {seqBtn("Confirm", () => review.onConfirm(t.id), Boolean(confirmed))}
                {seqBtn("Remove", () => review.onRemove(t.id))}
                {seqBtn("Move up", () => review.onMoveUp(index), index <= 0)}
                {seqBtn("Move down", () => review.onMoveDown(index), isLast)}
              </div>
            ) : null}
          </WorkflowCard>
        );
      })}
    </section>
  );
}
