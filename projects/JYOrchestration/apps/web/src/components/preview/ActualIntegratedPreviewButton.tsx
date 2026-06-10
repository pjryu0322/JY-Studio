"use client";

import type { ReactNode } from "react";
import {
  ACTUAL_PREVIEW_BUTTON_LABEL,
  type ActualIntegratedPreviewButtonStateV1,
} from "@/lib/prototype/actualPreviewButtonPolicy";
import { openActualIntegratedPreviewInNewWindow } from "@/lib/prototype/actualIntegratedPreviewOpenAction";

export function ActualIntegratedPreviewButton(input: {
  readonly projectId: string;
  readonly state: ActualIntegratedPreviewButtonStateV1;
  readonly className?: string;
  readonly dataTestId?: string;
  readonly onBeforeOpen?: () => void;
}): ReactNode {
  if (!input.state.show) return null;
  const disabled = !input.state.enabled || !input.state.url;
  return (
    <button
      type="button"
      className={input.className}
      data-testid={input.dataTestId ?? "actual-integrated-preview-open-button"}
      disabled={disabled}
      title={input.state.title}
      onClick={() => {
        if (disabled || !input.state.url) return;
        input.onBeforeOpen?.();
        openActualIntegratedPreviewInNewWindow({
          projectId: input.projectId,
          url: input.state.url,
        });
      }}
    >
      {ACTUAL_PREVIEW_BUTTON_LABEL}
    </button>
  );
}
