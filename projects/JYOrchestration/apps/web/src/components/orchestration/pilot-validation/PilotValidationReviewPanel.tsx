"use client";

import { useCallback, useState } from "react";
import type { PilotValidationUserSummaryVm } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";
import { PILOT_VALIDATION_USER_PANEL_TITLE_KO } from "@/lib/overlay-ui/pilotValidationUserUiLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  resolvePilotValidationReviewPanelPrimaryAction,
  resolvePilotValidationReviewPanelSecondaryAction,
} from "./pilotValidationReviewPanelActions";

export type PilotValidationReviewPanelProps = Readonly<{
  vm: PilotValidationUserSummaryVm;
  onViewDiagnostics?: () => void;
  onRequestSupplement?: () => void;
  onCancel?: () => void;
  onValidationPrepareNotice?: () => void;
}>;

function statusToneStyles(tone: PilotValidationUserSummaryVm["statusTone"]): Readonly<{
  background: string;
  border: string;
  color: string;
}> {
  switch (tone) {
    case "ready":
      return { background: "#ecfdf5", border: "#86efac", color: t.success };
    case "watch":
      return { background: t.surfaceCaution, border: t.borderCaution, color: t.textCautionStrong };
    case "blocked":
      return { background: "#fef2f2", border: "#fecaca", color: t.danger };
    default:
      return { background: t.surfaceInfoSoft, border: t.borderInfoSoft, color: t.info };
  }
}

