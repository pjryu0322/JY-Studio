import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { PreviewCaptureRegionRect, PreviewCaptureViewport } from "@/lib/preview/previewCaptureTypes";
import type { ImplementationComposerPreviewRegionAttachment } from "@/lib/preview/implementationComposerAttachmentTypes";

export const PREVIEW_REGION_CAPTURE_INTERNAL_TYPE = "preview_region_capture" as const;

export const IMPLEMENTATION_USER_MESSAGE_WITH_PREVIEW_CAPTURE_INTERNAL_TYPE =
  "implementation_user_message_with_preview_capture" as const;

export const JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER = "jyo:implementation-preview-capture:attach-to-composer" as const;

/** @deprecated Use composer attach message instead */
export const JYO_PREVIEW_REGION_CAPTURE_SENT = "jyo_preview_region_capture_sent" as const;

export type PreviewCaptureComposerAttachMessage = Readonly<{
  readonly type: typeof JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER;
  readonly projectId: string;
  readonly stage: "implementation";
  readonly previewUrl: string;
  readonly captureId: string;
  readonly regionCaptureId: string;
  readonly imageUrl?: string;
  readonly imageDataUrl?: string;
  readonly memo?: string;
  readonly rect: PreviewCaptureRegionRect;
  readonly viewport: PreviewCaptureViewport;
}>;

export function buildUserMessageWithPreviewCaptureAttachment(input: {
  readonly userId: string;
  readonly content: string;
  readonly attachment: ImplementationComposerPreviewRegionAttachment;
  readonly replyTo?: string | null;
}): RequirementsMessage {
  const imageDataUrl = String(input.attachment.imageDataUrl ?? input.attachment.imageUrl ?? "").trim();
  return newRequirementsMessage({
    role: "user",
    speakerType: "USER",
    speakerId: input.userId,
    speakerName: "나",
    messageType: "STATEMENT",
    content: input.content.trim(),
    replyTo: input.replyTo ?? null,
    meta: {
      internalType: IMPLEMENTATION_USER_MESSAGE_WITH_PREVIEW_CAPTURE_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      previewUrl: input.attachment.previewUrl,
      captureId: input.attachment.captureId,
      regionCaptureId: input.attachment.regionCaptureId,
      previewRegionCaptureRect: input.attachment.rect,
      previewRegionCaptureImageDataUrl: imageDataUrl || undefined,
      previewRegionCaptureSource: "preview_region_capture",
    },
  });
}

/** @deprecated Immediate chat append — use composer staging + buildUserMessageWithPreviewCaptureAttachment */
export function buildPreviewRegionCaptureUserMessage(input: {
  readonly userId: string;
  readonly previewUrl: string;
  readonly captureId: string;
  readonly regionCaptureId: string;
  readonly rect: PreviewCaptureRegionRect;
  readonly memo?: string;
  readonly imageDataUrl: string;
}): RequirementsMessage {
  const lines = ["[Preview 영역 캡처]"];
  if (input.memo?.trim()) {
    lines.push(`메모: ${input.memo.trim()}`);
  }
  lines.push(`Preview URL: ${input.previewUrl.trim()}`);

  return newRequirementsMessage({
    role: "user",
    speakerType: "USER",
    speakerId: input.userId,
    speakerName: "나",
    messageType: "STATEMENT",
    content: lines.join("\n"),
    meta: {
      internalType: PREVIEW_REGION_CAPTURE_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      previewUrl: input.previewUrl.trim(),
      captureId: input.captureId,
      regionCaptureId: input.regionCaptureId,
      previewRegionCaptureRect: input.rect,
      previewRegionCaptureImageDataUrl: input.imageDataUrl,
      previewRegionCaptureSource: "preview_region_capture",
    },
  });
}

export function postPreviewCaptureAttachToComposerOpener(input: PreviewCaptureComposerAttachMessage): boolean {
  if (typeof window === "undefined") return false;
  const opener = window.opener;
  if (!opener || opener.closed) return false;
  opener.postMessage(input, window.location.origin);
  return true;
}

export function isPreviewCaptureComposerAttachMessage(data: unknown): data is PreviewCaptureComposerAttachMessage {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (o.type !== JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER) return false;
  if (o.stage !== "implementation") return false;
  if (typeof o.projectId !== "string" || !o.projectId.trim()) return false;
  if (typeof o.previewUrl !== "string" || !o.previewUrl.trim()) return false;
  if (typeof o.captureId !== "string" || !o.captureId.trim()) return false;
  if (typeof o.regionCaptureId !== "string" || !o.regionCaptureId.trim()) return false;
  const rect = o.rect;
  if (!rect || typeof rect !== "object") return false;
  const r = rect as Record<string, unknown>;
  return (
    typeof r.x === "number" &&
    typeof r.y === "number" &&
    typeof r.width === "number" &&
    typeof r.height === "number"
  );
}

export function composerAttachmentFromAttachMessage(
  message: PreviewCaptureComposerAttachMessage,
): ImplementationComposerPreviewRegionAttachment {
  return {
    id: message.regionCaptureId,
    type: "preview_region_capture",
    projectId: message.projectId.trim(),
    stage: "implementation",
    previewUrl: message.previewUrl.trim(),
    captureId: message.captureId.trim(),
    regionCaptureId: message.regionCaptureId.trim(),
    ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
    ...(message.imageDataUrl ? { imageDataUrl: message.imageDataUrl } : {}),
    ...(message.memo ? { memo: message.memo } : {}),
    rect: message.rect,
    viewport: message.viewport,
    createdAt: new Date().toISOString(),
  };
}
