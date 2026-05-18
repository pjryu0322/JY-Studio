import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildRuntimeNoopAdapterPlanningReports } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterPlanningReports";
import { buildRuntimeNoopAdapterPreflightSummary } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterPreflightSummary";
import { buildRuntimeNoopAdapterResultMetadata } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterResultMetadata";
import { detectRuntimeNoopAdapterBoundaryViolations } from "@/lib/harness/runtimeNoopAdapter/detectRuntimeNoopAdapterBoundaryViolations";
import { evaluateRuntimeAdapterInvocationGuard } from "@/lib/harness/runtimeNoopAdapter/evaluateRuntimeAdapterInvocationGuard";
import {
  RUNTIME_NOOP_ADAPTER_EMPTY_HINT_KO,
  RUNTIME_NOOP_ADAPTER_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeNoopAdapter/runtimeNoopAdapterLabelsKo";
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

describe("H25 / H25.5 runtime noop adapter", () => {
  it("full semantic includes noop adapter with invocation false and preflight", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeNoopAdapterSummary.actualRuntimeAdapterInvocationEnabled).toBe(false);
    expect(semantic.runtimeNoopAdapterSkeleton.adapterMode).toBe("noop");
    expect(semantic.runtimeNoopAdapterPreflightSummary.mode).toBe("runtime_noop_adapter_preflight_summary");
  });

  it("no-op result flags are all false and diagnosticOnly true", () => {
    const result = buildRuntimeNoopAdapterResultMetadata();
    expect(result.noopAccepted).toBe(false);
    expect(result.adapterInvoked).toBe(false);
    expect(result.queueControlPerformed).toBe(false);
    expect(result.rollbackPerformed).toBe(false);
    expect(result.actualQueueControlEnabled).toBe(false);
    expect(result.actualRollbackExecutionEnabled).toBe(false);
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
    expect(evaluateRuntimeAdapterInvocationGuard(blocked).invocationGuard).toBe("always_blocked");
  });

  it("boundary violation detects actualQueueControlEnabled and actualRollbackExecutionEnabled", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const badQueue = {
      ...h25.runtimeNoopAdapterResultMetadata,
      actualQueueControlEnabled: true as unknown as false,
    };
    const badRollback = {
      ...h25.runtimeNoopAdapterResultMetadata,
      actualRollbackExecutionEnabled: true as unknown as false,
    };
    expect(
      detectRuntimeNoopAdapterBoundaryViolations(before, h25.runtimeNoopAdapterSkeleton, badQueue)
        .actualFlagViolations.some((v) => v.includes("actualQueueControlEnabled"))
    ).toBe(true);
    expect(
      detectRuntimeNoopAdapterBoundaryViolations(before, h25.runtimeNoopAdapterSkeleton, badRollback)
        .actualFlagViolations.some((v) => v.includes("actualRollbackExecutionEnabled"))
    ).toBe(true);
  });

  it("boundary violation detects rollbackPerformed", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const badResult = {
      ...h25.runtimeNoopAdapterResultMetadata,
      rollbackPerformed: true as unknown as false,
    };
    const violations = detectRuntimeNoopAdapterBoundaryViolations(
      before,
      h25.runtimeNoopAdapterSkeleton,
      badResult
    );
    expect(violations.actualFlagViolations.some((v) => v.includes("rollbackPerformed"))).toBe(true);
  });

  it("boundary violation detects queueControlPerformed and diagnosticOnly false", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const badResult = {
      ...h25.runtimeNoopAdapterResultMetadata,
      queueControlPerformed: true as unknown as false,
      diagnosticOnly: false as unknown as true,
    };
    const violations = detectRuntimeNoopAdapterBoundaryViolations(
      before,
      h25.runtimeNoopAdapterSkeleton,
      badResult
    );
    expect(violations.actualFlagViolations.some((v) => v.includes("queueControlPerformed"))).toBe(true);
    expect(violations.actualFlagViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("noopAccepted true → actualFlagViolations", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const badResult = {
      ...h25.runtimeNoopAdapterResultMetadata,
      noopAccepted: true as unknown as false,
    };
    const violations = detectRuntimeNoopAdapterBoundaryViolations(
      before,
      h25.runtimeNoopAdapterSkeleton,
      badResult
    );
    expect(violations.actualFlagViolations.some((v) => v.includes("noopAccepted"))).toBe(true);
  });

  it("verifyRuntimePilotContract flags empty requiredFields with schema coverage finding", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const emptyInput = {
      ...before,
      runtimePilotContractInputSchema: {
        ...before.runtimePilotContractInputSchema,
        requiredFields: [],
      },
    };
    const verification = verifyRuntimePilotContract(
      emptyInput,
      h25.runtimeNoopAdapterSkeleton,
      h25.runtimeNoopAdapterResultMetadata
    );
    expect(verification.findings.some((f) => f.includes("input schema coverage"))).toBe(true);
  });

  it("serializer includes runtimeNoopAdapterPreflightSummary with false actual flags", () => {
    const ser = serializeRuntimeNoopAdapterDiagnosticBundleFromSemanticReports(buildFullSemantic());
    const pf = ser.runtimeNoopAdapterPreflightSummary as {
      mode: string;
      actualExecutionEnabled: boolean;
      actualQueueControlEnabled: boolean;
      actualRollbackExecutionEnabled: boolean;
    };
    expect(pf.mode).toBe("runtime_noop_adapter_preflight_summary");
    expect(pf.actualExecutionEnabled).toBe(false);
    expect(pf.actualQueueControlEnabled).toBe(false);
    expect(pf.actualRollbackExecutionEnabled).toBe(false);
  });

  it("preflight blocked when actual flag violations present", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const violations = detectRuntimeNoopAdapterBoundaryViolations(before, h25.runtimeNoopAdapterSkeleton, {
      ...h25.runtimeNoopAdapterResultMetadata,
      actualExecutionEnabled: true as unknown as false,
    });
    const pf = buildRuntimeNoopAdapterPreflightSummary({
      summary: { ...h25.runtimeNoopAdapterSummary, noopAdapterStatus: "blocked" },
      verification: h25.runtimePilotContractVerificationReport,
      result: h25.runtimeNoopAdapterResultMetadata,
      guard: h25.runtimeAdapterInvocationGuardReport,
      violations,
    });
    expect(pf.preflightReadiness).toBe("blocked");
    expect(pf.blockers.length).toBeGreaterThan(0);
  });

  it("preflight watch when wording risk findings present", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const h25 = buildRuntimeNoopAdapterPlanningReports(before);
    const violations = {
      ...h25.runtimeNoopAdapterBoundaryViolationReport,
      actualFlagViolations: [],
      wordingRiskFindings: ["wording/flag risk: adapterInvoked=true"],
    };
    const pf = buildRuntimeNoopAdapterPreflightSummary({
      summary: { ...h25.runtimeNoopAdapterSummary, noopAdapterStatus: "watch" },
      verification: {
        ...h25.runtimePilotContractVerificationReport,
        verificationStatus: "partial",
      },
      result: h25.runtimeNoopAdapterResultMetadata,
      guard: {
        ...h25.runtimeAdapterInvocationGuardReport,
        invocationGuard: "contract_metadata_only",
      },
      violations,
    });
    expect(pf.preflightReadiness).toBe("watch");
  });

  it("preflight checklist includes stabilization markers", () => {
    const semantic = buildFullSemantic();
    const checklist = semantic.runtimeNoopAdapterPreflightSummary.checklist;
    expect(checklist.some((c) => c.includes("actual adapter invocation disabled"))).toBe(true);
    expect(checklist.some((c) => c.includes("overlayWordingStabilized:H25.5"))).toBe(true);
  });

  it("full build blocked when contract blocked (always_blocked)", () => {
    const before = stripRuntimeNoopAdapterLayer(buildFullSemantic());
    const blocked = {
      ...before,
      runtimePilotContractSummary: {
        ...before.runtimePilotContractSummary,
        contractReadiness: "blocked" as const,
      },
    };
    const h25 = buildRuntimeNoopAdapterPlanningReports(blocked);
    expect(h25.runtimeNoopAdapterSummary.noopAdapterStatus).toBe("blocked");
    expect(h25.runtimeNoopAdapterPreflightSummary.preflightReadiness).toBe("blocked");
  });

  it("preflight ready_metadata when contract verified and no violations", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimeNoopAdapterSummary.noopAdapterStatus === "contract_verified_noop" &&
      semantic.runtimePilotContractVerificationReport.verificationStatus === "verified_noop"
    ) {
      expect(semantic.runtimeNoopAdapterPreflightSummary.preflightReadiness).toBe("ready_metadata");
    } else {
      expect(["watch", "blocked", "not_ready"]).toContain(
        semantic.runtimeNoopAdapterPreflightSummary.preflightReadiness
      );
    }
  });

  it("footer Korean text is stable via label constant", () => {
    expect(RUNTIME_NOOP_ADAPTER_OVERLAY_FOOTER_KO.length).toBeGreaterThan(20);
    expect(RUNTIME_NOOP_ADAPTER_OVERLAY_FOOTER_KO).not.toMatch(/\?\?\?/);
    expect(RUNTIME_NOOP_ADAPTER_OVERLAY_FOOTER_KO).toMatch(/invocation/);
  });

  it("OverlayRuntimeNoopAdapterSection has no broken ??? placeholder text", () => {
    const overlayPath = join(
      process.cwd(),
      "src/components/orchestration/overlay/OverlayRuntimeNoopAdapterSection.tsx"
    );
    const source = readFileSync(overlayPath, "utf8");
    expect(source).not.toMatch(/\?\?\?/);
    expect(source).toContain("RUNTIME_NOOP_ADAPTER_EMPTY_HINT_KO");
    expect(source).toContain("RUNTIME_NOOP_ADAPTER_OVERLAY_FOOTER_KO");
    expect(Object.values(RUNTIME_NOOP_ADAPTER_EMPTY_HINT_KO).every((h) => !h.includes("???"))).toBe(
      true
    );
    expect(RUNTIME_NOOP_ADAPTER_EMPTY_HINT_KO.preflightChecklist).toContain("Preflight checklist");
  });
});
