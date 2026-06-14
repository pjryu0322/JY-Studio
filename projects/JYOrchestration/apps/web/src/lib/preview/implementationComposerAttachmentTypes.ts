import type { PreviewCaptureRegionRect, PreviewCaptureViewport } from "@/lib/preview/previewCaptureTypes";

export type ImplementationComposerPreviewRegionAttachment = Readonly<{
  readonly id: string;
  readonly type: "preview_region_capture";
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
  readonly createdAt: string;
}>;

export type ImplementationComposerAttachment = ImplementationComposerPreviewRegionAttachment;
