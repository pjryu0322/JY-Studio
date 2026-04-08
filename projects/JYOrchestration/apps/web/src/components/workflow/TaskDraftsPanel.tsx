"use client";

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";

export function TaskDraftsPanel({
  tasks,
  emptyLabel,
}: {
  tasks: CollaborationOfficialTaskDraft[];
  emptyLabel?: string;
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
      {sorted.map((t) => (
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
            </div>
            <WorkflowBadge>{t.status}</WorkflowBadge>
          </div>
          <div style={{ fontSize: 13, color: "#111827", marginTop: 8, lineHeight: 1.55 }}>{t.description}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10, lineHeight: 1.45 }}>
            Feature: <span style={{ color: "#374151" }}>{t.relatedFeatureName}</span>
            <span style={{ marginLeft: 8, fontFamily: "ui-monospace, monospace" }}>({t.relatedFeatureId})</span>
          </div>
          {t.dependencyNote ? (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
              Dependency note: {t.dependencyNote}
            </div>
          ) : null}
        </WorkflowCard>
      ))}
    </section>
  );
}
