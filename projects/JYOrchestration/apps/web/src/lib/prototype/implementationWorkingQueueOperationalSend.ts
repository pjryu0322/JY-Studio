import { createFixCodeTasksFromApprovedQueueItems } from "@/lib/prototype/createFixCodeTasksFromApprovedQueueItems";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { parseWorkingQueueControlIntent } from "@/lib/prototype/implementationWorkingQueueApprovalIntent";
import {
  buildWorkingQueueControlAiMessage,
  buildWorkingQueuePreviewFeedbackRegisteredAiMessage,
  buildWorkingQueueRegisteredAiMessage,
} from "@/lib/prototype/implementationWorkingQueueMessages";
import { IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT } from "@/lib/prototype/implementationWorkingQueuePreviewFeedback";
import {
  applyWorkingQueueControlIntent,
  buildMemoryAfterQueueChange,
  enqueueWorkingQueueFromItem,
} from "@/lib/prototype/implementationWorkingQueueService";
import {
  buildImplementationIntentResolverInput,
  buildPreviewFeedbackAnalyzerInput,
} from "@/lib/prototype/implementationWorkingQueueContextBuilder";
import {
  postImplementationPreviewFeedbackAnalyze,
  postImplementationWorkingQueueIntentResolve,
} from "@/lib/prototype/implementationWorkingQueueLlmClient";
import {
  buildWorkingQueueTimelineTrace,
  mapIntentResolverToControlIntent,
  queueItemFromPreviewAnalysis,
} from "@/lib/prototype/implementationWorkingQueueLlmMapping";
import { buildMinimalPreviewFeedbackFallback } from "@/lib/prototype/implementationPreviewFeedbackTypes";
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

function applyControlIntentResult(input: Readonly<{
  pid: string;
  queue: ReturnType<typeof readImplementationWorkingQueueFromState>;
  priorMemory: ReturnType<typeof readImplementationDeveloperMemoryDraftFromState>;
  priorMessages: readonly RequirementsMessage[];
  userMsg: RequirementsMessage;
  controlIntent: NonNullable<ReturnType<typeof parseWorkingQueueControlIntent>>;
  latestPreviewUrl?: string | null;
  nowIso: string;
  timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>): PrototypeExecutionOperationalSendResult {
  const pendingCount = input.queue.items.filter((i) => i.status === "pending").length;
  if (pendingCount === 0) {
    return {
      kind: "assistant_reply",
      aiMessage: buildWorkingQueueAssistantMessage(
        buildWorkingQueueControlAiMessage({ approved: [], deferred: [], rejected: [] }),
        input.nowIso,
      ),
      timelineEntries: input.timelineEntries,
    };
  }
  const applied = applyWorkingQueueControlIntent({ queue: input.queue, intent: input.controlIntent });
  const memory = buildMemoryAfterQueueChange({
    queue: applied.queue,
    prior: input.priorMemory,
    latestPreviewUrl: input.latestPreviewUrl,
  });
  const aiMessage = buildWorkingQueueAssistantMessage(buildWorkingQueueControlAiMessage(applied), input.nowIso);
  if (applied.approved.length) {
    void createFixCodeTasksFromApprovedQueueItems(input.pid, applied.approved);
  }
  return {
    kind: "apply_conversation",
    messages: [...input.priorMessages, input.userMsg, aiMessage],
    orchestration: {
      implementationWorkingQueueV1: applied.queue,
      implementationDeveloperMemoryDraftV1: memory,
    },
    timelineEntries: input.timelineEntries,
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
  return {
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
  };
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
}>;

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
  const analyzed = await postImplementationPreviewFeedbackAnalyze({ projectId: pid, analyzerInput });
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

  const resolverInput = buildImplementationIntentResolverInput({
    projectId: pid,
    userText: input.text,
    userMsg: input.userMsg,
    priorMessages,
    queue,
    hasRunnableCodeTasks: input.hasRunnableCodeTasks,
    implementationMode: input.implementationMode,
  });

  const resolved = await postImplementationWorkingQueueIntentResolve({ projectId: pid, resolverInput });
  const resolver = resolved.success && resolved.data ? resolved.data.result : null;
  const intentTrace = resolved.data?.trace;

  if (resolver) {
    timelineEntries.push(
      buildWorkingQueueTimelineTrace({
        action: "implementation_intent_resolved",
        source: intentTrace?.source ?? "fallback",
        detail: `${resolver.intent} · ${resolver.reason}`,
        nowIso,
      }),
    );

    if (resolver.intent === "start_initial_quick_run" && resolver.confidence !== "low") {
      return { kind: "start_implementation_quick_run", timelineEntries };
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

    const controlFromLlm = mapIntentResolverToControlIntent({ resolver, queue });
    if (controlFromLlm) {
      return applyControlIntentResult({
        pid,
        queue,
        priorMemory,
        priorMessages,
        userMsg: input.userMsg,
        controlIntent: controlFromLlm,
        latestPreviewUrl: input.latestPreviewUrl,
        nowIso,
        timelineEntries,
      });
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
  }

  const legacyControl = parseWorkingQueueControlIntent(input.text);
  if (legacyControl && intentTrace?.source === "fallback") {
    timelineEntries.push(
      buildWorkingQueueTimelineTrace({
        action: "implementation_intent_resolved",
        source: "fallback_legacy_control",
        detail: legacyControl.kind,
        nowIso,
      }),
    );
    return applyControlIntentResult({
      pid,
      queue,
      priorMemory,
      priorMessages,
      userMsg: input.userMsg,
      controlIntent: legacyControl,
      latestPreviewUrl: input.latestPreviewUrl,
      nowIso,
      timelineEntries,
    });
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
