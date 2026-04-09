"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { TasksWorkspaceContent } from "@/components/workflow/TasksWorkspaceContent";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { getTasksPageSubtitle, getTasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";

export function TasksPageClient() {
  const router = useRouter();
  const search = useSearchParams();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();

  const requirementId = search?.get("requirementId")?.trim() || null;
  const sessionId = search?.get("sessionId")?.trim() || null;

  const view = useMemo(() => getTasksWorkspaceView({ requirementId, sessionId }), [requirementId, sessionId, sessionResultsVersion]);

  const hasContext = Boolean(view.requirementId || view.sessionId);

  const openRequirement = () => {
    if (view.requirementId) {
      router.push(`/requirements/${encodeURIComponent(view.requirementId)}?tab=tasks`);
    }
  };

  const openCollaboration = () => {
    if (view.sessionId) {
      router.push(`/collaboration/${encodeURIComponent(view.sessionId)}`);
    } else {
      router.push("/collaboration");
    }
  };

  return (
    <div>
      <WorkflowPageHeader
        title="Tasks"
        subtitle={getTasksPageSubtitle(view, hasContext)}
        backHref="/requirements"
        backLabel="Back to requirements"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        {!view.found ? <WorkflowEmptyState title="Context not found" message={view.notFoundReason ?? "Check the URL."} /> : null}

        {view.found && !hasContext ? (
          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Pick a requirement or session</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              Use Open Tasks workspace from a requirement, or add <code style={{ fontSize: 12 }}>?requirementId=</code> /{" "}
              <code style={{ fontSize: 12 }}>?sessionId=</code> to the URL.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <WorkflowActionButton label="Requirements" onClick={() => router.push("/requirements")} />
              <WorkflowActionButton label="Collaboration" onClick={() => router.push("/collaboration")} variant="primary" />
            </div>
          </WorkflowCard>
        ) : null}

        {view.found && hasContext ? (
          <TasksWorkspaceContent view={view} onOpenRequirement={openRequirement} onOpenCollaboration={openCollaboration} />
        ) : null}
      </div>
    </div>
  );
}

