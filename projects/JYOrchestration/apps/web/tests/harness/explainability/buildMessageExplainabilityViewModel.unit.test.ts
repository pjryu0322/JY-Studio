import { describe, expect, it } from "vitest";

import { buildMessageExplainabilityViewModel } from "@/lib/harness/explainability/buildMessageExplainabilityViewModel";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";

describe("buildMessageExplainabilityViewModel", () => {
  it("returns hasData false for empty extract", () => {
    const vm = buildMessageExplainabilityViewModel({ overlayExtract: null });
    expect(vm.hasData).toBe(false);
    expect(vm.sections).toEqual([]);
    expect(vm.summaryLines).toEqual([]);
  });

  it("builds role section from overlayIdentity", () => {
    const ex: ExtractedOverlayPromptTraceMetadata = {
      overlayIdentity: {
        roleKey: "planner",
        perspective: "기획 관점",
        provider: "internal",
        capabilities: [],
      },
    };
    const vm = buildMessageExplainabilityViewModel({ overlayExtract: ex });
    expect(vm.hasData).toBe(true);
    expect(vm.sections.some((s) => s.type === "role")).toBe(true);
    const role = vm.sections.find((s) => s.type === "role");
    expect(role?.summary).toContain("기획");
  });

  it("builds knowledge section from knowledgeActivationPlan", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        knowledgeActivationPlan: {
          mode: "dry_run",
          roleKey: "planner",
          workspaceStage: "requirements",
          taskType: null,
          items: [
            {
              knowledgePackId: "internal-never-leak-this-id",
              priority: "recommended",
              reasonType: "role_policy",
              reasonLabel: "역할 정책",
            },
          ],
          findings: [],
        },
      },
    });
    expect(vm.hasData).toBe(true);
    const kn = vm.sections.find((s) => s.type === "knowledge");
    expect(kn?.summary).toMatch(/지식팩/);
    const blob = [vm.headline, ...vm.summaryLines, ...vm.sections.map((s) => `${s.title}${s.summary}`)].join(" ");
    expect(blob).not.toMatch(/knowledgePackId/);
    expect(blob).not.toMatch(/internal-never-leak-this-id/);
  });

  it("raises risk when memory references include stale", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        memoryRuntimePlan: {
          mode: "dry_run",
          roleKey: null,
          references: [
            {
              memoryId: "m1",
              scope: "project",
              summary: "요약",
              freshness: "stale",
              selectedReason: "recent",
              selectedBy: "policy",
              estimatedImportance: 10,
            },
          ],
          findings: [],
        },
      },
    });
    expect(vm.riskLevel === "medium" || vm.riskLevel === "high").toBe(true);
    expect(vm.sections.some((s) => s.type === "memory")).toBe(true);
  });

  it("raises risk for execution routing safety unsafe_to_apply", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        executionRoutingSafetyReport: {
          mode: "dry_run_safety",
          status: "unsafe_to_apply",
          providerSwitchingEnabled: false,
          executionBlockingEnabled: false,
          automaticExecutionEnabled: false,
          unsupportedCapabilityCount: 1,
          warningItemCount: 2,
          providerHintCount: 0,
          totalItems: 3,
          findings: [],
        },
      },
    });
    expect(vm.riskLevel).toBe("high");
  });

  it("raises risk for critical_candidate issue", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        reviewSecurityIssuePlanningReport: {
          mode: "dry_run_issue_planning",
          issues: [
            {
              id: "i1",
              sourceChecklistId: "c1",
              area: "security",
              standard: "owasp_top10",
              severity: "critical_candidate",
              status: "candidate",
              title: "T",
              description: "D",
              remediationHint: "H",
              recommendedAction: "security_recheck",
              duplicateGroupKey: "security:owasp_top10",
            },
          ],
          findings: [],
        },
      },
    });
    expect(vm.riskLevel).toBe("high");
  });

  it("caps summary lines at 5", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
        overlaySelectedContextRefs: [{ type: "workspace", source: "workspace-root", reason: "bootstrap", priority: 0 }],
        knowledgeActivationPlan: {
          mode: "dry_run",
          roleKey: null,
          workspaceStage: null,
          taskType: null,
          items: [
            {
              knowledgePackId: "k1",
              priority: "optional",
              reasonType: "stage_policy",
              reasonLabel: "단계",
            },
          ],
          findings: [],
        },
        memoryRuntimePlan: {
          mode: "dry_run",
          roleKey: null,
          references: [
            {
              memoryId: "m",
              scope: "session",
              summary: "s",
              freshness: "fresh",
              selectedReason: "r",
              selectedBy: "b",
              estimatedImportance: 1,
            },
          ],
          findings: [],
        },
        executionRoutingPlan: {
          mode: "dry_run",
          roleKey: "planner",
          workspaceStage: "requirements",
          items: [
            {
              roleKey: "planner",
              capability: "planning",
              provider: "openai",
              enabled: true,
              reason: "role_default",
            },
          ],
          findings: [],
        },
        executionRoutingSafetyReport: {
          mode: "dry_run_safety",
          status: "safe_dry_run",
          providerSwitchingEnabled: false,
          executionBlockingEnabled: false,
          automaticExecutionEnabled: false,
          unsupportedCapabilityCount: 0,
          warningItemCount: 0,
          providerHintCount: 0,
          totalItems: 1,
          findings: [],
        },
        reviewSecurityHarnessPlan: {
          mode: "dry_run_review_security",
          roleKey: "reviewer",
          workspaceStage: "requirements",
          checklist: [
            {
              id: "id1",
              area: "security",
              standard: "owasp_top10",
              title: "t",
              description: "d",
              severity: "info",
              appliesToRole: "security",
              reason: "r",
            },
          ],
          findings: [],
        },
        reviewSecurityIssuePlanningReport: {
          mode: "dry_run_issue_planning",
          issues: [
            {
              id: "i",
              sourceChecklistId: "s",
              area: "code_quality",
              standard: "internal_quality_standard",
              severity: "info",
              status: "candidate",
              title: "t",
              description: "d",
              remediationHint: "h",
              recommendedAction: "developer_fix",
              duplicateGroupKey: "g",
            },
          ],
          findings: [],
        },
        remediationLoopPlan: {
          mode: "dry_run_remediation_loop",
          steps: [{ order: 1, type: "review", actorRole: "reviewer", description: "d" }],
          findings: [],
        },
        overlayContextBudget: {
          estimatedInputTokens: 1200,
          estimatedOutputTokens: null,
          budgetPolicy: "balanced",
          overflowRisk: "low",
        },
        overlayPolicyWarnings: [
          { code: "w1", severity: "warning", message: "m", source: "singlechat", enforcement: "not_applied" },
        ],
      } as ExtractedOverlayPromptTraceMetadata,
    });
    expect(vm.summaryLines.length).toBeLessThanOrEqual(4);
  });
});
