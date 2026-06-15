"use client";

import type { ReactNode } from "react";
import { PreviewAreaCaptureAnnotatedRegionOverlay } from "@/components/preview/PreviewAreaCaptureAnnotatedRegionOverlay";
import type { PreviewAreaCaptureSendInput } from "@/components/preview/previewAreaCaptureSendTypes";

export type { PreviewAreaCaptureSendInput };

export function PreviewAreaCaptureSendOverlay(props: {
  readonly imageUrl: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onSend: (input: PreviewAreaCaptureSendInput) => Promise<void>;
}): ReactNode {
  return (
    <PreviewAreaCaptureAnnotatedRegionOverlay
      testId="preview-area-capture-send-overlay"
      imageUrl={props.imageUrl}
      busy={props.busy}
      onClose={props.onClose}
      primaryAction={{
        testId: "preview-area-capture-send",
        label: "대화입력창에 추가",
        onClick: props.onSend,
      }}
    />
  );
}
