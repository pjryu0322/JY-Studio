/**
 * LLM Intent Router — JSON-only action classification (no execution / no state writes).
 */

import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiFromEnv } from "@/lib/ai/openAiEnv";
import { isQuickActionId, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { getQuickActionCategory } from "@/lib/requirements/requirementsQuickActionPolicy";
import {
  actionIdsForLlmIntentRouter,
  normalizeActionInvocationStrength,
  normalizeExecutionIntent,
  type IntentRoutingResult,
  type IntentType,
  type RequirementsIntentRouterInput,
} from "@/lib/requirements/requirementsIntentRouterTypes";
import { memorySummaryForRouterPayload } from "@/lib/requirements/requirementsConversationMemory";
import { buildProjectionSummaryForIntentRouter } from "@/lib/requirements/requirementsIntentRouterTypes";

export type RequirementsIntentRouterLlmResult =
  | Readonly<{ readonly ok: true; readonly intent: IntentRoutingResult; readonly model: string; readonly promptText: string }>
  | Readonly<{ readonly ok: false; readonly code: string; readonly message: string }>;

const INTENT_TYPES = new Set<IntentType>([
  "orchestration_action",
  "artifact_action",
  "view_action",
  "edit_request",
  "question",
  "unknown",
]);

function intentTypeForAction(id: QuickActionId): IntentType {
  const cat = getQuickActionCategory(id);
  if (cat === "artifact_action") return "artifact_action";
  if (cat === "view_action") return "view_action";
  if (id === "EDIT_FEATURES" || id === "EDIT_STEPS") return "edit_request";
  return "orchestration_action";
}

function buildIntentRouterSystemPrompt(): string {
  return [
    "You are a requirements workshop intent classifier for JYOrchestration.",
    "Return ONLY a single JSON object. No markdown.",
    "You do NOT execute actions, transitions, or state mutations.",
    "Pick suggestedActionId ONLY from the provided llmPickableActionIds list, or null if uncertain.",
    "For document/PDF/markdown/export requests, prefer OPEN_ARTIFACT_HUB over document generation actions.",
    "If uncertain, set suggestedActionId=null, intentType=unknown, and provide clarificationQuestion in Korean.",
    "confidence must be a number between 0 and 1.",
    "Classify executionIntent: explicit_execute | ask_advice | ask_explain | ask_compare | ambiguous.",
    "Classify actionInvocationStrength: explicit | implicit | weak.",
    "GENERATE_ALTERNATIVE only when the user explicitly asks for another alternative, alternative comparison, A/B comparison, or a different option from the current proposal.",
    "If the user asks to propose a procedure, review process, approval process, or planning content, use ask_advice — do not force GENERATE_ALTERNATIVE.",
    "If the user asks to add or reflect a step into the flow, route to flow update / direct input — not alternative generation.",
    "Strong execution actions (GENERATE_ALTERNATIVE, APPLY_PROPOSAL, APPROVE_FLOW, NEXT_STAGE) require actionInvocationStrength=explicit for free-text user messages.",
    "Schema:",
    '{"intentType":"orchestration_action|artifact_action|view_action|edit_request|question|unknown","suggestedActionId":string|null,"confidence":number,"reason":string,"clarificationQuestion":string,"executionIntent":"explicit_execute|ask_advice|ask_explain|ask_compare|ambiguous","actionInvocationStrength":"explicit|implicit|weak","extractedTargets":{"featureIds":[],"stepIds":[],"actorIds":[]}}',
  ].join("\n");
}

function buildIntentRouterUserPayload(input: RequirementsIntentRouterInput): string {
  const m = input.featureMetrics;
  const llmIds = actionIdsForLlmIntentRouter(input.availableActionIds);
  return JSON.stringify(
    {
      userMessage: input.userMessage,
      currentStage: input.authoritativeStage,
      conversationState: input.projection.conversationState ?? null,
      availableActionIds: input.availableActionIds,
      llmPickableActionIds: llmIds,
      chatVisibleActionIds: input.chatVisibleActionIds,
      featureMetrics: {
        featureCount: m.featureCount,
        confirmedFeatureCount: m.confirmedFeatureCount,
        candidateFeatureCount: m.candidateFeatureCount,
        partialFeatureCount: m.partialFeatureCount,
        featureCoverage: m.featureCoverage,
        hasConfirmedFeature: m.hasConfirmedFeature,
      },
      artifactPolicy: "Do not suggest GENERATE_DOCUMENT/EXPORT_*; use OPEN_ARTIFACT_HUB for document requests.",
      canvasPolicy: "Use OPEN_CANVAS when user wants to view service flow / diagram / canvas.",
      projectionSummary: buildProjectionSummaryForIntentRouter(input),
      projectName: input.projectName ?? "",
      projectDescription: String(input.projectDescription ?? "").slice(0, 800),
      orchestrationMemory: input.conversationMemory
        ? memorySummaryForRouterPayload(input.conversationMemory)
        : null,
    },
    null,
    0,
  );
}

function parseLlmIntentJson(text: string, pickable: readonly QuickActionId[]): IntentRoutingResult | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const intentTypeRaw = String(o.intentType ?? "unknown").trim() as IntentType;
  const intentType = INTENT_TYPES.has(intentTypeRaw) ? intentTypeRaw : "unknown";
  const suggestedRaw = o.suggestedActionId;
  const suggestedActionId =
    suggestedRaw === null || suggestedRaw === undefined || suggestedRaw === ""
      ? null
      : isQuickActionId(String(suggestedRaw)) && pickable.includes(String(suggestedRaw) as QuickActionId)
        ? (String(suggestedRaw) as QuickActionId)
        : null;
  const confidenceNum = Number(o.confidence);
  const confidence = Number.isFinite(confidenceNum) ? Math.min(1, Math.max(0, confidenceNum)) : 0;
  const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 400) : undefined;
  const clarificationQuestion =
    typeof o.clarificationQuestion === "string" ? o.clarificationQuestion.trim().slice(0, 500) : undefined;

  let extractedTargets: IntentRoutingResult["extractedTargets"];
  if (o.extractedTargets && typeof o.extractedTargets === "object") {
    const t = o.extractedTargets as Record<string, unknown>;
    extractedTargets = {
      ...(Array.isArray(t.featureIds) ? { featureIds: t.featureIds.map(String).filter(Boolean).slice(0, 12) } : {}),
      ...(Array.isArray(t.stepIds) ? { stepIds: t.stepIds.map(String).filter(Boolean).slice(0, 12) } : {}),
      ...(Array.isArray(t.actorIds) ? { actorIds: t.actorIds.map(String).filter(Boolean).slice(0, 12) } : {}),
    };
  }

  const resolvedIntentType =
    suggestedActionId ? intentTypeForAction(suggestedActionId) : intentType;

  return {
    intentType: resolvedIntentType,
    suggestedActionId,
    confidence,
    reason,
    clarificationQuestion,
    routerMode: "llm",
    extractedTargets,
    executionIntent: normalizeExecutionIntent(
      typeof o.executionIntent === "string" ? o.executionIntent : undefined,
    ),
    actionInvocationStrength: normalizeActionInvocationStrength(
      typeof o.actionInvocationStrength === "string" ? o.actionInvocationStrength : undefined,
    ),
  };
}

export async function routeRequirementsIntentWithLLM(
  input: RequirementsIntentRouterInput,
): Promise<RequirementsIntentRouterLlmResult> {
  const env = resolveOpenAiFromEnv();
  if (!env.ok) {
    return { ok: false, code: "NO_KEY", message: env.message };
  }

  const pickable = actionIdsForLlmIntentRouter(input.availableActionIds);
  const system = buildIntentRouterSystemPrompt();
  const user = buildIntentRouterUserPayload(input);
  const promptText = `${system}\n\n---\n\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey: env.apiKey,
    model: env.model,
    temperature: 0.1,
    maxTokens: 400,
    responseFormatJsonObject: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message };
  }

  const parsed = parseLlmIntentJson(res.text, pickable);
  if (!parsed) {
    return { ok: false, code: "PARSE", message: "LLM intent JSON parse failed" };
  }

  return { ok: true, intent: parsed, model: env.model, promptText };
}
