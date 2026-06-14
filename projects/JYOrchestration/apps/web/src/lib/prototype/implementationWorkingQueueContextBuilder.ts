import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ImplementationIntentResolverInput } from "@/lib/prototype/implementationIntentResolverTypes";
import type { ImplementationWorkingQueueV1 } from "@/lib/prototype/implementationWorkingQueueTypes";
import {
  extractPreviewCaptureContextFromUserMessage,
  hasPreviewRegionCaptureAttachment,
} from "@/lib/prototype/previewCaptureSingleChatBridge";
import type { ImplementationPreviewFeedbackAnalyzerInput } from "@/lib/prototype/implementationPreviewFeedbackTypes";

const RECENT_LIMIT = 8;

export function recentMessagesForWorkingQueueLlm(
  messages: readonly RequirementsMessage[],
): ImplementationIntentResolverInput["recentMessages"] {
  const tail = messages.slice(-RECENT_LIMIT);
  return tail.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: String(m.content ?? "").trim(),
    ...(m.meta && typeof m.meta === "object" ? { meta: m.meta as Record<string, unknown> } : {}),
  }));
}

export function lastAssistantMessageContent(messages: readonly RequirementsMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === "ai" || m?.speakerType === "AI") {
      const c = String(m.content ?? "").trim();
      if (c) return c;
    }
  }
  return undefined;
}

export function buildImplementationIntentResolverInput(input: Readonly<{
  projectId: string;
  userText: string;
  userMsg: RequirementsMessage;
  priorMessages: readonly RequirementsMessage[];
  queue: ImplementationWorkingQueueV1;
  hasRunnableCodeTasks?: boolean;
  implementationMode?: string;
}>): ImplementationIntentResolverInput {
  const pending = input.queue.items.filter((i) => i.status === "pending");
  const hasPreview = hasPreviewRegionCaptureAttachment({ meta: input.userMsg.meta });
  const actions: ImplementationIntentResolverInput["availableActions"] = [
    "none",
    "ask_clarification",
    "approve_pending_work_queue",
    "register_work_queue_supplement",
  ];
  if (hasPreview) actions.push("register_preview_feedback");
  if (input.hasRunnableCodeTasks) actions.push("start_initial_quick_run");

  return {
    projectId: input.projectId.trim(),
    stage: "implementation",
    userText: input.userText.trim(),
    lastAssistantMessage: lastAssistantMessageContent(input.priorMessages),
    recentMessages: recentMessagesForWorkingQueueLlm(input.priorMessages),
    pendingWorkingQueueItems: pending.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      riskLevel: i.riskLevel,
    })),
    hasPreviewCaptureAttachment: hasPreview,
    implementationMode: input.implementationMode,
    hasRunnableCodeTasks: input.hasRunnableCodeTasks,
    availableActions: actions,
  };
}

export function buildPreviewFeedbackAnalyzerInput(input: Readonly<{
  projectId: string;
  userText: string;
  userMsg: RequirementsMessage;
  priorMessages: readonly RequirementsMessage[];
}>): ImplementationPreviewFeedbackAnalyzerInput {
  const ctx = extractPreviewCaptureContextFromUserMessage(input.userMsg);
  const meta = input.userMsg.meta as Record<string, unknown> | undefined;
  const imageDataUrl =
    typeof meta?.previewRegionCaptureImageDataUrl === "string"
      ? meta.previewRegionCaptureImageDataUrl
      : undefined;
  return {
    projectId: input.projectId.trim(),
    userText: input.userText.trim(),
    previewUrl: ctx?.previewUrl,
    captureId: ctx?.sourceCaptureId,
    regionCaptureId: ctx?.regionCaptureId,
    rect: ctx?.rect,
    ...(imageDataUrl ? { imageDataUrl } : {}),
    recentMessages: recentMessagesForWorkingQueueLlm(input.priorMessages).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };
}
