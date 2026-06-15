import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import {
  buildWorkingQueuePreviewFeedbackRegisteredAiMessage,
  buildWorkingQueueRegisteredAiMessage,
} from "@/lib/prototype/implementationWorkingQueueMessages";
import { attachRoleOrchestrationToWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueRoleWorkflow";
import {
  buildMemoryAfterQueueChange,
  enqueueWorkingQueueFromItem,
} from "@/lib/prototype/implementationWorkingQueueService";
import {
  CHAT_EXECUTION_REQUIRES_WORKING_QUEUE_BUTTON_MESSAGE,
  isChatBlockedExecutionIntent,
  isChatExecutionLikeText,
} from "@/lib/prototype/implementationWorkingQueueChatExecutionGuard";
import {
  buildImplementationIntentResolverInput,
  buildPreviewFeedbackAnalyzerInput,
} from "@/lib/prototype/implementationWorkingQueueContextBuilder";
import {
  postImplementationPreviewFeedbackAnalyze,
  postImplementationWorkingQueueIntentResolve,
} from "@/lib/prototype/implementationWorkingQueueLlmClient";
import {
  buildIntentClarificationMessage,
  buildIntentClarificationTimelineDetail,
  pendingCountFromQueue,
} from "@/lib/prototype/implementationWorkingQueueIntentClarification";
import {
  buildWorkingQueueTimelineTrace,
  queueItemFromPreviewAnalysis,
} from "@/lib/prototype/implementationWorkingQueueLlmMapping";
import { buildMinimalPreviewFeedbackFallback } from "@/lib/prototype/implementationPreviewFeedbackTypes";
import { IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT } from "@/lib/prototype/implementationWorkingQueuePreviewFeedback";
import {
  extractPreviewCaptureContextFromUserMessage,
  hasPreviewRegionCaptureAttachment,
} from "@/lib/prototype/previewCaptureSingleChatBridge";
import {
  readImplementationDeveloperMemoryDraftFromState,
  readImplementationWorkingQueueFromState,
} from "@/lib/prototype/implementationWorkingQueueState";
import type { ImplementationOrchestrationSummaryInput } from "@/lib/prototype/implementationOrchestrationSummary";
import type { PrototypeExecutionOperationalSendResult } from "@/lib/prototype/prototypeExecutionOperationalSendResult";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

export function shouldHandleImplementationWorkingQueueChat(input: {
  readonly isDraftGenerationComplete: boolean;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly implementationBootstrapInput: ImplementationOrchestrationSummaryInput | null;
}): boolean {
  if (input.isDraftGenerationComplete) return false;
  return Boolean(
    input.implementationBootstrapInput ||
      input.parsedRequirementsState.implementationSeedV1 ||
      input.parsedRequirementsState.implementationTaskListV1,
  );
}

function newQueueItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `iwq-${crypto.randomUUID()}`;
  }
  return `iwq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildWorkingQueueAssistantMessage(
  content: string,
  nowIso: string,
  metaExtra?: Readonly<{ readonly intent?: string; readonly source?: string }>,
): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  return newRequirementsMessage({
    id: `impl-working-queue-${nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: nowIso,
    meta: {
      internalType: "implementation_working_queue",
      serviceDesignStage: "implementation",
      source: metaExtra?.source ?? "llm",
      ...(metaExtra?.intent ? { intent: metaExtra.intent } : {}),
    },
  });
}

function buildChatExecutionBlockedResult(input: Readonly<{
  priorMessages: readonly RequirementsMessage[];
  userMsg: RequirementsMessage;
  nowIso: string;
  timelineEntries: readonly RequirementsPromptTimelineEntry[];
  reason: string;
}>): PrototypeExecutionOperationalSendResult {
  const timelineEntries = [
    ...input.timelineEntries,
    buildWorkingQueueTimelineTrace({
      action: "chat_execution_guard_blocked",
      source: "chat_execution_guard",
      detail: input.reason,
      nowIso: input.nowIso,
    }),
  ];
  return {
    kind: "assistant_reply",
    aiMessage: buildWorkingQueueAssistantMessage(
      CHAT_EXECUTION_REQUIRES_WORKING_QUEUE_BUTTON_MESSAGE,
      input.nowIso,
      { source: "chat_execution_guard" },
    ),
    timelineEntries,
  };
}

function enqueueFromLlmDraft(input: Readonly<{
  queue: ReturnType<typeof readImplementationWorkingQueueFromState>;
  draft: NonNullable<
    import("@/lib/prototype/implementationIntentResolverTypes").ImplementationIntentResolverWorkQueueDraft
  >;
  rawUserMessage: string;
  sourceMessageId?: string;
  nowIso: string;
}>): ImplementationWorkingQueueItem {
  return attachRoleOrchestrationToWorkingQueueItem({
    id: newQueueItemId(),
    projectId: input.queue.projectId.trim(),
    sourceMessageId: input.sourceMessageId,
    rawUserMessage: input.rawUserMessage.trim(),
    title: input.draft.title,
    description: input.draft.description,
    affectedArea: input.draft.affectedArea,
    status: "pending",
    riskLevel: input.draft.riskLevel,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  });
}

