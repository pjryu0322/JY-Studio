/**
 * Pilot Validation Phase 1 — review panel button policy(read-only, no execution).
 */

import type { PilotValidationUserSummaryVm } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";

export type PilotValidationReviewPanelActionKind =
  | "view_diagnostics"
  | "request_supplement"
  | "cancel"
  | "validation_prepare_notice";

export function isPilotValidationPrepareSecondaryAction(vm: PilotValidationUserSummaryVm): boolean {
  return vm.secondaryActionLabelKo === "파일럿 실행 검증 준비";
}

export function resolvePilotValidationReviewPanelSecondaryAction(
  vm: PilotValidationUserSummaryVm,
  handlers: Readonly<{
    readonly onViewDiagnostics?: () => void;
    readonly onRequestSupplement?: () => void;
    readonly onCancel?: () => void;
    readonly onValidationPrepareNotice?: () => void;
  }>
): PilotValidationReviewPanelActionKind {
  if (isPilotValidationPrepareSecondaryAction(vm)) {
    return "validation_prepare_notice";
  }
  if (vm.secondaryActionLabelKo === "보완 요청" || vm.secondaryActionLabelKo === "AI 개발자에게 보완 요청") {
    return "request_supplement";
  }
  if (vm.secondaryActionLabelKo === "작업 계속") {
    return "cancel";
  }
  return "view_diagnostics";
}

export function resolvePilotValidationReviewPanelPrimaryAction(
  _vm: PilotValidationUserSummaryVm
): PilotValidationReviewPanelActionKind {
  return "view_diagnostics";
}
