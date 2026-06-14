import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { readImplementationStageChatPatch } from "@/lib/prototype/implementationStageChatSnapshot";
import { buildPreviewRegionCaptureUserMessage } from "@/lib/prototype/previewCaptureSingleChatBridge";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  collectProjectPreviewUrlCandidates,
  validatePreviewCaptureTargetUrl,
} from "@/lib/preview/previewCaptureSecurity";
import {
  IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY,
  type ImplementationPreviewRegionCaptureV1,
  type PreviewCaptureRegionRequest,
} from "@/lib/preview/previewCaptureTypes";
import { dedupeRequirementsMessagesById } from "@/lib/requirements/requirementsMessage";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

export async function persistPreviewRegionCaptureAndChatMessage(input: {
  readonly body: PreviewCaptureRegionRequest;
  readonly userId: string;
  readonly platformOrigin: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly regionCaptureId: string; readonly messageId: string; readonly imageDataUrl: string }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly status: number }>
> {
  const row = await prisma.project.findUnique({
    where: { id: input.body.projectId },
    select: { requirementsStateJson: true },
  });
  if (!row) {
    return { ok: false, message: "프로젝트를 찾을 수 없습니다.", status: 404 };
  }

  const prior = parseRequirementsStateJson(row.requirementsStateJson) ?? {};
  const previewRuntime = parseImplementationPreviewRuntimeV1(prior.implementationPreviewRuntimeV1) ?? null;
  const allowed = collectProjectPreviewUrlCandidates({
    projectId: input.body.projectId,
    previewRuntime,
    platformOrigin: input.platformOrigin,
  });
  const security = validatePreviewCaptureTargetUrl({
    previewUrl: input.body.previewUrl,
    projectId: input.body.projectId,
    platformOrigin: input.platformOrigin,
    allowedPreviewUrls: allowed,
  });
  if (!security.ok) {
    return { ok: false, message: security.message, status: security.code === "security" ? 403 : 400 };
  }

  const regionCaptureId = crypto.randomUUID();
  const captureRecord: ImplementationPreviewRegionCaptureV1 = {
    id: regionCaptureId,
    projectId: input.body.projectId,
    stage: "implementation",
    previewUrl: input.body.previewUrl,
    source: "server_preview_capture",
    captureId: input.body.captureId,
    imageDataUrl: input.body.imageDataUrl,
    ...(input.body.memo ? { memo: input.body.memo } : {}),
    viewport: input.body.viewport,
    rect: input.body.rect,
    createdAt: new Date().toISOString(),
  };

  const priorCaptures = Array.isArray(
    (prior as Record<string, unknown>)[IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY],
  )
    ? ((prior as Record<string, unknown>)[IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY] as ImplementationPreviewRegionCaptureV1[])
    : [];
  const nextCaptures = [...priorCaptures, captureRecord].slice(-80);

  const chatFromState = readImplementationStageChatPatch(prior);
  const userMessage = buildPreviewRegionCaptureUserMessage({
    userId: input.userId,
    previewUrl: input.body.previewUrl,
    captureId: input.body.captureId,
    regionCaptureId,
    rect: input.body.rect,
    memo: input.body.memo,
    imageDataUrl: input.body.imageDataUrl,
  });
  const nextMessages = dedupeRequirementsMessagesById([...chatFromState.messages, userMessage]).slice(-400);

  const chatPatch = {
    messages: nextMessages,
    slots: chatFromState.slots,
    answers: chatFromState.answers,
    currentSlotKey: chatFromState.currentSlotKey,
  };

  const orchestrationPatch = buildPrototypeExecutionOrchestrationPersistPatch(prior, {
    chat: chatPatch,
  });
  const merged = mergeRequirementsStateJson(orchestrationPatch, {
    [IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY]: nextCaptures,
    lastSavedAt: new Date().toISOString(),
  });

  await prisma.project.update({
    where: { id: input.body.projectId },
    data: { requirementsStateJson: merged as object },
  });

  return {
    ok: true,
    regionCaptureId,
    messageId: userMessage.id,
    imageDataUrl: input.body.imageDataUrl,
  };
}
