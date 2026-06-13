"use client";

import { useCallback, useEffect, type MutableRefObject, type RefObject } from "react";
import type { ImplementationIntegrationPipelineClientResultV1 } from "@/components/preview/useImplementationIntegrationPipelineController";
import { useTimedSuccessErrorToasts } from "@/components/workspace/useTimedSuccessErrorToasts";
import { COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION } from "@/lib/prototype/implementationPreviewActionSource";
import { isLegacyCodeTaskPreviewScopeNoticeContent } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import { isLegacyContinuePreviewMessage } from "@/lib/prototype/implementationIntegrationToastPolicy";
import { shouldSuppressImplementationStatusMessage } from "@/lib/prototype/implementationStatusChatPolicy";
import { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/effectiveImplementationState";

/**
 * Controls implementation-stage user notices (toast-only).
 *
 * Scope:
 * - append AI/user/execution notices as timed toasts
 * - suppress legacy CodeTask preview notices after integrated Preview is ready
 * - expose append execution notice ref wiring
 *
 * Not scope:
 * - execution log timeline persistence
 * - CodeTask execution
 * - GitHub verification
 * - board rendering
 */
export type ImplementationNoticeModalControllerInput = Readonly<{
  readonly projectId: string;
  readonly orchestrationAwareRequirementsStateRef: RefObject<
    ReturnType<typeof resolveOrchestrationAwareRequirementsState>
  >;
  readonly integrationPipelineClientResultRef: MutableRefObject<ImplementationIntegrationPipelineClientResultV1 | null>;
  readonly appendImplementationExecutionNoticeRef: MutableRefObject<(content: string) => void>;
}>;

export type ImplementationNoticeModalControllerValue = Readonly<{
  readonly implementationNoticeSuccessToast: string | null;
  readonly implementationNoticeErrorToast: string | null;
  readonly appendAiNoticeForImplementation: (content: string) => void;
  readonly appendUserNotice: (message: string) => void;
  readonly appendImplementationExecutionNotice: (content: string) => void;
  readonly showIntegrationPipelineUserNotice: (message: string) => void;
}>;

export function useImplementationNoticeModalController(
  input: ImplementationNoticeModalControllerInput,
): ImplementationNoticeModalControllerValue {
  const {
    successToast: implementationNoticeSuccessToast,
    errorToast: implementationNoticeErrorToast,
    showSuccessToast,
  } = useTimedSuccessErrorToasts({ successDismissMs: 4500, errorDismissMs: 5500 });

  const appendAiNoticeForImplementation = useCallback(
    (content: string) => {
      const text = String(content ?? "").trim();
      if (!text) return;
      const pid = input.projectId.trim();
      const pipeline = input.integrationPipelineClientResultRef.current;
      const integratedReady =
        (pid &&
          resolveIntegratedAppPreviewReadyFromOrchestration({
            projectId: pid,
            orchestration: input.orchestrationAwareRequirementsStateRef.current,
          })) ||
        pipeline?.previewReady === true ||
        pipeline?.status === "integrated_app_preview_ready";
      if (
        integratedReady &&
        (isLegacyCodeTaskPreviewScopeNoticeContent(text) || isLegacyContinuePreviewMessage(text))
      ) {
        console.info(`[implementation] ${COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION}`, {
          status: pipeline?.status,
          previewReady: pipeline?.previewReady,
        });
        return;
      }
      if (integratedReady) return;
      showSuccessToast(text);
    },
    [
      input.integrationPipelineClientResultRef,
      input.orchestrationAwareRequirementsStateRef,
      input.projectId,
      showSuccessToast,
    ],
  );

  const appendUserNotice = useCallback(
    (message: string) => {
      const text = String(message ?? "").trim();
      if (text) appendAiNoticeForImplementation(text);
    },
    [appendAiNoticeForImplementation],
  );

  const showIntegrationPipelineUserNotice = useCallback(
    (message: string) => {
      const text = String(message ?? "").trim();
      if (!text) return;
      showSuccessToast(text);
    },
    [showSuccessToast],
  );

  const appendImplementationExecutionNotice = useCallback(
    (content: string) => {
      if (shouldSuppressImplementationStatusMessage({ content })) return;
      const pid = input.projectId.trim();
      if (
        pid &&
        isLegacyCodeTaskPreviewScopeNoticeContent(content) &&
        (resolveIntegratedAppPreviewReadyFromOrchestration({
          projectId: pid,
          orchestration: input.orchestrationAwareRequirementsStateRef.current,
        }) ||
          input.integrationPipelineClientResultRef.current?.previewReady === true ||
          input.integrationPipelineClientResultRef.current?.status === "integrated_app_preview_ready")
      ) {
        return;
      }
      appendAiNoticeForImplementation(content);
    },
    [
      appendAiNoticeForImplementation,
      input.integrationPipelineClientResultRef,
      input.orchestrationAwareRequirementsStateRef,
      input.projectId,
    ],
  );

  useEffect(() => {
    input.appendImplementationExecutionNoticeRef.current = appendImplementationExecutionNotice;
  }, [appendImplementationExecutionNotice, input.appendImplementationExecutionNoticeRef]);

  return {
    implementationNoticeSuccessToast,
    implementationNoticeErrorToast,
    appendAiNoticeForImplementation,
    appendUserNotice,
    appendImplementationExecutionNotice,
    showIntegrationPipelineUserNotice,
  };
}