export function PilotValidationReviewPanel({
  vm,
  onViewDiagnostics,
  onRequestSupplement,
  onCancel,
  onValidationPrepareNotice,
}: PilotValidationReviewPanelProps) {
  const [prepareNoticeVisible, setPrepareNoticeVisible] = useState(false);
  const [actionNoticeKo, setActionNoticeKo] = useState<string | null>(null);
  const tone = statusToneStyles(vm.statusTone);

  const runPrimary = useCallback(() => {
    if (resolvePilotValidationReviewPanelPrimaryAction(vm) === "view_diagnostics") {
      onViewDiagnostics?.();
    }
  }, [onViewDiagnostics, vm]);

  const runSecondary = useCallback(() => {
    const kind = resolvePilotValidationReviewPanelSecondaryAction(vm, {
      onViewDiagnostics,
      onRequestSupplement,
      onCancel,
      onValidationPrepareNotice,
    });
    setActionNoticeKo(null);
    switch (kind) {
      case "request_supplement":
        if (onRequestSupplement) {
          onRequestSupplement();
        } else {
          setActionNoticeKo(
            "보완 요청은 담당자에게 전달됩니다. 현재 화면에서는 실제 파일럿 실행이나 소스 변경을 수행하지 않습니다."
          );
        }
        break;
      case "cancel":
        if (onCancel) {
          onCancel();
        } else {
          setActionNoticeKo("작업을 이어가려면 프로젝트 요구사항 화면으로 돌아가 주세요.");
        }
        break;
      case "validation_prepare_notice":
        if (onValidationPrepareNotice) {
          onValidationPrepareNotice();
        } else {
          setPrepareNoticeVisible(true);
        }
        break;
      default:
        onViewDiagnostics?.();
        break;
    }
  }, [onCancel, onRequestSupplement, onValidationPrepareNotice, onViewDiagnostics, vm]);

  return (
    <section
      data-testid="pilot-validation-review-panel"
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: t.radiusMd,
        padding: 16,
        background: t.bgCard,
        boxShadow: t.shadowSoft,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: t.textPrimary }}>
          {PILOT_VALIDATION_USER_PANEL_TITLE_KO}
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
          {vm.descriptionKo}
        </p>
      </header>

      <div
        data-testid="pilot-validation-status"
        style={{
          padding: "10px 12px",
          borderRadius: t.radiusSm,
          border: `1px solid ${tone.border}`,
          background: tone.background,
          color: tone.color,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {vm.statusKo}
      </div>

      <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 13 }}>
        <div>
          <dt style={{ color: t.textMuted, marginBottom: 2 }}>{"\uac80\uc99d \ubc94\uc704"}</dt>
          <dd style={{ margin: 0, color: t.textPrimary }}>{vm.executionScopeKo}</dd>
        </div>
        <div>
          <dt style={{ color: t.textMuted, marginBottom: 2 }}>{"\ud5c8\uc6a9 \ubaa8\ub4dc"}</dt>
          <dd style={{ margin: 0, color: t.textPrimary }}>{vm.allowedExecutionModeKo}</dd>
        </div>
        <div>
          <dt style={{ color: t.textMuted, marginBottom: 2 }}>{"\uc0ac\uc6a9\uc790 \uc2b9\uc778 \ud544\uc694"}</dt>
          <dd style={{ margin: 0, color: t.textPrimary }}>{vm.isUserApprovalRequired ? "\uc608" : "\uc544\ub2c8\uc624"}</dd>
        </div>
        <div>
          <dt style={{ color: t.textMuted, marginBottom: 2 }}>{"\uc9c4\ud589 \uac00\ub2a5 \uc5ec\ubd80"}</dt>
          <dd style={{ margin: 0, color: t.textPrimary }}>
            {vm.canRequestPilotValidation ? "\uac80\uc99d \uc694\uccad \uac00\ub2a5" : "\uac80\uc99d \uc694\uccad \ubd88\uac00"}
          </dd>
        </div>
        {vm.cannotProceedReasonKo ? (
          <div>
            <dt style={{ color: t.textMuted, marginBottom: 2 }}>{"\ucc28\ub2e8/\uc8fc\uc758 \uc0ac\uc720"}</dt>
            <dd style={{ margin: 0, color: t.textPrimary }} data-testid="pilot-validation-cannot-proceed">
              {vm.cannotProceedReasonKo}
            </dd>
          </div>
        ) : null}
      </dl>

      {vm.safetySummaryRows.length > 0 ? (
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: t.textPrimary }}>{"\uc548\uc804 \uc694\uc57d"}</h3>
          <ul
            data-testid="pilot-validation-safety-rows"
            style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 12, lineHeight: 1.5 }}
          >
            {vm.safetySummaryRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: t.textPrimary }}>{"\uae08\uc9c0 \uc791\uc5c5"}</h3>
        <ul
          data-testid="pilot-validation-prohibited-rows"
          style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 12, lineHeight: 1.5 }}
        >
          {vm.prohibitedOperationRows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </div>

      {actionNoticeKo ? (
        <p
          data-testid="pilot-validation-action-notice"
          style={{
            margin: 0,
            padding: 10,
            borderRadius: t.radiusSm,
            background: t.surfaceInfoSoft,
            border: `1px solid ${t.borderInfoSoft}`,
            fontSize: 12,
            color: t.info,
            lineHeight: 1.45,
          }}
        >
          {actionNoticeKo}
        </p>
      ) : null}

      {prepareNoticeVisible ? (
        <p
          data-testid="pilot-validation-prepare-notice"
          style={{
            margin: 0,
            padding: 10,
            borderRadius: t.radiusSm,
            background: t.surfaceInfoSoft,
            border: `1px solid ${t.borderInfoSoft}`,
            fontSize: 12,
            color: t.info,
            lineHeight: 1.45,
          }}
        >
          {vm.dryRunOnlyNoticeKo}
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          data-testid="pilot-validation-primary-action"
          disabled={!vm.primaryActionEnabled}
          onClick={runPrimary}
          style={{
            padding: "8px 14px",
            borderRadius: t.radiusSm,
            border: `1px solid ${t.primary}`,
            background: t.primary,
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: vm.primaryActionEnabled ? "pointer" : "not-allowed",
            opacity: vm.primaryActionEnabled ? 1 : 0.5,
          }}
        >
          {vm.primaryActionLabelKo}
        </button>
        <button
          type="button"
          data-testid="pilot-validation-secondary-action"
          disabled={!vm.secondaryActionEnabled}
          onClick={runSecondary}
          style={{
            padding: "8px 14px",
            borderRadius: t.radiusSm,
            border: `1px solid ${t.borderStrong}`,
            background: t.bgCard,
            color: t.textPrimary,
            fontSize: 13,
            fontWeight: 500,
            cursor: vm.secondaryActionEnabled ? "pointer" : "not-allowed",
            opacity: vm.secondaryActionEnabled ? 1 : 0.5,
          }}
        >
          {vm.secondaryActionLabelKo}
        </button>
      </div>
    </section>
  );
}
