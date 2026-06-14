import { createFixCodeTasksFromApprovedQueueItems } from "@/lib/prototype/createFixCodeTasksFromApprovedQueueItems";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { parseWorkingQueueControlIntent } from "@/lib/prototype/implementationWorkingQueueApprovalIntent";
import { isImplementationSupplementRequest } from "@/lib/prototype/implementationWorkingQueueClassifier";
import {
  buildWorkingQueueControlAiMessage,
  buildWorkingQueuePreviewFeedbackRegisteredAiMessage,
  buildWorkingQueueRegisteredAiMessage,
} from "@/lib/prototype/implementationWorkingQueueMessages";
import { IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT } from "@/lib/prototype/implementationWorkingQueuePreviewFeedback";
import {
  applyWorkingQueueControlIntent,
  buildMemoryAfterQueueChange,
  enqueueWorkingQueuePreviewFeedback,
  enqueueWorkingQueueSupplement,
} from "@/lib/prototype/implementationWorkingQueueService";
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
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";

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

function buildWorkingQueueAssistantMessage(
  content: string,
  nowIso: string,
  metaExtra?: Readonly<{ readonly intent?: string }>,
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
      source: "fallback",
      ...(metaExtra?.intent ? { intent: metaExtra.intent } : {}),
    },
  });
}

export function resolveImplementationWorkingQueueOperationalSend(input: {
  readonly text: string;
  readonly userMsg: RequirementsMessage;
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly isDraftGenerationComplete: boolean;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly implementationBootstrapInput: ImplementationOrchestrationSummaryInput | null;
  readonly latestPreviewUrl?: string | null;
}): PrototypeExecutionOperationalSendResult | null {
  if (
    !shouldHandleImplementationWorkingQueueChat({
      isDraftGenerationComplete: input.isDraftGenerationComplete,
      parsedRequirementsState: input.parsedRequirementsState,
      implementationBootstrapInput: input.implementationBootstrapInput,
    })
  ) {
    return null;
  }

  const pid = input.projectId.trim();
  if (!pid) return null;

  const nowIso = new Date().toISOString();
  const queue = readImplementationWorkingQueueFromState(input.requirementsStateJson, pid);
  const priorMemory = readImplementationDeveloperMemoryDraftFromState(input.requirementsStateJson, pid);
  const priorMessages =
    resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson).messages ?? [];

  const controlIntent = parseWorkingQueueControlIntent(input.text);
  if (controlIntent) {
    const pendingCount = queue.items.filter((i) => i.status === "pending").length;
    if (pendingCount === 0) {
      return {
        kind: "assistant_reply",
        aiMessage: buildWorkingQueueAssistantMessage(
          buildWorkingQueueControlAiMessage({ approved: [], deferred: [], rejected: [] }),
          nowIso,
        ),
      };
    }
    const applied = applyWorkingQueueControlIntent({ queue, intent: controlIntent });
    const memory = buildMemoryAfterQueueChange({
      queue: applied.queue,
      prior: priorMemory,
      latestPreviewUrl: input.latestPreviewUrl,
    });
    const aiMessage = buildWorkingQueueAssistantMessage(
      buildWorkingQueueControlAiMessage(applied),
      nowIso,
    );
    if (applied.approved.length) {
      void createFixCodeTasksFromApprovedQueueItems(pid, applied.approved);
    }
    const orchestration: PrototypeExecutionOrchestrationPersistInput = {
      implementationWorkingQueueV1: applied.queue,
      implementationDeveloperMemoryDraftV1: memory,
    };
    return {
      kind: "apply_conversation",
      messages: [...priorMessages, input.userMsg, aiMessage],
      orchestration,
    };
  }

  const previewCaptureMessage = hasPreviewRegionCaptureAttachment({
    meta: input.userMsg.meta,
  });
  if (previewCaptureMessage) {
    const userText = input.text.trim();
    if (!userText) {
      return {
        kind: "assistant_reply",
        aiMessage: buildWorkingQueueAssistantMessage("보완 내용을 입력해 주세요.", nowIso, {
          intent: IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT,
        }),
      };
    }
    const captureContext = extractPreviewCaptureContextFromUserMessage(input.userMsg);
    const enqueued = enqueueWorkingQueuePreviewFeedback({
      queue,
      rawUserMessage: userText,
      sourceMessageId: input.userMsg.id,
      captureContext,
    });
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
    const orchestration: PrototypeExecutionOrchestrationPersistInput = {
      implementationWorkingQueueV1: enqueued.queue,
      implementationDeveloperMemoryDraftV1: memory,
    };
    return {
      kind: "apply_conversation",
      messages: [...priorMessages, input.userMsg, aiMessage],
      orchestration,
    };
  }

  if (!isImplementationSupplementRequest(input.text)) {
    return null;
  }

  const enqueued = enqueueWorkingQueueSupplement({
    queue,
    rawUserMessage: input.text,
    sourceMessageId: input.userMsg.id,
  });
  const memory = buildMemoryAfterQueueChange({
    queue: enqueued.queue,
    prior: priorMemory,
    latestPreviewUrl: input.latestPreviewUrl,
  });
  const aiMessage = buildWorkingQueueAssistantMessage(
    buildWorkingQueueRegisteredAiMessage([enqueued.item]),
    nowIso,
  );
  const orchestration: PrototypeExecutionOrchestrationPersistInput = {
    implementationWorkingQueueV1: enqueued.queue,
    implementationDeveloperMemoryDraftV1: memory,
  };
  return {
    kind: "apply_conversation",
    messages: [...priorMessages, input.userMsg, aiMessage],
    orchestration,
  };
}
