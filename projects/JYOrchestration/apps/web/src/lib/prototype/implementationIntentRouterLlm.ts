import { runLlmIntentRouterCore } from "@/lib/intent-router/llmIntentRouterCore";
import {
  IMPLEMENTATION_ROUTER_ACTION_IDS,
  isImplementationActionId,
  type ImplementationActionId,
  type ImplementationIntentClassification,
  type ImplementationIntentType,
} from "@/lib/prototype/implementationIntentRouterTypes";
import type { ImplementationExtractedRule } from "@/lib/prototype/implementationUserFeedback";

export type ImplementationIntentRouterLlmInput = Readonly<{
  userMessage: string;
  projectName: string;
  projectDescription: string;
  envOk: boolean;
  templatePlanningReady: boolean;
  implementationSeedReady: boolean;
  hasWorkUnits: boolean;
  plannerRunning: boolean;
  plannerCreatePending: boolean;
  visibleActionLabels: readonly string[];
  implementationBootstrapSummary?: string;
  latestRunStatus?: string | null;
}>;

const INTENT_TYPES = new Set([
  "orchestration_action",
  "status_query",
  "implementation_requirement",
  "implementation_question",
  "mixed",
  "unknown",
]);

function buildImplementationIntentRouterSystemPrompt(): string {
  return [
    "You are the JYOrchestration implementation-stage intent router.",
    "Return ONLY one JSON object. No markdown.",
    "You do NOT execute actions or mutate state.",
    "Classify user input into implementation actions, status queries, requirements, questions, or mixed.",
    "",
    "Rules:",
    '- "구현 작업안 생성해줘", "구현 작업안 초안 생성", "작업계획 생성" → CREATE_WORK_PLAN when user wants to start planning now.',
    '- "생성 전에 검토", "나중에 만들고" → shouldExecuteAction=false, implementation_question or ask_advice.',
    '- "업로드 mp3만 허용하고 작업안 생성" → mixed, extractedRules, targetAction=CREATE_WORK_PLAN.',
    '- SCM/환경/역할별 점검 보기 요청 → SHOW_SCM_CHECK, SHOW_ENV_CHECK, SHOW_ROLE_CHECK, etc.',
    "- General requirements without execute now → ADD_IMPLEMENTATION_REQUIREMENT.",
    "- Ambiguous → shouldExecuteAction=false, clarificationQuestion in Korean.",
    "",
    "Schema:",
    '{"intentType":"orchestration_action|status_query|implementation_requirement|implementation_question|mixed|unknown","suggestedActionId":"CREATE_WORK_PLAN|...|NO_ACTION|null","confidence":0-1,"reason":"string","clarificationQuestion":"string|null","executionIntent":"explicit_execute|ask_advice|ask_explain|ask_compare|ambiguous","actionInvocationStrength":"explicit|implicit|weak","extractedRules":[{"label":"string","value":"string","normalizedValue":"string","confidence":"high|medium|low"}],"requiresPreActionPatch":boolean,"shouldExecuteAction":boolean,"targetAction":"CREATE_WORK_PLAN|...|null"}',
  ].join("\n");
}

function parseExtractedRules(raw: unknown): ImplementationExtractedRule[] {
  if (!Array.isArray(raw)) return [];
  const out: ImplementationExtractedRule[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const value = typeof o.value === "string" ? o.value.trim() : "";
    if (!label || !value) continue;
    const confRaw = String(o.confidence ?? "medium");
    const confidence =
      confRaw === "high" || confRaw === "medium" || confRaw === "low" ? confRaw : "medium";
    out.push({
      label,
      value,
      normalizedValue: typeof o.normalizedValue === "string" ? o.normalizedValue.trim() : undefined,
      confidence,
    });
  }
  return out;
}

function toClassification(
  parsed: {
    intentType: string;
    suggestedActionId: ImplementationActionId | null;
    confidence: number;
    reason?: string;
    clarificationQuestion?: string;
    executionIntent: ImplementationIntentClassification["executionIntent"];
    actionInvocationStrength: ImplementationIntentClassification["actionInvocationStrength"];
  },
  rawJson: Record<string, unknown>,
): ImplementationIntentClassification {
  const intentTypeRaw = String(parsed.intentType ?? "unknown");
  const intentType = INTENT_TYPES.has(intentTypeRaw)
    ? (intentTypeRaw as ImplementationIntentType)
    : "unknown";
  const extractedRules = parseExtractedRules(rawJson.extractedRules);
  const shouldExecuteAction = rawJson.shouldExecuteAction === true;
  const requiresPreActionPatch = rawJson.requiresPreActionPatch === true;
  const targetRaw = rawJson.targetAction ?? parsed.suggestedActionId;
  const targetAction =
    typeof targetRaw === "string" && isImplementationActionId(targetRaw) ? targetRaw : parsed.suggestedActionId;

  return {
    intentType,
    suggestedActionId: parsed.suggestedActionId,
    confidence: parsed.confidence,
    reason: parsed.reason,
    clarificationQuestion: parsed.clarificationQuestion ?? null,
    executionIntent: parsed.executionIntent,
    actionInvocationStrength: parsed.actionInvocationStrength,
    extractedRules,
    requiresPreActionPatch,
    shouldExecuteAction,
    targetAction,
    routerSource: "llm",
  };
}

export async function classifyImplementationIntentWithLlm(
  input: ImplementationIntentRouterLlmInput,
): Promise<
  | Readonly<{ ok: true; classification: ImplementationIntentClassification }>
  | Readonly<{ ok: false; code: string }>
> {
  const res = await runLlmIntentRouterCore({
    systemPrompt: buildImplementationIntentRouterSystemPrompt(),
    userPayload: {
      userMessage: input.userMessage,
      projectName: input.projectName,
      projectDescription: String(input.projectDescription ?? "").slice(0, 800),
      envOk: input.envOk,
      templatePlanningReady: input.templatePlanningReady,
      implementationSeedReady: input.implementationSeedReady,
      hasWorkUnits: input.hasWorkUnits,
      plannerRunning: input.plannerRunning,
      plannerCreatePending: input.plannerCreatePending,
      availableActionIds: IMPLEMENTATION_ROUTER_ACTION_IDS,
      visibleActionLabels: input.visibleActionLabels,
      implementationBootstrapSummary: input.implementationBootstrapSummary ?? null,
      latestRunStatus: input.latestRunStatus ?? null,
    },
    pickableActionIds: IMPLEMENTATION_ROUTER_ACTION_IDS,
    isPickableActionId: isImplementationActionId,
    maxTokens: 520,
  });

  if (!res.ok) return { ok: false, code: res.code };

  let rawObj: Record<string, unknown> = {};
  try {
    rawObj = JSON.parse(res.rawText) as Record<string, unknown>;
  } catch {
    rawObj = {};
  }

  return { ok: true, classification: toClassification(res.parsed, rawObj) };
}
