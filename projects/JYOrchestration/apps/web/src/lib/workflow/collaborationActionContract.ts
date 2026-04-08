import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";

export type CollaborationActionType =
  | "GENERATE_MINUTES"
  | "GENERATE_FEATURES"
  | "GENERATE_TASKS"
  | "REQUEST_ANALYSIS"
  | "REQUEST_IDEAS";

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

/** Official derived features for the session (not idea suggestions). */
export type CollaborationOfficialFeaturesPayload = {
  features: FeatureMock[];
};

/** Official task draft (not brainstorm ideas). */
export type CollaborationTaskDraftStatus = "DRAFT" | "READY" | "BLOCKED";

export type CollaborationOfficialTaskDraft = {
  id: string;
  name: string;
  description: string;
  status: CollaborationTaskDraftStatus;
  relatedFeatureId: string;
  relatedFeatureName: string;
  order: number;
  dependencyNote?: string;
};

export type CollaborationOfficialTasksPayload = {
  tasks: CollaborationOfficialTaskDraft[];
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

export type CollaborationSuccessGenerateFeatures = {
  actionType: "GENERATE_FEATURES";
  status: "success";
  message: string;
  atIso: string;
  payload: CollaborationOfficialFeaturesPayload;
  generationSource: CollaborationGenerationSource;
};

export type CollaborationSuccessGenerateTasks = {
  actionType: "GENERATE_TASKS";
  status: "success";
  message: string;
  atIso: string;
  payload: CollaborationOfficialTasksPayload;
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
  | CollaborationSuccessGenerateFeatures
  | CollaborationSuccessGenerateTasks
  | CollaborationSuccessAnalysis
  | CollaborationSuccessIdeas
  | CollaborationRunningOrError;

export function isSuccessCollaborationResult(
  r: CollaborationActionResult
): r is
  | CollaborationSuccessGenerateMinutes
  | CollaborationSuccessGenerateFeatures
  | CollaborationSuccessGenerateTasks
  | CollaborationSuccessAnalysis
  | CollaborationSuccessIdeas {
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

  if (actionType === "GENERATE_FEATURES") {
    const payload = parseCollaborationOfficialFeaturesPayload(o.payload);
    if (!payload) return null;
    return {
      actionType: "GENERATE_FEATURES",
      status: "success",
      message: o.message,
      atIso: o.atIso,
      payload,
      generationSource: "mock_stub",
    };
  }

  if (actionType === "GENERATE_TASKS") {
    const payload = parseCollaborationOfficialTasksPayload(o.payload);
    if (!payload) return null;
    return {
      actionType: "GENERATE_TASKS",
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

  if (actionType === "REQUEST_IDEAS") {
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

  return null;
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

function isFeatureMockStatus(s: unknown): s is FeatureMock["status"] {
  return s === "DRAFT" || s === "PLANNED" || s === "IN_PROGRESS" || s === "DONE";
}

function parseFeatureMockItem(raw: unknown): FeatureMock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.description !== "string") return null;
  if (!isFeatureMockStatus(o.status)) return null;
  if (!Array.isArray(o.userFlow) || !o.userFlow.every((x) => typeof x === "string")) return null;
  if (!Array.isArray(o.nonFunctional) || !o.nonFunctional.every((x) => typeof x === "string")) return null;
  return {
    id: o.id,
    name: o.name,
    description: o.description,
    status: o.status,
    userFlow: o.userFlow,
    nonFunctional: o.nonFunctional,
  };
}

export function parseCollaborationOfficialFeaturesPayload(raw: unknown): CollaborationOfficialFeaturesPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.features)) return null;
  const features: FeatureMock[] = [];
  for (const item of o.features) {
    const f = parseFeatureMockItem(item);
    if (!f) return null;
    features.push(f);
  }
  return { features };
}

function isTaskDraftStatus(s: unknown): s is CollaborationTaskDraftStatus {
  return s === "DRAFT" || s === "READY" || s === "BLOCKED";
}

function parseCollaborationOfficialTaskDraftItem(raw: unknown): CollaborationOfficialTaskDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.description !== "string") return null;
  if (!isTaskDraftStatus(o.status)) return null;
  if (typeof o.relatedFeatureId !== "string" || typeof o.relatedFeatureName !== "string") return null;
  if (typeof o.order !== "number" || !Number.isFinite(o.order)) return null;
  if (o.dependencyNote !== undefined && typeof o.dependencyNote !== "string") return null;
  const out: CollaborationOfficialTaskDraft = {
    id: o.id,
    name: o.name,
    description: o.description,
    status: o.status,
    relatedFeatureId: o.relatedFeatureId,
    relatedFeatureName: o.relatedFeatureName,
    order: o.order,
  };
  if (typeof o.dependencyNote === "string") {
    out.dependencyNote = o.dependencyNote;
  }
  return out;
}

export function parseCollaborationOfficialTasksPayload(raw: unknown): CollaborationOfficialTasksPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.tasks)) return null;
  const tasks: CollaborationOfficialTaskDraft[] = [];
  for (const item of o.tasks) {
    const t = parseCollaborationOfficialTaskDraftItem(item);
    if (!t) return null;
    tasks.push(t);
  }
  return { tasks };
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
