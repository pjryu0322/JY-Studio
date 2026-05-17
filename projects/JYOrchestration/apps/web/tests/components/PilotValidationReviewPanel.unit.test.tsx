import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PilotValidationReviewPanel } from "@/components/orchestration/pilot-validation/PilotValidationReviewPanel";
import { pilotValidationReviewPanelExampleVms } from "@/components/orchestration/pilot-validation/PilotValidationReviewPanel.examples";
import {
  isPilotValidationPrepareSecondaryAction,
  resolvePilotValidationReviewPanelSecondaryAction,
} from "@/components/orchestration/pilot-validation/pilotValidationReviewPanelActions";
import { PILOT_VALIDATION_DRY_RUN_ONLY_NOTICE_KO } from "@/lib/overlay-ui/pilotValidationUserUiLabelsKo";

describe("PilotValidationReviewPanel", () => {
  it("renders status, safety rows, and prohibited rows", () => {
    const html = renderToStaticMarkup(
      <PilotValidationReviewPanel vm={pilotValidationReviewPanelExampleVms.ready_for_validation} />
    );
    expect(html).toContain("pilot-validation-review-panel");
    expect(html).toContain("파일럿 검증 준비됨");
    expect(html).toContain("pilot-validation-prohibited-rows");
    expect(html).toContain("Git Push 없음");
    expect(html).toContain("배포 없음");
  });

  it("does not invoke execution handlers on prepare secondary click without callback", () => {
    const onViewDiagnostics = vi.fn();
    const onRequestSupplement = vi.fn();
    const vm = pilotValidationReviewPanelExampleVms.ready_for_validation;
    expect(isPilotValidationPrepareSecondaryAction(vm)).toBe(true);
    expect(
      resolvePilotValidationReviewPanelSecondaryAction(vm, {
        onViewDiagnostics,
      })
    ).toBe("validation_prepare_notice");
    renderToStaticMarkup(<PilotValidationReviewPanel vm={vm} onViewDiagnostics={onViewDiagnostics} />);
    expect(onViewDiagnostics).not.toHaveBeenCalled();
    expect(onRequestSupplement).not.toHaveBeenCalled();
  });

  it("shows dry-run notice text in vm for prepare flow", () => {
    expect(pilotValidationReviewPanelExampleVms.ready_for_validation.dryRunOnlyNoticeKo).toBe(
      PILOT_VALIDATION_DRY_RUN_ONLY_NOTICE_KO
    );
  });

  it("request_supplement resolves to callback path when handler provided", () => {
    const onRequestSupplement = vi.fn();
    const vm = pilotValidationReviewPanelExampleVms.watch;
    expect(
      resolvePilotValidationReviewPanelSecondaryAction(vm, { onRequestSupplement })
    ).toBe("request_supplement");
  });

  it("does not accept execution handler props", () => {
    const props = {
      vm: pilotValidationReviewPanelExampleVms.ready_for_validation,
    } as const;
    expect("onExecute" in props).toBe(false);
    expect("onPilotExecution" in props).toBe(false);
    expect("onRun" in props).toBe(false);
    expect("onAdapterInvoke" in props).toBe(false);
    expect("onSandboxInvoke" in props).toBe(false);
  });
});
