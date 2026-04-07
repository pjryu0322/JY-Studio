export type CollaborationActionType = "GENERATE_MINUTES" | "REQUEST_ANALYSIS" | "REQUEST_IDEAS";

export type CollaborationActionStatus = "idle" | "running" | "success" | "error";

export type CollaborationActionResult = {
  actionType: CollaborationActionType;
  status: CollaborationActionStatus;
  message: string;
  atIso: string;
  payload?: unknown;
};

export function buildMockActionResult(actionType: CollaborationActionType): CollaborationActionResult {
  const atIso = new Date().toISOString();
  if (actionType === "GENERATE_MINUTES") {
    return {
      actionType,
      status: "success",
      atIso,
      message: "Mock minutes generated (no backend integration yet).",
      payload: {
        summary: "Discussion summarized into minutes.",
        decisions: ["Keep workflow visible", "No backend orchestration in this phase"],
        pending: ["Wire generation contract", "Add persistence"],
        excluded: ["No AI agent execution changes"],
      },
    };
  }
  if (actionType === "REQUEST_ANALYSIS") {
    return {
      actionType,
      status: "success",
      atIso,
      message: "Mock analysis prepared (no backend integration yet).",
      payload: {
        summary: "High-level analysis summary placeholder.",
        notes: ["Risks: unclear ownership", "Opportunity: unify minutes/features contract"],
      },
    };
  }
  return {
    actionType,
    status: "success",
    atIso,
    message: "Mock ideas prepared (no backend integration yet).",
    payload: {
      ideas: [
        "Add ‘Create session’ CTA on requirement hub",
        "Add quick link from minutes → features extraction",
        "Add trace tab placeholder for future",
      ],
    },
  };
}

