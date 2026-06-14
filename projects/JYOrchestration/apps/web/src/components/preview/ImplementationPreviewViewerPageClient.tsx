"use client";

import { useMemo, type ReactNode } from "react";
import { ImplementationPreviewViewerChrome } from "@/components/preview/ImplementationPreviewViewerChrome";
import { sanitizePreviewViewerTargetParam } from "@/lib/prototype/implementationPreviewViewerWindow";

export function ImplementationPreviewViewerPageClient(props: {
  readonly projectId: string;
  readonly initialTarget: string | null;
}): ReactNode {
  const previewUrl = useMemo(
    () =>
      sanitizePreviewViewerTargetParam({
        projectId: props.projectId,
        target: props.initialTarget,
      }),
    [props.projectId, props.initialTarget],
  );

  if (!previewUrl) {
    return (
      <div
        data-testid="implementation-preview-viewer-error"
        style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}
      >
        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Preview를 열 수 없습니다</h1>
        <p style={{ margin: 0, color: "#64748b" }}>
          유효하지 않은 Preview 주소입니다. 구현 단계 툴바에서 다시 열어 주세요.
        </p>
      </div>
    );
  }

  return <ImplementationPreviewViewerChrome projectId={props.projectId} previewUrl={previewUrl} />;
}
