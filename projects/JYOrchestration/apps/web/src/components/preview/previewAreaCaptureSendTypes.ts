import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";
import type { PreviewCaptureTool } from "@/lib/preview/previewCaptureAnnotationModel";

export type PreviewAreaCaptureSendInput = Readonly<{
  readonly region: PreviewCaptureRegion;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly annotatedImageDataUrl: string;
  readonly hasAnnotations: boolean;
  readonly annotationToolSummary: readonly PreviewCaptureTool[];
}>;
