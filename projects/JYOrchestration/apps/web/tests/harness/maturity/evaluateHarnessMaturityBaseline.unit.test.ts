import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessPromptApplyReadiness } from "@/lib/harness/promptAssembly/evaluateHarnessPromptApplyReadiness";
import type { HarnessPromptAssemblyPreview, HarnessPromptPreviewDiff } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { buildExecutionRoutingPlan } from "@/lib/harness/executionRouting/buildExecutionRoutingPlan";
import { buildReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/buildReviewSecurityHarnessPlan";
import { buildReviewSecurityIssuePlanningReport } from "@/lib/harness/reviewSecurity/buildReviewSecurityIssuePlanningReport";
import { buildRemediationLoopPlan } from "@/lib/harness/reviewSecurity/buildRemediationLoopPlan";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";

function miniPreview(): HarnessPromptAssemblyPreview {
  return {
    mode: "dry_run",
    sections: [
      {
        id: "role_contract",
        type: "role_contract",
        title: "역할",
        content: "x",
        source: "overlayIdentity",
        includeReason: "role_resolved",
        priority: 0,
        estimatedCost: 10,
      },
    ],
    totalEstimatedCost: 10,
    overflowRisk: "low",
    warnings: [],
  };
}

function miniDiff(): HarnessPromptPreviewDiff {
  return {
    existingPromptLength: 10,
    previewLength: 10,
    sectionCount: 1,
    missingSectionTypes: [],
    extraSectionTypes: [],
    warnings: [],
  };
}

function stableApplyReadiness() {
  return evaluateHarnessPromptApplyReadiness({
    entries: Array.from({ length: 10 }, () => ({
      harnessPromptAssemblyPreview: miniPreview(),
      harnessPromptPreviewDiff: miniDiff(),
    })),
  });
}

const miniMemoryPlan: MemoryRuntimePlan = {
  mode: "dry_run",
  roleKey: "planner",
  references: [
    {
      memoryId: "m1",
      scope: "session",
      summary: "s",
      freshness: "fresh",
      selectedReason: "r",
      selectedBy: "t",
      estimatedImportance: 1,
    },
  ],
  findings: [],
};

describe("evaluateHarnessMaturityBaseline", () => {
  it("marks many layers missing for empty extract", () => {
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: null,
      messageExplainabilityAvailable: false,
    });
    expect(r.missingCount).toBeGreaterThan(0);
    expect(r.userVisibleSummaryReady).toBe(false);
    const prompt = r.layers.find((l) => l.layer === "prompt_assembly_preview");
    expect(prompt?.status).toBe("missing");
    expect(prompt?.missingSignals.length).toBeGreaterThan(0);
  });

  it("marks prompt_assembly_preview ready_read_only when H1 evidence present", () => {
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: {
        harnessPromptAssemblyPreview: miniPreview(),
        harnessPromptPreviewDiff: miniDiff(),
      },
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      messageExplainabilityAvailable: false,
    });
    const layer = r.layers.find((l) => l.layer === "prompt_assembly_preview");
    expect(layer?.status).toBe("ready_read_only");
    expect(layer?.evidenceCount).toBe(2);
  });

  it("marks knowledge_activation ready when plan present", () => {
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: {
        knowledgeActivationPlan: {
          mode: "dry_run",
          roleKey: "planner",
          workspaceStage: "requirements",
          taskType: null,
          items: [],
          findings: [],
        },
      },
      messageExplainabilityAvailable: false,
    });
    expect(r.layers.find((l) => l.layer === "knowledge_activation")?.status).toBe("ready_read_only");
  });

  it("derives execution_safety ready when plan exists and flags are false", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "planner" });
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: { executionRoutingPlan: plan },
      messageExplainabilityAvailable: false,
    });
    const safety = r.layers.find((l) => l.layer === "execution_safety");
    expect(safety?.status).toBe("ready_read_only");
  });

  it("sets userVisibleSummaryReady when message explainability available", () => {
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      messageExplainabilityAvailable: true,
    });
    expect(r.userVisibleSummaryReady).toBe(true);
    expect(r.layers.find((l) => l.layer === "message_explainability")?.status).toBe("ready_read_only");
  });

  it("uses apply readiness report when provided", () => {
    const ar = stableApplyReadiness();
    expect(ar.level).toBe("ready_candidate");
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: ar,
      messageExplainabilityAvailable: false,
    });
    expect(r.layers.find((l) => l.layer === "apply_readiness")?.status).toBe("ready_read_only");
  });

  it("marks memory_stabilization ready when recent summary has plans", () => {
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: { memoryRuntimePlan: miniMemoryPlan },
      recentMemoryRuntimeSummary: {
        sampledEntryCount: 3,
        planEntryCount: 2,
        totalReferences: 2,
        staleReferenceRate: 0,
        agingReferenceRate: 0,
        freshReferenceRate: 1,
        roleScopedRate: 0,
        projectScopedRate: 0,
        workingScopedRate: 0,
        findingRate: 0,
      },
      messageExplainabilityAvailable: false,
    });
    expect(r.layers.find((l) => l.layer === "memory_stabilization")?.status).toBe("ready_read_only");
  });

  it("marks issue_planning ready when both issue report and remediation exist", () => {
    const harness = buildReviewSecurityHarnessPlan({ roleKey: "planner" });
    const issueReport = buildReviewSecurityIssuePlanningReport({ reviewSecurityHarnessPlan: harness });
    const remediation = buildRemediationLoopPlan({ issuePlanningReport: issueReport });
    const r = evaluateHarnessMaturityBaseline({
      overlayExtract: {
        reviewSecurityIssuePlanningReport: issueReport,
        remediationLoopPlan: remediation,
      },
      messageExplainabilityAvailable: false,
    });
    expect(r.layers.find((l) => l.layer === "issue_planning")?.status).toBe("ready_read_only");
  });
});
