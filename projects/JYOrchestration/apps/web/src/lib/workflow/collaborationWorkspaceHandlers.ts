/**
 * Collaboration workspace display + in-memory store updates for successful generation actions.
 */

import type {
  CollaborationOfficialTaskDraft,
  CollaborationSuccessAnalysis,
  CollaborationSuccessGenerateFeatures,
  CollaborationSuccessGenerateMinutes,
  CollaborationSuccessGenerateTasks,
  CollaborationSuccessIdeas,
} from "@/lib/workflow/collaborationActionContract";
import {
  recordSessionGeneratedMinutes,
  recordSessionOfficialFeatures,
  recordSessionOfficialTasks,
  resolveSessionMinutes,
  resolveSessionOfficialFeatures,
  resolveSessionOfficialTasks,
} from "@/lib/workflow/collaborationSessionResultStore";
import { ideaStringsToSuggestedFeatures } from "@/lib/workflow/collaborationWorkspacePayload";
import type { CollaborationWorkspaceView } from "@/lib/workflow/workflowViewModel";
import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";
import type { DisplayedAnalysis } from "@/lib/workflow/collaborationWorkspacePayload";

export type CollaborationSuccessActionResult =
  | CollaborationSuccessGenerateMinutes
  | CollaborationSuccessGenerateFeatures
  | CollaborationSuccessGenerateTasks
  | CollaborationSuccessAnalysis
  | CollaborationSuccessIdeas;

export type CollaborationWorkspaceDisplayBootstrap = {
  minutes: MeetingMinutesMock | null;
  features: FeatureMock[];
  taskDrafts: CollaborationOfficialTaskDraft[];
};

export function getCollaborationWorkspaceDisplayBootstrap(
  sessionId: string,
  view: CollaborationWorkspaceView
): CollaborationWorkspaceDisplayBootstrap | null {
  if (!view.session) return null;
  return {
    minutes: resolveSessionMinutes(sessionId, view.minutes),
    features: [...resolveSessionOfficialFeatures(sessionId, view.features)],
    taskDrafts: [...resolveSessionOfficialTasks(sessionId, [])],
  };
}

export type CollaborationWorkspaceDisplayPatch = Partial<{
  minutes: MeetingMinutesMock | null;
  features: FeatureMock[];
  taskDrafts: CollaborationOfficialTaskDraft[];
  analysis: DisplayedAnalysis;
  ideas: string[];
  suggestedFeaturesFromIdeas: FeatureMock[];
}>;

export type CollaborationWorkspaceDisplaySetters = {
  setMinutes: (v: MeetingMinutesMock | null) => void;
  setFeatures: (v: FeatureMock[]) => void;
  setTaskDrafts: (v: CollaborationOfficialTaskDraft[]) => void;
  setAnalysis: (v: DisplayedAnalysis | null) => void;
  setIdeas: (v: string[]) => void;
  setSuggestedFeaturesFromIdeas: (v: FeatureMock[]) => void;
};

export function applyCollaborationWorkspaceDisplayPatch(
  patch: CollaborationWorkspaceDisplayPatch,
  s: CollaborationWorkspaceDisplaySetters
): void {
  if (patch.minutes !== undefined) s.setMinutes(patch.minutes);
  if (patch.features !== undefined) s.setFeatures(patch.features);
  if (patch.taskDrafts !== undefined) s.setTaskDrafts(patch.taskDrafts);
  if (patch.analysis !== undefined) s.setAnalysis(patch.analysis);
  if (patch.ideas !== undefined) s.setIdeas(patch.ideas);
  if (patch.suggestedFeaturesFromIdeas !== undefined) s.setSuggestedFeaturesFromIdeas(patch.suggestedFeaturesFromIdeas);
}

/** Persist official outputs to the session store (no-op for supporting-only actions). */
export function recordOfficialOutputsForSuccess(sessionId: string, out: CollaborationSuccessActionResult): void {
  switch (out.actionType) {
    case "GENERATE_MINUTES":
      recordSessionGeneratedMinutes(sessionId, out.payload, out.generationSource);
      break;
    case "GENERATE_FEATURES":
      recordSessionOfficialFeatures(sessionId, out.payload.features, out.generationSource);
      break;
    case "GENERATE_TASKS":
      recordSessionOfficialTasks(sessionId, out.payload.tasks, out.generationSource);
      break;
    default:
      break;
  }
}

/** Local UI state to apply after a successful action (includes supporting payloads). */
export function getDisplayPatchForCollaborationSuccess(out: CollaborationSuccessActionResult): CollaborationWorkspaceDisplayPatch {
  switch (out.actionType) {
    case "GENERATE_MINUTES":
      return { minutes: out.payload };
    case "GENERATE_FEATURES":
      return { features: [...out.payload.features] };
    case "GENERATE_TASKS":
      return { taskDrafts: [...out.payload.tasks] };
    case "REQUEST_ANALYSIS":
      return { analysis: out.payload };
    case "REQUEST_IDEAS":
      return {
        ideas: out.payload.ideas,
        suggestedFeaturesFromIdeas: ideaStringsToSuggestedFeatures(out.payload.ideas, Date.now()),
      };
  }
}