type OperationalSendInput = Readonly<{
  readonly text: string;
  readonly userMsg: RequirementsMessage;
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly isDraftGenerationComplete: boolean;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly implementationBootstrapInput: ImplementationOrchestrationSummaryInput | null;
  readonly latestPreviewUrl?: string | null;
  readonly hasRunnableCodeTasks?: boolean;
  readonly implementationMode?: string;
  readonly previewReady?: boolean;
}>;

function implementationIntentRequiresAuthoritativeLlm(intent: string): boolean {
  return intent === "register_work_queue_supplement";
}

function buildIntentClarificationOperationalResult(input: Readonly<{
  queue: ReturnType<typeof readImplementationWorkingQueueFromState>;
  priorMessages: readonly RequirementsMessage[];
  userMsg: RequirementsMessage;
  hasRunnableCodeTasks?: boolean;
  nowIso: string;
  timelineEntries: RequirementsPromptTimelineEntry[];
}>): PrototypeExecutionOperationalSendResult {
  const timelineEntries = [
    ...input.timelineEntries,
    buildWorkingQueueTimelineTrace({
      action: "implementation_intent_clarification",
      source: "llm_intent_resolver",
      detail: buildIntentClarificationTimelineDetail(),
      nowIso: input.nowIso,
    }),
  ];
  const aiMessage = buildWorkingQueueAssistantMessage(
    buildIntentClarificationMessage({
      pendingCount: pendingCountFromQueue(input.queue),
      hasRunnableCodeTasks: input.hasRunnableCodeTasks,
    }),
    input.nowIso,
    { intent: "ask_clarification" },
  );
  return {
    kind: "assistant_reply",
    aiMessage,
    timelineEntries,
  };
}

async function resolvePreviewCaptureFeedbackFirst(
  input: OperationalSendInput,
): Promise<PrototypeExecutionOperationalSendResult | null> {
  const pid = input.projectId.trim();
  if (!pid) return null;

  const nowIso = new Date().toISOString();
  const queue = readImplementationWorkingQueueFromState(input.requirementsStateJson, pid);
  const priorMemory = readImplementationDeveloperMemoryDraftFromState(input.requirementsStateJson, pid);
  const priorMessages =
    resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson).messages ?? [];
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  const userText = input.text.trim();
  if (!userText) {
    return {
      kind: "assistant_reply",
      aiMessage: buildWorkingQueueAssistantMessage("보완 내용을 입력해 주세요.", nowIso, {
        intent: IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT,
        source: "rule",
      }),
    };
  }

  const analyzerInput = buildPreviewFeedbackAnalyzerInput({
    projectId: pid,
    userText,
    userMsg: input.userMsg,
    priorMessages,
  });
  const analyzed = await postImplementationPreviewFeedbackAnalyze({
    projectId: pid,
    analyzerInput,
    requirementsStateJson: input.requirementsStateJson,
  });
  const analysis =
    analyzed.success && analyzed.data ? analyzed.data.analysis : buildMinimalPreviewFeedbackFallback(userText);
  const trace = analyzed.data?.trace;

  timelineEntries.push(
    buildWorkingQueueTimelineTrace({
      action: "implementation_preview_feedback_analyzed",
      source: trace?.source ?? "fallback",
      detail: [trace?.reason, trace?.fallbackReason, trace?.usedVision ? "usedVision=true" : "image_analysis_limited"]
        .filter(Boolean)
        .join(" · "),
      nowIso,
    }),
  );

  if (analysis.needsClarification && analysis.clarificationQuestion) {
    return {
      kind: "assistant_reply",
      aiMessage: buildWorkingQueueAssistantMessage(analysis.clarificationQuestion, nowIso, {
        intent: IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT,
      }),
      timelineEntries,
    };
  }

  const captureContext = extractPreviewCaptureContextFromUserMessage(input.userMsg);
  const item = queueItemFromPreviewAnalysis({
    analysis,
    projectId: pid,
    rawUserMessage: userText,
    sourceMessageId: input.userMsg.id,
    captureContext,
    itemId: newQueueItemId(),
    nowIso,
  });
  const enqueued = enqueueWorkingQueueFromItem({ queue, item });
  const memory = buildMemoryAfterQueueChange({
    queue: enqueued.queue,
    prior: priorMemory,
    latestPreviewUrl: input.latestPreviewUrl ?? captureContext?.previewUrl ?? null,
  });
  const aiMessage = buildWorkingQueueAssistantMessage(
    buildWorkingQueuePreviewFeedbackRegisteredAiMessage([enqueued.item]),
    nowIso,
    { intent: IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT },
  );
  return {
    kind: "apply_conversation",
    messages: [...priorMessages, input.userMsg, aiMessage],
    orchestration: {
      implementationWorkingQueueV1: enqueued.queue,
      implementationDeveloperMemoryDraftV1: memory,
    },
    timelineEntries,
  };
}

