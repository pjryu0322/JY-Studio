"use client";

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";

/**
 * Lightweight workflow builder view: ordered steps with dependency hints (no graph editor).
 */
export function TaskWorkflowSequence({ tasks }: { tasks: CollaborationOfficialTaskDraft[] }) {
  if (tasks.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
        Add official task drafts (e.g. Task 초안 생성 in collaboration) to see a sequence here.
      </div>
    );
  }

  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <section aria-label="Workflow sequence" style={{ display: "grid", gap: 0 }}>
      {sorted.map((t, index) => (
        <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 36,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 900,
                color: "#374151",
                background: "#fafafa",
              }}
              aria-hidden
            >
              {t.order}
            </div>
            {index < sorted.length - 1 ? (
              <div
                style={{
                  width: 2,
                  flex: 1,
                  minHeight: 12,
                  marginTop: 4,
                  marginBottom: 4,
                  background: "#e5e7eb",
                  borderRadius: 1,
                }}
                aria-hidden
              />
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: index < sorted.length - 1 ? 8 : 0 }}>
            <WorkflowCard padding={12}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{t.name}</div>
                <WorkflowBadge>{t.status}</WorkflowBadge>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
                → Feature: {t.relatedFeatureName}
              </div>
              {t.dependencyNote ? (
                <div style={{ fontSize: 12, color: "#92400e", marginTop: 8, lineHeight: 1.45, fontWeight: 600 }}>
                  Depends on: {t.dependencyNote}
                </div>
              ) : index > 0 ? (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.45 }}>
                  Follows step {sorted[index - 1]!.order} in this draft order.
                </div>
              ) : null}
            </WorkflowCard>
          </div>
        </div>
      ))}
    </section>
  );
}
