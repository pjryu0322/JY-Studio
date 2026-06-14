import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { PreviewCaptureRegionRect } from "@/lib/preview/previewCaptureTypes";

export const PREVIEW_REGION_CAPTURE_INTERNAL_TYPE = "preview_region_capture" as const;

export const JYO_PREVIEW_REGION_CAPTURE_SENT = "jyo_preview_region_capture_sent" as const;

export type PreviewRegionCaptureSentMessage = Readonly<{
  readonly type: typeof JYO_PREVIEW_REGION_CAPTURE_SENT;
  readonly projectId: string;
  readonly messageId?: string;
}>;

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

export function notifyPreviewRegionCaptureSentToOpener(input: {
  readonly projectId: string;
  readonly messageId?: string;
}): void {
  if (typeof window === "undefined") return;
  const opener = window.opener;
  if (!opener || opener.closed) return;
  const payload: PreviewRegionCaptureSentMessage = {
    type: JYO_PREVIEW_REGION_CAPTURE_SENT,
    projectId: input.projectId.trim(),
    ...(input.messageId ? { messageId: input.messageId } : {}),
  };
  opener.postMessage(payload, window.location.origin);
}

export function isPreviewRegionCaptureSentMessage(data: unknown): data is PreviewRegionCaptureSentMessage {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return o.type === JYO_PREVIEW_REGION_CAPTURE_SENT && typeof o.projectId === "string";
}
