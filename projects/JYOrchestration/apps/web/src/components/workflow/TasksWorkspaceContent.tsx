"use client";

import { TaskDraftsPanel } from "@/components/workflow/TaskDraftsPanel";
import { TaskSequence } from "@/components/workflow/TaskSequence";
import { TasksWorkspaceSummaryStrip } from "@/components/workflow/TasksWorkspaceSummaryStrip";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowSectionLabel } from "@/components/workflow/primitives/WorkflowSectionLabel";
import type { TasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";

type Props = {
  view: TasksWorkspaceView;
  onOpenRequirement: () => void;
  onOpenCollaboration: () => void;
};

export function TasksWorkspaceContent({ view, onOpenRequirement, onOpenCollaboration }: Props) {
  return (
    <>
      <TasksWorkspaceSummaryStrip view={view} onOpenRequirement={onOpenRequirement} onOpenCollaboration={onOpenCollaboration} />

      <div>
        <WorkflowSectionLabel marginBottom={10}>Task sequence</WorkflowSectionLabel>
        <TaskSequence tasks={view.taskDrafts} />
      </div>

      <WorkflowCard padding={12}>
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>Detailed task list</summary>
          <div style={{ marginTop: 12 }}>
            <TaskDraftsPanel tasks={view.taskDrafts} emptyLabel="No drafts yet." />
          </div>
        </details>
      </WorkflowCard>

      <details>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#9ca3af" }}>Execution (not wired yet)</summary>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>
          These drafts are not connected to automated execution yet.
        </p>
      </details>
    </>
  );
}
