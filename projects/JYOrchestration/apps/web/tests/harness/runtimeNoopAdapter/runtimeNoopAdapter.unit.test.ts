import { describe, expect, it } from "vitest";

import { buildRuntimeNoopAdapterPlanningReports } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterPlanningReports";
import { buildRuntimeNoopAdapterResultMetadata } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterResultMetadata";
import { detectRuntimeNoopAdapterBoundaryViolations } from "@/lib/harness/runtimeNoopAdapter/detectRuntimeNoopAdapterBoundaryViolations";
import { evaluateRuntimeAdapterInvocationGuard } from "@/lib/harness/runtimeNoopAdapter/evaluateRuntimeAdapterInvocationGuard";
import { verifyRuntimePilotContract } from "@/lib/harness/runtimeNoopAdapter/verifyRuntimePilotContract";
import { serializeRuntimeNoopAdapterDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeNoopAdapter/serializeRuntimeNoopAdapterDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { stripRuntimeNoopAdapterLayer } from "../runtimePlanningReportStrip";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";

function buildFullSemantic() {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  const ctx = normalizeRuntimePlanningContext({
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
  });
  const dep = buildRuntimeDependencyPlanningReports(ctx);
  const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
  const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
  const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
  return buildRuntimeSemanticPlanningReports(reasoning);
}

describe("H25 runtime noop adapter skeleton & contract verification", () => {
  it("full semantic includes noop adapter with invocation false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeNoopAdapterSummary.actualRuntimeAdapterInvocationEnabled).toBe(false);
    expect(semantic.runtimeNoopAdapterSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeNoopAdapterSkeleton.adapterMode).toBe("noop");
    expect(semantic.runtimeAdapterInvocationGuardReport.actualRuntimeAdapterInvocationEnabled).toBe(false);
  });

  it("no-op result flags are all false", () => {
    const result = buildRuntimeNoopAdapterResultMetadata();
    expect(result.noopAccepted).toBe(false);
    expect(result.adapterInvoked).toBe(false);
    expect(result.executionPerformed).toBe(false);
    expect(result.providerRoutingPerformed).toBe(false);
    expect(result.diagnosticOnly).toBe(true);
  });

  it("contract blocked → always_blocked", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const blocked = {
      ...before,
      runtimePilotContractSummary: {
        ...before.runtimePilotContractSummary,
        contractReadiness: "blocked" as const,
      },
      runtimePilotHandoffReadiness: {
        ...before.runtimePilotHandoffReadiness,
        handoffReadiness: "blocked" as const,
      },
    };
    const guard = evaluateRuntimeAdapterInvocationGuard(blocked);
    expect(guard.invocationGuard).toBe("always_blocked");
  });

  it("contract_metadata_ready + contract_metadata_only → contract_metadata_only", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const ready = {
      ...before,
      runtimePilotContractSummary: {
        ...before.runtimePilotContractSummary,
        contractReadiness: "contract_metadata_ready" as const,
        adapterBoundaryMode: "contract_metadata_only" as const,
        handoffBlockers: [],
      },
      runtimeAdapterBoundarySummary: {
        ...before.runtimeAdapterBoundarySummary,
        boundaryMode: "contract_metadata_only" as const,
      },
      runtimePilotHandoffReadiness: {
        ...before.runtimePilotHandoffReadiness,
        handoffReadiness: "metadata_ready" as const,
        contractReadiness: "contract_metadata_ready" as const,
        adapterBoundaryMode: "contract_metadata_only" as const,
      },
    };
    const guard = evaluateRuntimeAdapterInvocationGuard(ready);
    expect(guard.invocationGuard).toBe("contract_metadata_only");
  });

  it("boundary violation detects adapterInvoked=true wording", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const badResult = {
      ...h25.runtimeNoopAdapterResultMetadata,
      adapterInvoked: true as unknown as false,
      resultRows: [...h25.runtimeNoopAdapterResultMetadata.resultRows, "adapterInvoked=true"],
    };
    const violations = detectRuntimeNoopAdapterBoundaryViolations(
      before,
      h25.runtimeNoopAdapterSkeleton,
      badResult
    );
    expect(violations.actualFlagViolations.length).toBeGreaterThan(0);
    expect(
      violations.wordingRiskFindings.some((w) => w.includes("adapterInvoked")) ||
        violations.actualFlagViolations.some((v) => v.includes("adapterInvoked"))
    ).toBe(true);
  });

  it("verifyRuntimePilotContract flags empty requiredFields", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const emptyInput = {
      ...before,
      runtimePilotContractInputSchema: {
        ...before.runtimePilotContractInputSchema,
        requiredFields: [],
      },
    };
    const verification = verifyRuntimePilotContract(emptyInput);
    expect(verification.missingRequiredInputs.some((m) => m.includes("requiredFields empty"))).toBe(true);
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimeNoopAdapterDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimeNoopAdapterSummary.mode).toBe("runtime_noop_adapter_summary");
    expect(ser.runtimeNoopAdapterSkeleton.adapterMode).toBe("noop");
  });

  it("buildRuntimeNoopAdapterPlanningReports merges from pilot contract layer", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    expect(h25.runtimePilotContractVerificationReport.mode).toBe("runtime_pilot_contract_verification_report");
    expect(h25.runtimeNoopAdapterResultMetadata.mode).toBe("runtime_noop_adapter_result_metadata");
  });
});
