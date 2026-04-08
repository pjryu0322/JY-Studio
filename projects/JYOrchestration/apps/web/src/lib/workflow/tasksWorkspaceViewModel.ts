/**
 * Tasks workspace view — combines requirement/session context with official task drafts.
 * Uses the in-memory collaboration session store; call from client components only.
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import {
  resolveSessionOfficialTasks,
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
  taskDrafts: CollaborationOfficialTaskDraft[];
  taskSource: TasksWorkspaceTaskSource;
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
    return {
      found: true,
      requirementId: wv.session.requirementId,
      sessionId: sid,
      requirementTitle: wv.requirement?.title ?? null,
      sessionTitle: wv.session.title,
      sessionStatus: wv.session.status,
      taskDrafts: drafts,
      taskSource: fromCollab ? "collaboration_snapshot" : "view_model_empty",
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
      };
    }
    const drafts = resolveSessionOfficialTasks(latest.id, detail.taskDrafts);
    const fromCollab = sessionHasOfficialTasksOverride(latest.id);
    return {
      found: true,
      requirementId: reqId,
      sessionId: latest.id,
      requirementTitle: detail.requirement.title,
      sessionTitle: latest.title,
      sessionStatus: latest.status,
      taskDrafts: drafts,
      taskSource: fromCollab ? "collaboration_snapshot" : "view_model_empty",
    };
  }

  return {
    found: true,
    ...emptyBase(),
  };
}
