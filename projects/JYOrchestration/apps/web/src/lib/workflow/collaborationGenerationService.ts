/**
 * Collaboration generation contract — entry point for minutes / analysis / ideas.
 * Replace implementations here (or delegate to external orchestration) without changing the UI page.
 */

import type {
  CollaborationActionResult,
  CollaborationSuccessAnalysis,
  CollaborationSuccessGenerateMinutes,
  CollaborationSuccessIdeas,
} from "@/lib/workflow/collaborationActionContract";
import { getCollaborationWorkspaceView } from "@/lib/workflow/workflowViewModel";

function notFoundError(actionType: CollaborationActionResult["actionType"], sessionId: string): CollaborationActionResult {
  return {
    actionType,
    status: "error",
    message: sessionId ? `Session not found: ${sessionId}` : "Session id is required.",
    atIso: new Date().toISOString(),
    payload: null,
  };
}

export async function generateMinutesForSession(sessionId: string): Promise<CollaborationActionResult> {
  const view = getCollaborationWorkspaceView(sessionId);
  if (!view.session) {
    return notFoundError("GENERATE_MINUTES", sessionId);
  }

  const atIso = new Date().toISOString();
  const out: CollaborationSuccessGenerateMinutes = {
    actionType: "GENERATE_MINUTES",
    status: "success",
    atIso,
    generationSource: "mock_stub",
    message: "Minutes payload returned from generation service (mock stub — not AI yet).",
    payload: {
      summary: "Discussion summarized into minutes.",
      decisions: ["Keep workflow visible", "No backend orchestration in this phase"],
      pending: ["Wire generation contract", "Add persistence"],
      excluded: ["No AI agent execution changes"],
    },
  };
  return out;
}

export async function requestAnalysisForSession(sessionId: string): Promise<CollaborationActionResult> {
  const view = getCollaborationWorkspaceView(sessionId);
  if (!view.session) {
    return notFoundError("REQUEST_ANALYSIS", sessionId);
  }

  const atIso = new Date().toISOString();
  const out: CollaborationSuccessAnalysis = {
    actionType: "REQUEST_ANALYSIS",
    status: "success",
    atIso,
    generationSource: "mock_stub",
    message: "Analysis payload returned from generation service (mock stub — not AI yet).",
    payload: {
      summary: "High-level analysis summary placeholder.",
      notes: ["Risks: unclear ownership", "Opportunity: unify minutes/features contract"],
    },
  };
  return out;
}

export async function requestIdeasForSession(sessionId: string): Promise<CollaborationActionResult> {
  const view = getCollaborationWorkspaceView(sessionId);
  if (!view.session) {
    return notFoundError("REQUEST_IDEAS", sessionId);
  }

  const atIso = new Date().toISOString();
  const out: CollaborationSuccessIdeas = {
    actionType: "REQUEST_IDEAS",
    status: "success",
    atIso,
    generationSource: "mock_stub",
    message: "Ideas payload returned from generation service (mock stub — not AI yet).",
    payload: {
      ideas: [
        "Add ‘Create session’ CTA on requirement hub",
        "Add quick link from minutes → features extraction",
        "Add trace tab placeholder for future",
      ],
    },
  };
  return out;
}
