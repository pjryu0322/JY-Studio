"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { TaskDraftsPanel } from "@/components/workflow/TaskDraftsPanel";
import { TaskSequence } from "@/components/workflow/TaskSequence";
import { TasksWorkspaceSummaryStrip } from "@/components/workflow/TasksWorkspaceSummaryStrip";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowSectionLabel } from "@/components/workflow/primitives/WorkflowSectionLabel";
import { recordSessionConfirmedTasks } from "@/lib/workflow/collaborationSessionResultStore";
import type { TasksWorkspaceView } from "@/lib/workflow/tasksWorkspaceViewModel";
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
  const working = useTasksWorkspaceReview(view.taskDrafts);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addFeat, setAddFeat] = useState("");
  const [confirmFlash, setConfirmFlash] = useState<string | null>(null);

  const reviewApi = {
    reviewById: working.reviewById,
    onConfirm: working.confirmTask,
    onRemove: working.removeTask,
    onMoveUp: working.moveUp,
    onMoveDown: working.moveDown,
    onUpdateDependencyNote: working.updateDependencyNote,
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

      <div>
        <WorkflowSectionLabel marginBottom={10}>Task sequence</WorkflowSectionLabel>
        <TaskSequence tasks={working.activeTasks} review={reviewApi} />
      </div>

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
            <TaskDraftsPanel tasks={working.activeTasks} review={reviewApi} emptyLabel="No tasks in this working set." />
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
