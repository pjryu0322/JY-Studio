import { describe, expect, it } from "vitest";

import { buildPilotValidationUserSummaryVmFromReports } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";
import {
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForPilotValidation,
  buildPilotValidationBaseReports,
  buildPilotValidationPlanning,
  buildPilotValidationPlanningWithControlledCandidatePatches,
} from "../harness/runtimePilotValidation/runtimePilotValidationTestFixtures";

describe("buildPilotValidationUserSummaryVmFromReports", () => {
  it("ready_for_validation uses user-facing labels", () => {
    const semantic = buildFullSemanticForPilotValidation();
    if (semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus !== "ready_for_validation") {
      return;
    }
    const vm = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(vm.statusKo).toBe("파일럿 검증 준비됨");
    expect(vm.canRequestPilotValidation).toBe(true);
    expect(vm.primaryActionLabelKo).toBe("검증 결과 보기");
    expect(vm.secondaryActionLabelKo).toBe("파일럿 실행 검증 준비");
    expect(vm.secondaryActionEnabled).toBe(true);
    expect(vm.statusTone).toBe("ready");
    expect(vm.descriptionKo.length).toBeGreaterThan(0);
    expect(vm.executionScopeKo).not.toContain("H45");
  });

  it("blocked exposes cannotProceedReasonKo and blocked labels", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateFinalSafetyGate: {
        ...base.runtimeControlledPilotExecutionCandidateFinalSafetyGate,
        finalGateStatus: "blocked",
        pilotValidationEntryReadiness: "blocked",
      },
    });
    const vm = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(vm.statusKo).toBe("파일럿 검증 차단");
    expect(vm.cannotProceedReasonKo).toBeTruthy();
    expect(vm.primaryActionLabelKo).toBe("차단 사유 보기");
    expect(vm.secondaryActionLabelKo).toBe("AI 개발자에게 보완 요청");
    expect(vm.canRequestPilotValidation).toBe(false);
    expect(vm.secondaryActionEnabled).toBe(true);
    expect(vm.statusTone).toBe("blocked");
  });

  it("watch uses supplement secondary label", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanningWithControlledCandidatePatches(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    const vm = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(vm.statusKo).toBe("주의 확인 필요");
    expect(vm.secondaryActionLabelKo).toBe("보완 요청");
    expect(vm.secondaryActionEnabled).toBe(true);
    expect(vm.statusTone).toBe("watch");
  });

  it("not_ready uses continue secondary label", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const vm = buildPilotValidationUserSummaryVmFromReports({
      ...semantic,
      runtimePilotValidationReadOnlyChainSummary: {
        ...semantic.runtimePilotValidationReadOnlyChainSummary,
        validationStatus: "not_ready",
        finalGateStatus: "not_ready",
        pilotValidationEntryReadiness: "not_ready",
      },
    });
    expect(vm.statusKo).toBe("아직 준비되지 않음");
    expect(vm.secondaryActionLabelKo).toBe("작업 계속");
    expect(vm.secondaryActionEnabled).toBe(true);
    expect(vm.statusTone).toBe("neutral");
  });

  it("prohibitedOperationRows includes required items", () => {
    const vm = buildPilotValidationUserSummaryVmFromReports(buildFullSemanticForPilotValidation());
    expect(vm.prohibitedOperationRows).toContain("Git Push 없음");
    expect(vm.prohibitedOperationRows).toContain("배포 없음");
    expect(vm.prohibitedOperationRows).toContain("실제 runner 실행 없음");
    expect(vm.prohibitedOperationRows).toContain("실제 adapter invocation 없음");
    expect(vm.prohibitedOperationRows).toContain("실제 sandbox invocation 없음");
  });
});