async function resolveNormalImplementationWorkingQueueSend(
  input: OperationalSendInput,
): Promise<PrototypeExecutionOperationalSendResult | null> {
  const pid = input.projectId.trim();
  if (!pid) return null;

  const nowIso = new Date().toISOString();
  const queue = readImplementationWorkingQueueFromState(input.requirementsStateJson, pid);
  const priorMemory = readImplementationDeveloperMemoryDraftFromState(input.requirementsStateJson, pid);
  const priorMessages =
    resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson).messages ?? [];

  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  if (isChatExecutionLikeText(input.text)) {
    return buildChatExecutionBlockedResult({
      priorMessages,
      userMsg: input.userMsg,
      nowIso,
      timelineEntries,
      reason: "execution_requires_explicit_working_queue_button",
    });
  }

  const resolverInput = buildImplementationIntentResolverInput({
    projectId: pid,
    userText: input.text,
    userMsg: input.userMsg,
    priorMessages,
    queue,
    hasRunnableCodeTasks: input.hasRunnableCodeTasks,
    runnableCodeTaskCount: input.parsedRequirementsState.implementationTaskListV1?.tasks?.length ?? 0,
    implementationMode: input.implementationMode,
    previewReady: input.previewReady,
  });

  const resolved = await postImplementationWorkingQueueIntentResolve({
    projectId: pid,
    resolverInput,
    requirementsStateJson: input.requirementsStateJson,
  });
  const resolver = resolved.success && resolved.data ? resolved.data.result : null;
  const intentTrace = resolved.data?.trace;

  const clarificationBase = {
    queue,
    priorMessages,
    userMsg: input.userMsg,
    hasRunnableCodeTasks: input.hasRunnableCodeTasks,
    nowIso,
    timelineEntries,
  };

  if (!resolver || intentTrace?.source === "fallback") {
    return buildIntentClarificationOperationalResult(clarificationBase);
  }

  const llmAuthoritative = intentTrace?.source === "llm" && resolver.confidence !== "low";

  timelineEntries.push(
    buildWorkingQueueTimelineTrace({
      action: "implementation_intent_resolved",
      source: intentTrace?.source ?? "llm",
      detail: `${resolver.intent} · ${resolver.reason}`,
      nowIso,
    }),
  );

  if (
    implementationIntentRequiresAuthoritativeLlm(resolver.intent) &&
    !llmAuthoritative
  ) {
    return buildIntentClarificationOperationalResult({ ...clarificationBase, timelineEntries });
  }

  if (isChatBlockedExecutionIntent(resolver.intent)) {
    return buildChatExecutionBlockedResult({
      priorMessages,
      userMsg: input.userMsg,
      nowIso,
      timelineEntries,
      reason: `blocked_intent:${resolver.intent}`,
    });
  }

  if (resolver.intent === "ask_clarification" && resolver.clarificationQuestion) {
    return {
      kind: "assistant_reply",
      aiMessage: buildWorkingQueueAssistantMessage(resolver.clarificationQuestion, nowIso, {
        intent: resolver.intent,
      }),
      timelineEntries,
    };
  }

  if (resolver.intent === "register_work_queue_supplement" && resolver.workQueueDraft) {
    const item = enqueueFromLlmDraft({
      queue,
      draft: resolver.workQueueDraft,
      rawUserMessage: input.text,
      sourceMessageId: input.userMsg.id,
      nowIso,
    });
    const enqueued = enqueueWorkingQueueFromItem({ queue, item });
    const memory = buildMemoryAfterQueueChange({
      queue: enqueued.queue,
      prior: priorMemory,
      latestPreviewUrl: input.latestPreviewUrl,
    });
    const aiMessage = buildWorkingQueueAssistantMessage(
      buildWorkingQueueRegisteredAiMessage([enqueued.item]),
      nowIso,
      { intent: "register_work_queue_supplement" },
    );
    return {
      kind: "apply_conversation",
      messages: [...priorMessages, input.userMsg, aiMessage],
      orchestration: {
        implementationWorkingQueueV1: enqueued.queue,
        implementationDeveloperMemoryDraftV1: memory,
      },
      timelineEntries,
    };
  }

  if (resolver.intent === "none" || resolver.intent === "implementation_question") {
    return null;
  }

  return null;
}

export async function resolveImplementationWorkingQueueOperationalSend(
  input: OperationalSendInput,
): Promise<PrototypeExecutionOperationalSendResult | null> {
  if (hasPreviewRegionCaptureAttachment({ meta: input.userMsg.meta })) {
    return resolvePreviewCaptureFeedbackFirst(input);
  }

  if (
    !shouldHandleImplementationWorkingQueueChat({
      isDraftGenerationComplete: input.isDraftGenerationComplete,
      parsedRequirementsState: input.parsedRequirementsState,
      implementationBootstrapInput: input.implementationBootstrapInput,
    })
  ) {
    return null;
  }

  return resolveNormalImplementationWorkingQueueSend(input);
}
