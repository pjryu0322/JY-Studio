"use client";

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";

/**
 * Ordered official tasks with compact dependency hints. Full fields live in TaskDraftsPanel.
 */
export function TaskSequence({ tasks }: { tasks: CollaborationOfficialTaskDraft[] }) {
  if (tasks.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
        No official task drafts yet. Open collaboration and run Task 초안 생성.
      </div>
    );
  }

  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <section aria-label="Task sequence" style={{ display: "grid", gap: 0 }}>
      {sorted.map((t, index) => (
        <TaskSequenceRow key={t.id} task={t} isLast={index === sorted.length - 1} />
      ))}
    </section>
  );
}

function TaskSequenceRow({ task, isLast }: { task: CollaborationOfficialTaskDraft; isLast: boolean }) {
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
        <WorkflowCard padding={10}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{task.name}</div>
            <WorkflowBadge>{task.status}</WorkflowBadge>
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
                {task.taskType}
              </span>
            ) : null}
            <span>
              Feature: <span style={{ color: "#374151" }}>{task.relatedFeatureName}</span>
            </span>
          </div>
          {task.dependencyNote ? (
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 6, lineHeight: 1.4 }}>
              Deps: {task.dependencyNote}
            </div>
          ) : null}
        </WorkflowCard>
      </div>
    </div>
  );
}
