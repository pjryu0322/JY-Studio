import type { MeetingMinutesMock } from "@/lib/mock/workflowMock";

export type CollaborationActionType = "GENERATE_MINUTES" | "REQUEST_ANALYSIS" | "REQUEST_IDEAS";

export type CollaborationActionStatus = "idle" | "running" | "success" | "error";

/** Workspace-shaped minutes output (same shape as mock VM; replace body via service later). */
export type CollaborationMinutesPayload = MeetingMinutesMock;

export type CollaborationAnalysisPayload = {
  summary: string;
  notes: string[];
};

export type CollaborationIdeasPayload = {
  ideas: string[];
};

export type CollaborationGenerationSource = "mock_stub";

export type CollaborationSuccessGenerateMinutes = {
  actionType: "GENERATE_MINUTES";
  status: "success";
  message: string;
  atIso: string;
  payload: CollaborationMinutesPayload;
  /** Honest labeling: still local stub until AI/orchestration is wired. */
  generationSource: CollaborationGenerationSource;
};

export type CollaborationSuccessAnalysis = {
  actionType: "REQUEST_ANALYSIS";
  status: "success";
  message: string;
  atIso: string;
  payload: CollaborationAnalysisPayload;
  generationSource: CollaborationGenerationSource;
};

export type CollaborationSuccessIdeas = {
  actionType: "REQUEST_IDEAS";
  status: "success";
  message: string;
  atIso: string;
  payload: CollaborationIdeasPayload;
  generationSource: CollaborationGenerationSource;
};

export type CollaborationRunningOrError = {
  actionType: CollaborationActionType;
  status: "running" | "error";
  message: string;
  atIso: string;
  payload: null;
};

export type CollaborationActionResult =
  | CollaborationSuccessGenerateMinutes
  | CollaborationSuccessAnalysis
  | CollaborationSuccessIdeas
  | CollaborationRunningOrError;

export function isSuccessCollaborationResult(
  r: CollaborationActionResult
): r is CollaborationSuccessGenerateMinutes | CollaborationSuccessAnalysis | CollaborationSuccessIdeas {
  return r.status === "success";
}

/** Parse untrusted JSON (e.g. client after fetch) into a result, or null if shape is invalid. */
export function parseCollaborationActionResultFromApi(
  actionType: CollaborationActionType,
  raw: unknown
): CollaborationActionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.actionType !== actionType) return null;
  if (typeof o.atIso !== "string" || typeof o.message !== "string") return null;
  if (o.actionType !== actionType) return null;

  if (o.status === "error") {
    return {
      actionType,
      status: "error",
      message: o.message,
      atIso: o.atIso,
      payload: null,
    };
  }

  if (o.status !== "success") return null;

  if (actionType === "GENERATE_MINUTES") {
    const payload = parseCollaborationMinutesPayload(o.payload);
    if (!payload) return null;
    return {
      actionType: "GENERATE_MINUTES",
      status: "success",
      message: o.message,
      atIso: o.atIso,
      payload,
      generationSource: "mock_stub",
    };
  }

  if (actionType === "REQUEST_ANALYSIS") {
    const payload = parseCollaborationAnalysisPayload(o.payload);
    if (!payload) return null;
    return {
      actionType: "REQUEST_ANALYSIS",
      status: "success",
      message: o.message,
      atIso: o.atIso,
      payload,
      generationSource: "mock_stub",
    };
  }

  const payload = parseCollaborationIdeasPayload(o.payload);
  if (!payload) return null;
  return {
    actionType: "REQUEST_IDEAS",
    status: "success",
    message: o.message,
    atIso: o.atIso,
    payload,
    generationSource: "mock_stub",
  };
}

export function parseCollaborationMinutesPayload(raw: unknown): CollaborationMinutesPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== "string") return null;
  if (!Array.isArray(o.decisions) || !o.decisions.every((x) => typeof x === "string")) return null;
  if (!Array.isArray(o.pending) || !o.pending.every((x) => typeof x === "string")) return null;
  if (!Array.isArray(o.excluded) || !o.excluded.every((x) => typeof x === "string")) return null;
  return {
    summary: o.summary,
    decisions: o.decisions,
    pending: o.pending,
    excluded: o.excluded,
  };
}

export function parseCollaborationAnalysisPayload(raw: unknown): CollaborationAnalysisPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== "string") return null;
  if (!Array.isArray(o.notes) || !o.notes.every((x) => typeof x === "string")) return null;
  return { summary: o.summary, notes: o.notes };
}

export function parseCollaborationIdeasPayload(raw: unknown): CollaborationIdeasPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.ideas) || !o.ideas.every((x) => typeof x === "string")) return null;
  return { ideas: o.ideas };
}

/** JSON body for successful collaboration generation routes (client may narrow `result` after parse). */
export type CollaborationGenerationApiOk = {
  ok: true;
  result: CollaborationActionResult;
};

export type CollaborationGenerationApiErr = {
  ok: false;
  error: string;
};

export type CollaborationGenerationApiEnvelope = CollaborationGenerationApiOk | CollaborationGenerationApiErr;

export function isCollaborationGenerationApiOk(x: unknown): x is CollaborationGenerationApiOk {
  return Boolean(x && typeof x === "object" && (x as { ok?: unknown }).ok === true && "result" in x);
}

export function isCollaborationGenerationApiErr(x: unknown): x is CollaborationGenerationApiErr {
  return Boolean(x && typeof x === "object" && (x as { ok?: unknown }).ok === false && "error" in x);
}
