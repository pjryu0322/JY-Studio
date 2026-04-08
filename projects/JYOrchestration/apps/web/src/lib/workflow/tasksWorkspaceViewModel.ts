/**
 * Tasks workspace view — combines requirement/session context with official task drafts.
 * Uses the in-memory collaboration session store; call from client components only.
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import {
  getSessionCollaborationEntry,
  resolveSessionConfirmedTasks,
  resolveSessionOfficialTasks,
  sessionHasConfirmedTaskSet,
  sessionHasOfficialTasksOverride,
} from "@/lib/workflow/collaborationSessionResultStore";
import { getCollaborationWorkspaceView, getRequirementDetailView } from "@/lib/workflow/workflowViewModel";

export type TasksWorkspaceTaskSource = "collaboration_snapshot" | "view_model_empty";

export type TasksWorkspaceView = {
  found: boolean;
  notFoundReason?: string;
  requirementId: string | null;
  sessionId: string | null;
  requirementTitle: string | null;
  sessionTitle: string | null;
  sessionStatus: string | null;
  /** Generated official drafts (Task 초안 생성); working copy on /tasks starts from this list. */
  taskDrafts: CollaborationOfficialTaskDraft[];
  taskSource: TasksWorkspaceTaskSource;
  /** Saved confirmed subset from Tasks workspace; `undefined` if user never ran Task 확정. */
  confirmedTasks: CollaborationOfficialTaskDraft[] | undefined;
  hasConfirmedTaskSet: boolean;
  confirmedTaskSetRecordedAtIso: string | null;
};

/**
 * Resolve tasks workspace context. Query precedence: `sessionId` (if valid) over `requirementId`.
 */
export function getTasksWorkspaceView(input: {
  requirementId?: string | null;
  sessionId?: string | null;
}): TasksWorkspaceView {
  const reqId = input.requirementId?.trim() || null;
  const sid = input.sessionId?.trim() || null;

  const emptyBase = (): Omit<TasksWorkspaceView, "found" | "notFoundReason"> => ({
    requirementId: null,
    sessionId: null,
    requirementTitle: null,
    sessionTitle: null,
    sessionStatus: null,
    taskDrafts: [],
    taskSource: "view_model_empty",
    confirmedTasks: undefined,
    hasConfirmedTaskSet: false,
    confirmedTaskSetRecordedAtIso: null,
  });

  if (sid) {
    const wv = getCollaborationWorkspaceView(sid);
    if (!wv.session) {
      return {
        ...emptyBase(),
        found: false,
        notFoundReason: "Session not found.",
        sessionId: sid,
        requirementId: reqId,
      };
    }
    const drafts = resolveSessionOfficialTasks(sid, []);
    const fromCollab = sessionHasOfficialTasksOverride(sid);
    const confirmed = resolveSessionConfirmedTasks(sid);
    const entry = getSessionCollaborationEntry(sid);
    return {
      found: true,
      requirementId: wv.session.requirementId,
      sessionId: sid,
      requirementTitle: wv.requirement?.title ?? null,
      sessionTitle: wv.session.title,
      sessionStatus: wv.session.status,
      taskDrafts: drafts,
      taskSource: fromCollab ? "collaboration_snapshot" : "view_model_empty",
      confirmedTasks: confirmed,
      hasConfirmedTaskSet: sessionHasConfirmedTaskSet(sid),
      confirmedTaskSetRecordedAtIso: entry?.confirmedTasksAtIso ?? null,
    };
  }

  if (reqId) {
    const detail = getRequirementDetailView(reqId);
    if (!detail.requirement) {
      return {
        ...emptyBase(),
        found: false,
        notFoundReason: "Requirement not found.",
        requirementId: reqId,
      };
    }
    const latest = detail.latestSession;
    if (!latest) {
      return {
        found: true,
        requirementId: reqId,
        sessionId: null,
        requirementTitle: detail.requirement.title,
        sessionTitle: null,
        sessionStatus: null,
        taskDrafts: [],
        taskSource: "view_model_empty",
        confirmedTasks: undefined,
        hasConfirmedTaskSet: false,
        confirmedTaskSetRecordedAtIso: null,
      };
    }
    const drafts = resolveSessionOfficialTasks(latest.id, detail.taskDrafts);
    const fromCollab = sessionHasOfficialTasksOverride(latest.id);
    const confirmed = resolveSessionConfirmedTasks(latest.id);
    const entry = getSessionCollaborationEntry(latest.id);
    return {
      found: true,
      requirementId: reqId,
      sessionId: latest.id,
      requirementTitle: detail.requirement.title,
      sessionTitle: latest.title,
      sessionStatus: latest.status,
      taskDrafts: drafts,
      taskSource: fromCollab ? "collaboration_snapshot" : "view_model_empty",
      confirmedTasks: confirmed,
      hasConfirmedTaskSet: sessionHasConfirmedTaskSet(latest.id),
      confirmedTaskSetRecordedAtIso: entry?.confirmedTasksAtIso ?? null,
    };
  }

  return {
    found: true,
    ...emptyBase(),
  };
}

/** Page subtitle for /tasks from resolved workspace view (no side effects). */
export function getTasksPageSubtitle(view: TasksWorkspaceView, hasContext: boolean): string {
  if (!view.found || !hasContext) {
    return "Official drafts, order, and dependencies";
  }
  if (view.sessionTitle) {
    return `${view.requirementTitle ?? "—"} · ${view.sessionTitle}`;
  }
  return view.requirementTitle ?? "Official tasks in order";
}
