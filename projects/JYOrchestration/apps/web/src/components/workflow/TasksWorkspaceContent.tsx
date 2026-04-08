"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { TaskDraftsPanel } from "@/components/workflow/TaskDraftsPanel";
import { TaskSequence } from "@/components/workflow/TaskSequence";
import { TasksWorkspaceSummaryStrip } from "@/components/workflow/TasksWorkspaceSummaryStrip";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowSectionLabel } from "@/components/workflow/primitives/WorkflowSectionLabel";
import type { TaskExecutionReadiness } from "@/lib/workflow/collaborationSessionResultStore";
import {
  getTaskExecutionReadiness,
  getActiveExecutionInput,
  isActiveExecutionSnapshot,
  recordSessionConfirmedTasks,
  resolveSessionTaskReadiness,
  resolveSessionExecutionCandidates,
  recordSessionExecutionLaunchSnapshot,
  resolveSessionExecutionLaunchSnapshot,
  setSessionTaskReadiness,
} from "@/lib/workflow/collaborationSessionResultStore";
import { buildExecutionLaunchInput } from "@/lib/workflow/executionLaunchInput";
import { createExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import type { TasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";
import { useCollaborationSessionResultsVersion } from "@/lib/workflow/useCollaborationSessionResultsSync";
import { useTasksWorkspaceReview } from "@/lib/workflow/useTasksWorkspaceReview";

type Props = {
  view: TasksWorkspaceView;
  onOpenRequirement: () => void;
  onOpenCollaboration: () => void;
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  fontSize: 13,
  boxSizing: "border-box",
};

export function TasksWorkspaceContent({ view, onOpenRequirement, onOpenCollaboration }: Props) {
  const sessionResultsVersion = useCollaborationSessionResultsVersion();
  const working = useTasksWorkspaceReview(view.taskDrafts);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addFeat, setAddFeat] = useState("");
  const [confirmFlash, setConfirmFlash] = useState<string | null>(null);
  const [sequenceView, setSequenceView] = useState<"all" | "candidates">("all");

  const readinessMap = useMemo(
    () => resolveSessionTaskReadiness(view.sessionId),
    [view.sessionId, sessionResultsVersion]
  );

  const officialConfirmed = view.confirmedTasks ?? [];
  const readyCount = useMemo(
    () => officialConfirmed.filter((t) => getTaskExecutionReadiness(readinessMap, t.id) === "ready").length,
    [officialConfirmed, readinessMap]
  );
  const readyTotal = officialConfirmed.length;

  const candidateTasks = useMemo(
    () => resolveSessionExecutionCandidates(view.sessionId),
    [view.sessionId, sessionResultsVersion]
  );

  const executionLaunchPreview = useMemo(() => {
    if (!view.sessionId) return null;
    return buildExecutionLaunchInput({
      sessionId: view.sessionId,
      requirementId: view.requirementId,
      confirmedTasks: officialConfirmed,
      candidateTasks,
    });
  }, [view.sessionId, view.requirementId, officialConfirmed, candidateTasks]);

  const preparedSnapshot = useMemo(
    () => resolveSessionExecutionLaunchSnapshot(view.sessionId),
    [view.sessionId, sessionResultsVersion]
  );

  const activeExecution = useMemo(() => getActiveExecutionInput(), [sessionResultsVersion]);
  const isActiveSnapshot = useMemo(
    () => isActiveExecutionSnapshot(view.sessionId, preparedSnapshot?.snapshotId),
    [view.sessionId, preparedSnapshot?.snapshotId, sessionResultsVersion]
  );

  const displayedSequenceTasks = useMemo(() => {
    if (sequenceView === "all") return working.activeTasks;
    // Candidate set is derived from the saved confirmed set + readiness map.
    return working.activeTasks.filter((t) => getTaskExecutionReadiness(readinessMap, t.id) === "ready");
  }, [sequenceView, working.activeTasks, readinessMap]);

  const reviewApi = {
    reviewById: working.reviewById,
    onConfirm: working.confirmTask,
    onRemove: working.removeTask,
    onMoveUp: working.moveUp,
    onMoveDown: working.moveDown,
    onUpdateDependencyNote: working.updateDependencyNote,
    executionReadiness: readinessMap,
    onSetExecutionReadiness:
      view.sessionId !== null
        ? (taskId: string, readiness: TaskExecutionReadiness) => setSessionTaskReadiness(view.sessionId!, taskId, readiness)
        : undefined,
  };

  const submitManual = () => {
    working.addManualTask({
      name: addName,
      description: addDesc,
      relatedFeatureName: addFeat,
    });
    setAddName("");
    setAddDesc("");
    setAddFeat("");
  };

  const confirmTaskSet = () => {
    if (!view.sessionId) return;
    const subset = working.activeTasks.filter((t) => working.reviewById[t.id] === "confirmed");
    const snapshot = subset.map((t, i) => ({ ...t, order: i + 1 }));
    recordSessionConfirmedTasks(view.sessionId, snapshot);
    setConfirmFlash(
      snapshot.length > 0
        ? "Confirmed task set ready for next stage. It is stored in the shared session memory (this tab only until reload)."
        : "Saved an empty confirmed set. Requirement view will show no tasks until you confirm rows or run Task 확정 again."
    );
  };

  useEffect(() => {
    if (!confirmFlash) return;
    const id = window.setTimeout(() => setConfirmFlash(null), 7000);
    return () => window.clearTimeout(id);
  }, [confirmFlash]);

  return (
    <>
      <TasksWorkspaceSummaryStrip view={view} onOpenRequirement={onOpenRequirement} onOpenCollaboration={onOpenCollaboration} />

      {view.hasConfirmedTaskSet ? (
        <div style={{ border: "1px solid #bbf7d0", borderRadius: 12, padding: 10, background: "#f0fdf4" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>Official confirmed snapshot</div>
          <div style={{ fontSize: 12, color: "#15803d", marginTop: 6, lineHeight: 1.5 }}>
            A confirmed task set exists for this session
            {view.confirmedTaskSetRecordedAtIso ? ` (saved ${new Date(view.confirmedTaskSetRecordedAtIso).toLocaleString()})` : ""}. You can keep editing the
            working list; use Task 확정 again to replace the official set. Not persisted to a database yet.
          </div>
        </div>
      ) : null}

      {confirmFlash ? (
        <div style={{ border: "1px solid #bfdbfe", borderRadius: 12, padding: 10, background: "#eff6ff" }}>
          <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.5 }}>{confirmFlash}</div>
        </div>
      ) : null}

      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        Generated official drafts load below. Use <span style={{ fontWeight: 800, color: "#374151" }}>Confirm</span> on each task you want in the official set,
        then <span style={{ fontWeight: 800, color: "#374151" }}>Task 확정</span> to save it to the shared session store (in-memory). Rows without Confirm stay
        drafts in this workspace only.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <WorkflowActionButton
          label="Task 확정"
          variant="primary"
          onClick={confirmTaskSet}
          disabled={!view.sessionId}
        />
        <span style={{ fontSize: 12, color: "#6b7280" }}>Saves only tasks marked Confirmed, in current order.</span>
      </div>

      {view.sessionId ? (
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800 }}>{readyCount}</span> / <span style={{ fontWeight: 800 }}>{readyTotal}</span> tasks in the{" "}
          <span style={{ fontWeight: 800 }}>saved confirmed set</span> are execution candidates (ready).
          {readyTotal === 0 ? (
            <span style={{ color: "#6b7280" }}> Run Task 확정 after confirming rows to fix this total.</span>
          ) : null}
        </div>
      ) : null}

      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, borderLeft: "3px solid #e5e7eb", paddingLeft: 10 }}>
        Ready tasks form the <span style={{ fontWeight: 800, color: "#374151" }}>execution candidate set</span>. These can be used for execution in the next
        stage (not wired here). Mark a task ready only after name/description are clear and dependencies are not blocking.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>View</span>
        <button
          type="button"
          onClick={() => setSequenceView("all")}
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: sequenceView === "all" ? "#111827" : "#fff",
            color: sequenceView === "all" ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          All tasks
        </button>
        <button
          type="button"
          onClick={() => setSequenceView("candidates")}
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: sequenceView === "candidates" ? "#111827" : "#fff",
            color: sequenceView === "candidates" ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          Execution candidates
        </button>
        {sequenceView === "candidates" ? (
          <span style={{ fontSize: 12, color: "#6b7280" }}>Shows only ready tasks (from the saved confirmed set).</span>
        ) : null}
      </div>

      <div>
        <WorkflowSectionLabel marginBottom={10}>Task sequence</WorkflowSectionLabel>
        <TaskSequence tasks={displayedSequenceTasks} review={reviewApi} />
        {sequenceView === "candidates" && displayedSequenceTasks.length === 0 ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            No execution candidates yet. Confirm tasks, save Task 확정, then mark them ready.
          </div>
        ) : null}
      </div>

      {executionLaunchPreview ? (
        <WorkflowCard padding={12}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>Execution input preview</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Ready tasks form the execution candidate set. This preview shows what would be packaged as execution launch input in a later stage (no execution
                is triggered here).
              </div>
              <div style={{ fontSize: 13, color: "#111827" }}>
                <span style={{ fontWeight: 900 }}>{executionLaunchPreview.summary.candidateCount}</span> candidates •{" "}
                <span style={{ fontWeight: 900 }}>{executionLaunchPreview.summary.confirmedCount}</span> confirmed • session{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionLaunchPreview.sessionId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                requirementId:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionLaunchPreview.requirementId ?? "(none)"}</span> • createdAt:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{executionLaunchPreview.createdAtIso}</span>
              </div>
              <div style={{ fontSize: 12, color: "#111827" }}>
                candidate task ids:{" "}
                <span style={{ fontFamily: "ui-monospace, monospace", color: "#374151" }}>
                  {executionLaunchPreview.readyTaskIds.length > 0 ? executionLaunchPreview.readyTaskIds.join(", ") : "(none)"}
                </span>
              </div>
            </div>
          </details>
        </WorkflowCard>
      ) : null}

      {executionLaunchPreview ? (
        <WorkflowCard padding={12}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>Execution launch snapshot</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Preview is dynamic. A snapshot is an explicit prepared set held in shared session memory (still pre-execution).
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <WorkflowActionButton
                  label="Prepare execution snapshot"
                  variant="primary"
                  disabled={!view.sessionId}
                  onClick={() => {
                    if (!view.sessionId) return;
                    const snap = createExecutionLaunchSnapshot({
                      sessionId: view.sessionId,
                      requirementId: view.requirementId,
                      confirmedTasks: officialConfirmed,
                      candidateTasks,
                    });
                    recordSessionExecutionLaunchSnapshot(view.sessionId, snap);
                  }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>Captures current execution candidates at one moment.</span>
              </div>
              {preparedSnapshot ? (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Snapshot prepared</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                    {preparedSnapshot.summary.candidateCount} candidates • prepared{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{preparedSnapshot.preparedAtIso}</span> • id{" "}
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{preparedSnapshot.snapshotId}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>
                    Active input:{" "}
                    {isActiveSnapshot ? (
                      <span style={{ fontWeight: 900, color: "#166534" }}>Selected</span>
                    ) : activeExecution ? (
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>
                        {activeExecution.sessionId} / {activeExecution.snapshotId}
                      </span>
                    ) : (
                      <span>(none)</span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280" }}>No snapshot prepared yet.</div>
              )}
            </div>
          </details>
        </WorkflowCard>
      ) : null}

      {working.removedTasks.length > 0 ? (
        <WorkflowCard padding={10}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "#6b7280" }}>Removed from this review</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
            {working.removedTasks.map((t) => (
              <li key={t.id} style={{ marginBottom: 6 }}>
                {t.name}{" "}
                <button
                  type="button"
                  onClick={() => working.restoreTask(t.id)}
                  style={{
                    fontSize: 11,
                    textDecoration: "underline",
                    border: 0,
                    background: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "#2563eb",
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </WorkflowCard>
      ) : null}

      <WorkflowCard padding={12}>
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>Add task</summary>
          <div style={{ marginTop: 12, display: "grid", gap: 10, maxWidth: 440 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>
              Name
              <input value={addName} onChange={(e) => setAddName(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, color: "#6b7280" }}>
              Short description
              <textarea
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
                rows={2}
                style={{ ...inputStyle, marginTop: 4, resize: "vertical", minHeight: 48 }}
              />
            </label>
            <label style={{ fontSize: 12, color: "#6b7280" }}>
              Related feature (optional)
              <input value={addFeat} onChange={(e) => setAddFeat(e.target.value)} style={inputStyle} placeholder="Feature name" />
            </label>
            <div>
              <button
                type="button"
                onClick={submitManual}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#111827",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Add to sequence
              </button>
            </div>
          </div>
        </details>
      </WorkflowCard>

      <WorkflowCard padding={12}>
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, listStyle: "none" }}>Detailed task list</summary>
          <div style={{ marginTop: 12 }}>
            <TaskDraftsPanel
              tasks={working.activeTasks}
              review={reviewApi}
              highlightExecutionReady
              emptyLabel="No tasks in this working set."
            />
          </div>
        </details>
      </WorkflowCard>

      <details>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#9ca3af" }}>Execution (not wired yet)</summary>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>
          Readiness flags are pre-execution only (in-memory). No run, queue, or Stage hooks are attached yet.
        </p>
      </details>
    </>
  );
}
