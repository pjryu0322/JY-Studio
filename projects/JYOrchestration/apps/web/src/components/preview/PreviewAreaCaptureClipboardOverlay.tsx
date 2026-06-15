"use client";

import type { ReactNode } from "react";
import { PreviewAreaCaptureAnnotatedRegionOverlay } from "@/components/preview/PreviewAreaCaptureAnnotatedRegionOverlay";

export function PreviewAreaCaptureClipboardOverlay(props: {
  readonly imageUrl: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onStageToComposer: (
    input: import("@/components/preview/previewAreaCaptureSendTypes").PreviewAreaCaptureSendInput,
  ) => Promise<void>;
  readonly onCopyAnnotated: (
    input: import("@/components/preview/previewAreaCaptureSendTypes").PreviewAreaCaptureSendInput,
  ) => Promise<void>;
}): ReactNode {
  return (
    <PreviewAreaCaptureAnnotatedRegionOverlay
      testId="preview-area-capture-clipboard-overlay"
      imageUrl={props.imageUrl}
      busy={props.busy}
      onClose={props.onClose}
      secondaryAction={{
        testId: "preview-area-capture-copy",
        label: "클립보드에 복사",
        onClick: props.onCopyAnnotated,
      }}
      primaryAction={{
        testId: "preview-area-capture-fallback-send",
        label: "대화입력창에 추가",
        onClick: props.onStageToComposer,
      }}
    />
  );
}
