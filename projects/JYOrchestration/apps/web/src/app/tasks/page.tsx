"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { TaskDraftsPanel } from "@/components/workflow/TaskDraftsPanel";
import { TaskWorkflowSequence } from "@/components/workflow/TaskWorkflowSequence";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { getTasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";

export default function TasksPage() {
  const router = useRouter();
  const search = useSearchParams();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();

  const requirementId = search?.get("requirementId")?.trim() || null;
  const sessionId = search?.get("sessionId")?.trim() || null;

  const view = useMemo(
    () => getTasksWorkspaceView({ requirementId, sessionId }),
    [requirementId, sessionId, sessionResultsVersion]
  );

  const hasContext = Boolean(view.requirementId || view.sessionId);

  return (
    <div>
      <WorkflowPageHeader
        title="Tasks workspace"
        subtitle={
          hasContext
            ? view.sessionTitle && view.requirementTitle
              ? `${view.requirementTitle} · ${view.sessionTitle}`
              : view.requirementTitle ?? view.sessionTitle ?? "Workflow task drafts"
            : "Official task drafts and a simple workflow sequence (mock / in-memory)."
        }
        backHref="/requirements"
        backLabel="Back to requirements"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {!view.found ? (
          <WorkflowEmptyState title="Context not found" message={view.notFoundReason ?? "Check requirement or session id in the URL."} />
        ) : null}

        {view.found && !hasContext ? (
          <WorkflowCard>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Choose a context</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
              Open a requirement’s Tasks tab and use “Open Tasks workspace”, or append{" "}
              <code style={{ fontSize: 12 }}>?requirementId=…</code> or <code style={{ fontSize: 12 }}>?sessionId=…</code> to this URL. Task drafts from
              collaboration generation appear when you use the latest session for that requirement (in-memory until persistence exists).
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <WorkflowActionButton label="Browse requirements" onClick={() => router.push("/requirements")} />
              <WorkflowActionButton label="Browse collaboration sessions" onClick={() => router.push("/collaboration")} variant="primary" />
            </div>
          </WorkflowCard>
        ) : null}

        {view.found && hasContext ? (
          <>
            <WorkflowCard>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Context</div>
              <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
                {view.requirementTitle ? (
                  <div>
                    Requirement: <strong style={{ fontWeight: 800 }}>{view.requirementTitle}</strong>
                  </div>
                ) : null}
                {view.sessionTitle ? (
                  <div style={{ marginTop: 6 }}>
                    Session: {view.sessionTitle}
                    {view.sessionStatus ? (
                      <span style={{ marginLeft: 8 }}>
                        <WorkflowBadge>{view.sessionStatus}</WorkflowBadge>
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>No collaboration session on file for this requirement yet.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {view.requirementId ? (
                  <WorkflowActionButton
                    label="Open requirement (Tasks tab)"
                    onClick={() => router.push(`/requirements/${encodeURIComponent(view.requirementId!)}?tab=tasks`)}
                  />
                ) : null}
                {view.sessionId ? (
                  <WorkflowActionButton
                    label="Open collaboration session"
                    variant="primary"
                    onClick={() => router.push(`/collaboration/${encodeURIComponent(view.sessionId!)}`)}
                  />
                ) : view.requirementId ? (
                  <WorkflowActionButton
                    label="Open latest session (when available)"
                    onClick={() => router.push("/collaboration")}
                  />
                ) : null}
              </div>
            </WorkflowCard>

            <WorkflowCard>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>Task draft source</div>
                {view.taskSource === "collaboration_snapshot" ? (
                  <WorkflowBadge>Collaboration snapshot</WorkflowBadge>
                ) : (
                  <WorkflowBadge>View model / empty</WorkflowBadge>
                )}
              </div>
              {view.taskSource === "collaboration_snapshot" ? (
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                  In-memory official task drafts from Task 초안 생성 for this session (mock_stub). Not persisted across a full browser reload.
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                  No collaboration-generated task drafts in the store for this session yet. Run Task 초안 생성 in the collaboration workspace, then return here
                  (same tab keeps the store warm).
                </div>
              )}
            </WorkflowCard>

            <WorkflowCard>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>Execution</div>
                <WorkflowBadge>Binding next</WorkflowBadge>
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                These drafts are not wired to the execution pipeline yet. A later phase will map steps to runnable work without changing Stage1/Stage2 here.
              </div>
            </WorkflowCard>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                gap: 14,
                alignItems: "start",
              }}
            >
              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Official task drafts (list)</div>
                <TaskDraftsPanel
                  tasks={view.taskDrafts}
                  emptyLabel="No drafts yet. Use Task 초안 생성 in collaboration for this session."
                />
              </WorkflowCard>
              <WorkflowCard padding={12}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Workflow builder (sequence)</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginBottom: 10 }}>
                  Ordered steps and dependency hints — not a full graph editor.
                </div>
                <TaskWorkflowSequence tasks={view.taskDrafts} />
              </WorkflowCard>
            </div>
          </>
        ) : null}

        {view.found && hasContext && view.requirementId ? (
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            Tip: bookmark{" "}
            <Link href={`/tasks?requirementId=${encodeURIComponent(view.requirementId)}`} style={{ textDecoration: "underline" }}>
              this requirement view
            </Link>
            {view.sessionId ? (
              <>
                {" "}
                or{" "}
                <Link href={`/tasks?sessionId=${encodeURIComponent(view.sessionId)}`} style={{ textDecoration: "underline" }}>
                  this session view
                </Link>
              </>
            ) : null}{" "}
            for quick access.
          </div>
        ) : null}
      </div>
    </div>
  );
}
