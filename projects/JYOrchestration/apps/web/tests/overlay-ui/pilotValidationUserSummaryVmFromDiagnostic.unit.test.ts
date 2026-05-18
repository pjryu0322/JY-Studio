import { describe, expect, it } from "vitest";

import { buildPilotValidationUserSummaryVmFromReports } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";
import { buildPilotValidationUserSummaryVmFromDiagnosticData } from "@/lib/overlay-ui/pilotValidationUserSummaryVmFromDiagnostic";
import { serializeRuntimeSemanticDiagnosticBundleFromPlanningReports } from "@/lib/harness/runtimeSemantic/serializeRuntimeSemanticDiagnosticBundle";
import {
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForPilotValidation,
  buildPilotValidationBaseReports,
  buildPilotValidationPlanningWithControlledCandidatePatches,
} from "../harness/runtimePilotValidation/runtimePilotValidationTestFixtures";

describe("buildPilotValidationUserSummaryVmFromDiagnosticData", () => {
  it("returns null when required fields are missing", () => {
    expect(buildPilotValidationUserSummaryVmFromDiagnosticData({})).toBeNull();
    expect(
      buildPilotValidationUserSummaryVmFromDiagnosticData({
        runtimePilotValidationReadOnlyChainSummary: { validationStatus: "blocked" },
      })
    ).toBeNull();
  });

  it("builds VM from serialized diagnostic data", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const bundle = serializeRuntimeSemanticDiagnosticBundleFromPlanningReports(semantic);
    const vm = buildPilotValidationUserSummaryVmFromDiagnosticData(bundle);
    const fromReports = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(vm).not.toBeNull();
    expect(vm?.statusKo).toBe(fromReports.statusKo);
    expect(vm?.primaryActionLabelKo).toBe(fromReports.primaryActionLabelKo);
    expect(vm?.secondaryActionLabelKo).toBe(fromReports.secondaryActionLabelKo);
    expect(vm?.canRequestPilotValidation).toBe(fromReports.canRequestPilotValidation);
    expect(vm?.prohibitedOperationRows).toEqual(fromReports.prohibitedOperationRows);
    expect(vm?.safeEchoContractStatusKo).toBe(fromReports.safeEchoContractStatusKo);
    expect(vm?.safeEchoValidationModeKo).toContain("Safe Echo Contract only");
  });

  it("watch status enables secondary action", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanningWithControlledCandidatePatches(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    const bundle = serializeRuntimeSemanticDiagnosticBundleFromPlanningReports(semantic);
    const vm = buildPilotValidationUserSummaryVmFromDiagnosticData(bundle);
    expect(vm?.statusKo).toBe("주의 확인 필요");
    expect(vm?.secondaryActionEnabled).toBe(true);
    expect(vm?.secondaryActionLabelKo).toBe("보완 요청");
  });
});
