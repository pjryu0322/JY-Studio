import type {
  WorkspaceTurnConfidence,
  WorkspaceTurnIntent,
  WorkspaceTurnModelResult,
  WorkspaceTurnPatchStatus,
  WorkspaceTurnTargetArea,
} from "@/lib/workspace-turn/workspaceTurnTypes";

const IMPLEMENTATION_INTENTS = new Set<WorkspaceTurnIntent>([
  "implementation_requirement",
  "implementation_preference",
  "implementation_question",
  "execution_request",
  "scope_change",
  "security_policy",
  "data_policy",
  "unknown",
]);

const IMPLEMENTATION_STATUSES = new Set<WorkspaceTurnPatchStatus>([
  "confirmed_candidate",
  "candidate",
  "question",
  "blocked",
  "none",
]);

const TARGET_AREAS = new Set<WorkspaceTurnTargetArea>([
  "implementation_seed",
  "implementation_work_plan_draft",
  "implementation_slots",
  "review_criteria",
  "security_criteria",
  "common_detail_features",
  "data_policy",
  "screen_implementation_items",
  "process_implementation_items",
  "actor_capability_matrix",
]);

function parseConfidence(raw: unknown): WorkspaceTurnConfidence {
  const v = String(raw ?? "medium").trim();
  return v === "high" || v === "low" ? v : "medium";
}

function parseIntent(raw: unknown): WorkspaceTurnIntent {
  const v = String(raw ?? "unknown").trim() as WorkspaceTurnIntent;
  return IMPLEMENTATION_INTENTS.has(v) ? v : "unknown";
}

function parseStatus(raw: unknown): WorkspaceTurnPatchStatus {
  const v = String(raw ?? "none").trim() as WorkspaceTurnPatchStatus;
  return IMPLEMENTATION_STATUSES.has(v) ? v : "none";
}

function parseRules(raw: unknown): WorkspaceTurnModelResult["extractedRules"] {
  if (!Array.isArray(raw)) return [];
  const out: WorkspaceTurnModelResult["extractedRules"][number][] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const label = String(r.label ?? "").trim();
    const value = String(r.value ?? "").trim();
    if (!label || !value) continue;
    out.push({
      label,
      value,
      ...(typeof r.normalizedValue === "string" && r.normalizedValue.trim()
        ? { normalizedValue: r.normalizedValue.trim() }
        : {}),
      confidence: parseConfidence(r.confidence),
    });
  }
  return out;
}

function parseTargetAreas(raw: unknown): WorkspaceTurnTargetArea[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => String(a ?? "").trim() as WorkspaceTurnTargetArea)
    .filter((a) => TARGET_AREAS.has(a));
}

/** 구현단계 LLM JSON → WorkspaceTurnModelResult */
export function validateImplementationTurnModelJson(raw: unknown): WorkspaceTurnModelResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const assistantMessage = String(o.assistantMessage ?? "").trim();
  if (!assistantMessage) return null;

  const intent = parseIntent(o.intent);
  const status = parseStatus(o.status);
  const requiresClarification = Boolean(o.requiresClarification);
  const clarifyingQuestion =
    o.clarifyingQuestion === null ? null : String(o.clarifyingQuestion ?? "").trim() || null;
  const nextQuestion = o.nextQuestion === null ? null : String(o.nextQuestion ?? "").trim() || null;

  return {
    intent,
    status,
    confidence: parseConfidence(o.confidence),
    responderLabel: String(o.responderLabel ?? "AI 개발자").trim() || "AI 개발자",
    assistantMessage,
    summary: String(o.summary ?? "").trim() || assistantMessage.slice(0, 200),
    extractedRules: parseRules(o.extractedRules),
    targetAreas: parseTargetAreas(o.targetAreas),
    requiresClarification,
    clarifyingQuestion,
    nextQuestion,
  };
}
