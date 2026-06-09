import { INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE } from "@/lib/prototype/implementationIntegrationErrors";

export const INTEGRATION_PIPELINE_SUCCESS_USER_TOAST =
  "실제 앱 Preview가 준비되었습니다. Preview 버튼을 눌러 확인해 주세요.";

export const INTEGRATION_PIPELINE_CONTINUE_STATUS_MESSAGE =
  "Preview 준비 상태를 확인하고 있습니다.\n잠시 후 다시 시도해 주세요.";

export function canShowContinuePreviewActionMessage(input: {
  readonly previewReady?: boolean | null;
  readonly status?: string | null;
  readonly nextRequiredStep?: string | null;
  readonly visibleContinueButton?: boolean;
  /** @deprecated use visibleContinueButton */
  readonly hasVisibleContinueButton?: boolean;
}): boolean {
  if (input.previewReady === true) return false;
  if (String(input.status ?? "").trim() === "integrated_app_preview_ready") return false;
  if (!String(input.nextRequiredStep ?? "").trim()) return false;
  const visible =
    input.visibleContinueButton === true || input.hasVisibleContinueButton === true;
  return visible;
}

export type IntegrationPipelineUserToastReasonV1 =
  | "integrated_preview_ready"
  | "continue_next_step"
  | "server_save_failed"
  | "fallback_message"
  | "suppressed_legacy_continue";

export type IntegrationPipelineUserToastV1 = Readonly<{
  readonly show: boolean;
  readonly message: string | null;
  readonly reason: IntegrationPipelineUserToastReasonV1;
}>;

export function isLegacyContinuePreviewMessage(message: string | null | undefined): boolean {
  const text = String(message ?? "").trim();
  if (!text) return false;
  return (
    text.includes("Preview 준비를 계속 진행해야 합니다") ||
    text.includes("아래 버튼을 눌러 다음 단계를 실행해 주세요") ||
    text.includes("CodeTask Preview 준비 완료 · 실제 앱 Preview는 아직 준비되지 않았습니다")
  );
}

function isStrictContinuePreviewMessage(message: string): boolean {
  return (
    message.includes("Preview 준비를 계속 진행해야 합니다") ||
    message.includes("아래 버튼을 눌러 다음 단계를 실행해 주세요")
  );
}

export function isIntegrationPipelineIntegratedReady(input: {
  readonly status?: string | null;
  readonly previewReady?: boolean | null;
  readonly integratedAppPreviewReady?: boolean | null;
}): boolean {
  if (input.previewReady === true) return true;
  if (input.integratedAppPreviewReady === true) return true;
  return String(input.status ?? "").trim() === "integrated_app_preview_ready";
}

export function resolveIntegrationPipelineUserToast(input: {
  readonly status?: string | null;
  readonly previewReady?: boolean | null;
  readonly integratedAppPreviewReady?: boolean | null;
  readonly message?: string | null;
  readonly serverSaved?: boolean;
  readonly nextRequiredStep?: string | null;
  readonly visibleContinueButton?: boolean;
  /** @deprecated use visibleContinueButton */
  readonly hasVisibleContinueButton?: boolean;
}): IntegrationPipelineUserToastV1 {
  if (input.serverSaved === false) {
    return {
      show: true,
      message:
        "통합·Preview는 화면에 반영됐으나 서버 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      reason: "server_save_failed",
    };
  }

  const integratedReady = isIntegrationPipelineIntegratedReady(input);
  const rawMessage = String(input.message ?? "").trim();

  if (integratedReady) {
    const legacy = isStrictContinuePreviewMessage(rawMessage) || isLegacyContinuePreviewMessage(rawMessage);
    return {
      show: true,
      message: legacy
        ? INTEGRATION_PIPELINE_SUCCESS_USER_TOAST
        : rawMessage || INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE.replace(/\n/g, " "),
      reason: legacy ? "suppressed_legacy_continue" : "integrated_preview_ready",
    };
  }

  if (isStrictContinuePreviewMessage(rawMessage)) {
    const canShowContinue = canShowContinuePreviewActionMessage({
      previewReady: input.previewReady,
      status: input.status,
      nextRequiredStep: input.nextRequiredStep,
      visibleContinueButton:
        input.visibleContinueButton === true || input.hasVisibleContinueButton === true,
    });
    if (!canShowContinue) {
      return {
        show: true,
        message: INTEGRATION_PIPELINE_CONTINUE_STATUS_MESSAGE,
        reason: "fallback_message",
      };
    }
    return {
      show: true,
      message:
        "Preview 준비를 계속 진행해야 합니다. 아래 버튼을 눌러 다음 단계를 실행해 주세요.",
      reason: "continue_next_step",
    };
  }

  if (rawMessage) {
    return {
      show: true,
      message: rawMessage,
      reason: "fallback_message",
    };
  }

  return { show: false, message: null, reason: "fallback_message" };
}

export function sanitizeIntegrationPipelineApiResponseMessage(input: {
  readonly status?: string | null;
  readonly previewReady?: boolean | null;
  readonly userSafeMessage?: string | null;
  readonly ok?: boolean;
}): string {
  const toast = resolveIntegrationPipelineUserToast({
    status: input.status,
    previewReady: input.previewReady,
    integratedAppPreviewReady: input.previewReady,
    message: input.userSafeMessage,
    serverSaved: true,
  });
  if (isIntegrationPipelineIntegratedReady(input) && toast.message) {
    return toast.message;
  }
  if (toast.message && toast.reason === "continue_next_step") {
    return toast.message;
  }
  return (
    input.userSafeMessage?.trim() ||
    (input.ok ? "통합 Wiring이 완료되었습니다." : "통합 단계 실행에 실패했습니다.")
  );
}
