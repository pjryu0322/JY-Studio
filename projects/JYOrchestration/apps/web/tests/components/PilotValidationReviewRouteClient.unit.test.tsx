import { describe, expect, it } from "vitest";

import {
  buildPilotValidationOverlayRuntimeDiagnosticUrl,
  resolvePilotValidationPageViewState,
} from "@/app/pilot-validation/pilotValidationPageViewState";
import { filterOverlayRuntimeDiagnosticDataForAudience } from "@/lib/overlay/overlayRuntimeDiagnosticAudienceFilter";
import { buildPilotValidationUserSummaryVmFromDiagnosticData } from "@/lib/overlay-ui/pilotValidationUserSummaryVmFromDiagnostic";
import { serializeRuntimeSemanticDiagnosticBundleFromPlanningReports } from "@/lib/harness/runtimeSemantic/serializeRuntimeSemanticDiagnosticBundle";
import { buildFullSemanticForPilotValidation } from "../harness/runtimePilotValidation/runtimePilotValidationTestFixtures";
import { pilotValidationReviewPanelExampleVms } from "@/components/orchestration/pilot-validation/PilotValidationReviewPanel.examples";

describe("PilotValidationPageClient route contract", () => {
  it("resolvePilotValidationPageViewState covers missing project, loading, error, no_vm, ready", () => {
    expect(
      resolvePilotValidationPageViewState({
        projectId: "",
        loading: false,
        error: null,
        vm: pilotValidationReviewPanelExampleVms.ready_for_validation,
      })
    ).toBe("missing_project");

    expect(
      resolvePilotValidationPageViewState({
        projectId: "proj-1",
        loading: true,
        error: null,
        vm: null,
      })
    ).toBe("loading");

    expect(
      resolvePilotValidationPageViewState({
        projectId: "proj-1",
        loading: false,
        error: "network",
        vm: null,
      })
    ).toBe("error");

    expect(
      resolvePilotValidationPageViewState({
        projectId: "proj-1",
        loading: false,
        error: null,
        vm: null,
      })
    ).toBe("no_vm");

    expect(
      resolvePilotValidationPageViewState({
        projectId: "proj-1",
        loading: false,
        error: null,
        vm: pilotValidationReviewPanelExampleVms.ready_for_validation,
      })
    ).toBe("ready");
  });

  it("buildPilotValidationOverlayRuntimeDiagnosticUrl uses user audienceMode", () => {
    const url = buildPilotValidationOverlayRuntimeDiagnosticUrl("my-project");
    expect(url).toContain("/api/diagnostics/overlay-runtime?");
    expect(url).toContain("projectId=my-project");
    expect(url).toContain("audienceMode=user");
  });

  it("filtered diagnostic bundle yields user VM (same path as /pilot-validation page)", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const bundle = serializeRuntimeSemanticDiagnosticBundleFromPlanningReports(semantic);
    const filtered = filterOverlayRuntimeDiagnosticDataForAudience(
      bundle as Record<string, unknown>,
      "user"
    );
    const vm = buildPilotValidationUserSummaryVmFromDiagnosticData(filtered);
    expect(vm).not.toBeNull();
    expect(vm?.statusKo.length).toBeGreaterThan(0);
    expect(vm?.safeEchoContractStatusKo.length).toBeGreaterThan(0);
    expect(vm?.requestDraftStatusKo.length).toBeGreaterThan(0);
  });
});
