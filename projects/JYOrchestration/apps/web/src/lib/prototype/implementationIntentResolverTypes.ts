import type { ImplementationWorkingQueueAffectedArea, ImplementationWorkingQueueRiskLevel } from "@/lib/prototype/implementationWorkingQueueTypes";

export const IMPLEMENTATION_INTENT_RESOLVER_INTENTS = [
  "start_initial_quick_run",
  "approve_pending_work_queue",
  "register_preview_feedback",
  "register_work_queue_supplement",
  "implementation_question",
  "ask_clarification",
  "none",
] as const;

export type ImplementationIntentResolverIntent = (typeof IMPLEMENTATION_INTENT_RESOLVER_INTENTS)[number];

export type ImplementationIntentResolverConfidence = "low" | "medium" | "high";

export type ImplementationIntentResolverInput = Readonly<{
  readonly projectId: string;
  readonly stage: "implementation";
  readonly userText: string;
  readonly lastAssistantMessage?: string;
  readonly recentMessages: ReadonlyArray<{
    readonly role: "user" | "assistant";
    readonly content: string;
    readonly meta?: Record<string, unknown>;
  }>;
  readonly pendingWorkingQueueItems: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly riskLevel?: string;
  }>;
  readonly hasPreviewCaptureAttachment: boolean;
  readonly implementationMode?: string;
  readonly hasRunnableCodeTasks?: boolean;
  readonly lastRegisteredQueueItem?: Readonly<{
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }> | null;
  readonly availableActions: ReadonlyArray<
    | "start_initial_quick_run"
    | "approve_pending_work_queue"
    | "register_preview_feedback"
    | "register_work_queue_supplement"
    | "ask_clarification"
    | "none"
  >;
}>;

export type ImplementationIntentResolverWorkQueueDraft = Readonly<{
  readonly title: string;
  readonly description: string;
  readonly affectedArea: ImplementationWorkingQueueAffectedArea;
  readonly riskLevel: ImplementationWorkingQueueRiskLevel;
}>;

export type ImplementationIntentResolverResult = Readonly<{
  readonly intent: ImplementationIntentResolverIntent;
  readonly confidence: ImplementationIntentResolverConfidence;
  readonly targetQueueItemIds?: readonly string[];
  readonly requiresConfirmation?: boolean;
  readonly clarificationQuestion?: string;
  readonly workQueueDraft?: ImplementationIntentResolverWorkQueueDraft;
  readonly reason: string;
}>;

export type ImplementationIntentResolverLlmTrace = Readonly<{
  readonly source: "llm" | "fallback";
  readonly model?: string;
  readonly reason?: string;
  readonly providerSource?: string;
}>;

const CONFIDENCE = new Set<ImplementationIntentResolverConfidence>(["low", "medium", "high"]);
const AREAS = new Set<ImplementationWorkingQueueAffectedArea>([
  "ui",
  "flow",
  "feature",
  "data",
  "style",
  "bug",
  "unknown",
]);
const RISKS = new Set<ImplementationWorkingQueueRiskLevel>(["low", "medium", "high"]);

export function parseImplementationIntentResolverJson(raw: unknown): ImplementationIntentResolverResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const intentRaw = String(o.intent ?? "none").trim();
  const intent = IMPLEMENTATION_INTENT_RESOLVER_INTENTS.includes(intentRaw as ImplementationIntentResolverIntent)
    ? (intentRaw as ImplementationIntentResolverIntent)
    : "none";
  const confidenceRaw = String(o.confidence ?? "medium").trim() as ImplementationIntentResolverConfidence;
  const confidence = CONFIDENCE.has(confidenceRaw) ? confidenceRaw : "medium";
  const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 500) : "";
  if (!reason) return null;

  const targetQueueItemIds = Array.isArray(o.targetQueueItemIds)
    ? o.targetQueueItemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : undefined;

  let workQueueDraft: ImplementationIntentResolverWorkQueueDraft | undefined;
  const draft = o.workQueueDraft;
  if (draft && typeof draft === "object") {
    const d = draft as Record<string, unknown>;
    const title = typeof d.title === "string" ? d.title.trim() : "";
    const description = typeof d.description === "string" ? d.description.trim() : "";
    const areaRaw = String(d.affectedArea ?? "unknown").trim() as ImplementationWorkingQueueAffectedArea;
    const riskRaw = String(d.riskLevel ?? "low").trim() as ImplementationWorkingQueueRiskLevel;
    if (title && description && AREAS.has(areaRaw) && RISKS.has(riskRaw)) {
      workQueueDraft = { title, description, affectedArea: areaRaw, riskLevel: riskRaw };
    }
  }

  const clarificationQuestion =
    typeof o.clarificationQuestion === "string" ? o.clarificationQuestion.trim().slice(0, 500) : undefined;

  return {
    intent,
    confidence,
    ...(targetQueueItemIds?.length ? { targetQueueItemIds } : {}),
    ...(o.requiresConfirmation === true ? { requiresConfirmation: true } : {}),
    ...(clarificationQuestion ? { clarificationQuestion } : {}),
    ...(workQueueDraft ? { workQueueDraft } : {}),
    reason,
  };
}
