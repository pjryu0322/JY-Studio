"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { resolveSessionExecutionLaunchSnapshot, setActiveExecutionInput } from "@/lib/workflow/collaborationSessionResultStore";
import { getPreExecutionStateForSession } from "@/lib/workflow/preExecutionSelectors";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";

export default function ExecutionPage() {
  const router = useRouter();
  const search = useSearchParams();
  const sessionResultsVersion = useCollaborationSessionResultsVersion();

  const requirementId = search?.get("requirementId")?.trim() || null;
  const sessionId = search?.get("sessionId")?.trim() || null;

  const snapshot = useMemo(
    () => resolveSessionExecutionLaunchSnapshot(sessionId),
    [sessionId, sessionResultsVersion]
  );

  const pre = useMemo(() => getPreExecutionStateForSession(sessionId), [sessionId, sessionResultsVersion]);
  const isActive = pre.isSnapshotActive;

  const openTasks = () => {
    const qs = new URLSearchParams();
    if (requirementId) qs.set("requirementId", requirementId);
    if (sessionId) qs.set("sessionId", sessionId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    router.push(`/tasks${suffix}`);
  };

  return (
    <div>
      <WorkflowPageHeader
        title="Execution"
        subtitle="Pre-execution visibility only (no launch here)"
        backHref="/workspace"
        backLabel="Back to workspace"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        <WorkflowCard padding={12}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Prepared execution input</div>

          {!sessionId ? (
            <WorkflowEmptyState
              title="No session selected"
              message="Add ?sessionId= (and optionally ?requirementId=) to view a prepared snapshot for a specific session."
            />
          ) : snapshot ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Snapshot exists for this session. Execution is not started; this is a read-only pre-execution input source.
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Active input:{" "}
                {isActive ? (
                  <span style={{ fontWeight: 900, color: "#166534" }}>Selected</span>
                ) : pre.active ? (
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>
                    {pre.active.sessionId} / {pre.active.snapshotId}
                  </span>
                ) : (
                  <span>(none)</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
                <span style={{ fontWeight: 900 }}>{snapshot.summary.candidateCount}</span> candidates • snapshot{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.snapshotId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                sessionId: <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.sessionId}</span> • requirementId:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.requirementId ?? "(none)"}</span> • preparedAt:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{snapshot.preparedAtIso}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton
                  label={isActive ? "Active input selected" : "Select as active input"}
                  variant="primary"
                  onClick={() => setActiveExecutionInput({ sessionId: snapshot.sessionId, snapshotId: snapshot.snapshotId })}
                  disabled={isActive}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                No prepared execution snapshot for this session yet. Prepare it in the Tasks workspace first.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WorkflowActionButton label="Open Tasks workspace" variant="primary" onClick={openTasks} />
              </div>
            </div>
          )}

          {sessionId ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <WorkflowActionButton label="Open Tasks workspace" onClick={openTasks} />
            </div>
          ) : null}
        </WorkflowCard>
      </div>
    </div>
  );
}

