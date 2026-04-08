"use client";

import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import type { TasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";

type Props = {
  view: TasksWorkspaceView;
  onOpenRequirement: () => void;
  onOpenCollaboration: () => void;
};

/** Single compact row: context, source, navigation. */
export function TasksWorkspaceSummaryStrip({ view, onOpenRequirement, onOpenCollaboration }: Props) {
  return (
    <WorkflowCard padding={12}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
          {view.requirementTitle ? <span style={{ fontWeight: 800, color: "#111827" }}>{view.requirementTitle}</span> : null}
          {view.sessionTitle ? (
            <>
              <span style={{ color: "#d1d5db" }} aria-hidden>
                |
              </span>
              <span style={{ color: "#374151" }}>{view.sessionTitle}</span>
              {view.sessionStatus ? <WorkflowBadge>{view.sessionStatus}</WorkflowBadge> : null}
            </>
          ) : (
            <>
              <span style={{ color: "#d1d5db" }} aria-hidden>
                |
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>No session</span>
            </>
          )}
          <span style={{ color: "#d1d5db" }} aria-hidden>
            |
          </span>
          {view.taskSource === "collaboration_snapshot" ? <WorkflowBadge>Snapshot</WorkflowBadge> : <WorkflowBadge>Not generated</WorkflowBadge>}
          {view.hasConfirmedTaskSet ? <WorkflowBadge>Confirmed set</WorkflowBadge> : null}
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {view.taskSource === "collaboration_snapshot" ? "In-memory only." : "Run Task 초안 생성 in collaboration."}
            {view.hasConfirmedTaskSet ? " An official confirmed task set exists for this session." : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {view.requirementId ? <WorkflowActionButton label="Requirement" onClick={onOpenRequirement} /> : null}
          <WorkflowActionButton label="Collaboration" variant="primary" onClick={onOpenCollaboration} />
        </div>
      </div>
    </WorkflowCard>
  );
}
