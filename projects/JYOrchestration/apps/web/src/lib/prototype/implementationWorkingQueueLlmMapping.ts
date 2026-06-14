import type { WorkingQueueControlIntent } from "@/lib/prototype/implementationWorkingQueueControlIntent";
import type { ImplementationIntentResolverResult } from "@/lib/prototype/implementationIntentResolverTypes";
import type { ImplementationWorkingQueueItem, ImplementationWorkingQueueV1 } from "@/lib/prototype/implementationWorkingQueueTypes";

export function mapIntentResolverToControlIntent(input: Readonly<{
  resolver: ImplementationIntentResolverResult;
  queue: ImplementationWorkingQueueV1;
}>): WorkingQueueControlIntent | null {
  if (input.resolver.intent !== "approve_pending_work_queue") return null;
  const pending = input.queue.items.filter((i) => i.status === "pending");
  if (!pending.length) return null;

  const ids = input.resolver.targetQueueItemIds ?? [];
  if (ids.length === 1 && ids[0] === "latest_pending") {
    return { kind: "approve_ids", ids: [pending[pending.length - 1]!.id] };
  }
  if (ids.includes("latest_pending_preview_feedback")) {
    const previewPending = [...pending].reverse().find((i) => Boolean(i.regionCaptureId || i.sourceCaptureId));
    if (previewPending) return { kind: "approve_ids", ids: [previewPending.id] };
  }

  const resolvedIds = ids.filter((id) => pending.some((p) => p.id === id));
  if (resolvedIds.length === 1) return { kind: "approve_ids", ids: resolvedIds };
  if (resolvedIds.length > 1) return { kind: "approve_ids", ids: resolvedIds };

  if (pending.length === 1) return { kind: "approve_ids", ids: [pending[0]!.id] };
  return { kind: "approve_all" };
}

export function buildWorkingQueueTimelineTrace(input: Readonly<{
  action: string;
  source: string;
  detail?: string;
  nowIso: string;
}>): import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry {
  return {
    id: `impl-wq-llm-${input.nowIso}`,
    createdAt: input.nowIso,
    action: input.action,
    responseText: [input.source, input.detail].filter(Boolean).join(" · ").slice(0, 800),
  };
}

export function queueItemFromPreviewAnalysis(input: Readonly<{
  analysis: import("@/lib/prototype/implementationPreviewFeedbackTypes").ImplementationPreviewFeedbackAnalysis;
  projectId: string;
  rawUserMessage: string;
  sourceMessageId?: string;
  captureContext?: ReturnType<
    typeof import("@/lib/prototype/previewCaptureSingleChatBridge").extractPreviewCaptureContextFromUserMessage
  >;
  itemId: string;
  nowIso: string;
}>): ImplementationWorkingQueueItem {
  const ctx = input.captureContext ?? {};
  return {
    id: input.itemId,
    projectId: input.projectId.trim(),
    sourceMessageId: input.sourceMessageId,
    rawUserMessage: input.rawUserMessage.trim(),
    title: input.analysis.title,
    description: input.analysis.description,
    targetUi: input.analysis.targetUi,
    desiredBehavior: input.analysis.desiredBehavior,
    affectedArea: input.analysis.affectedArea,
    status: "pending",
    riskLevel: input.analysis.riskLevel,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
    ...(ctx.sourceCaptureId ? { sourceCaptureId: ctx.sourceCaptureId } : {}),
    ...(ctx.regionCaptureId ? { regionCaptureId: ctx.regionCaptureId } : {}),
    ...(ctx.previewUrl ? { previewUrl: ctx.previewUrl } : {}),
    ...(ctx.rect ? { rect: ctx.rect } : {}),
  };
}
