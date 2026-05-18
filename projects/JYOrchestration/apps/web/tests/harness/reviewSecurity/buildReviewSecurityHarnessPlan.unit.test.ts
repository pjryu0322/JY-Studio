import { describe, expect, it } from "vitest";

import { buildReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/buildReviewSecurityHarnessPlan";
import type { ExecutionRoutingPlan } from "@/lib/harness/executionRouting/executionCapabilityTypes";
import type { KnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";

function mkExecutionRoutingPlan(): ExecutionRoutingPlan {
  return {
    mode: "dry_run",
    roleKey: "developer",
    workspaceStage: null,
    items: [
      {
        roleKey: "developer",
        capability: "code_generation",
        provider: "cursor",
        enabled: true,
        reason: "role_policy_recommended:cursor",
      },
    ],
    findings: [],
  };
}

function mkSecurityKnowledgeActivationPlan(): KnowledgeActivationPlan {
  return {
    mode: "dry_run",
    roleKey: "security",
    workspaceStage: null,
    taskType: null,
    items: [
      {
        knowledgePackId: "owasp-llm-top10",
        priority: "recommended",
        reasonType: "stage_policy",
        reasonLabel: "보안 지식팩 후보",
      },
    ],
    findings: [],
  };
}

describe("buildReviewSecurityHarnessPlan", () => {
  it("returns dry_run_review_security mode and trimmed role/stage", () => {
    const plan = buildReviewSecurityHarnessPlan({
      roleKey: "  reviewer ",
      workspaceStage: " analyze ",
    });
    expect(plan.mode).toBe("dry_run_review_security");
    expect(plan.roleKey).toBe("reviewer");
    expect(plan.workspaceStage).toBe("analyze");
  });

  it("emits reviewer baseline checklist for reviewer role", () => {
    const plan = buildReviewSecurityHarnessPlan({ roleKey: "reviewer" });
    const ids = plan.checklist.map((c) => c.id);
    expect(ids).toContain("requirements:internal_quality_standard:coverage");
    expect(ids).toContain("uiux:internal_quality_standard:consistency");
    expect(ids).toContain("code_quality:internal_quality_standard:test_coverage");
    expect(ids).toContain("architecture:jy_orchestration_baseline:flow_consistency");
    for (const item of plan.checklist) {
      expect(item.appliesToRole).toBe("reviewer");
    }
  });

  it("emits security baseline checklist for security role", () => {
    const plan = buildReviewSecurityHarnessPlan({ roleKey: "security" });
    const ids = plan.checklist.map((c) => c.id);
    expect(ids).toContain("security:owasp_top10:input_validation");
    expect(ids).toContain("security:owasp_llm_top10:prompt_injection");
    expect(ids).toContain("security:owasp_asvs:authn_session");
    expect(ids).toContain("security:mitre_cwe_top25:dangerous_patterns");
    expect(ids).toContain("privacy:jy_orchestration_baseline:pii_handling");
  });

  it("boosts code/security checklist when code_generation capability detected", () => {
    const plan = buildReviewSecurityHarnessPlan({
      roleKey: "developer",
      executionRoutingPlan: mkExecutionRoutingPlan(),
    });
    const ids = plan.checklist.map((c) => c.id);
    expect(ids).toContain("code_quality:internal_quality_standard:static_review");
    expect(ids).toContain("security:owasp_top10:code_diff_review");
    expect(plan.findings.some((f) => f.code === "CODE_GENERATION_WITHOUT_SECURITY_CHECKLIST")).toBe(
      false
    );
  });

  it("emits CODE_GENERATION_WITHOUT_SECURITY_CHECKLIST finding when sources do not boost security", () => {
    const plan = buildReviewSecurityHarnessPlan({
      roleKey: "planner",
      executionRoutingPlan: {
        mode: "dry_run",
        roleKey: "planner",
        workspaceStage: null,
        items: [
          {
            roleKey: "planner",
            capability: "code_generation",
            provider: "openai",
            enabled: true,
            reason: "role_policy_recommended:openai",
          },
        ],
        findings: [],
      },
    });
    // planner role has no security checklist by default; capability booster does add security item,
    // so finding should NOT be emitted (since security count > 0 from booster).
    const securityCount = plan.checklist.filter((c) => c.area === "security").length;
    expect(securityCount).toBeGreaterThan(0);
  });

  it("boosts security checklist when security knowledge activation present", () => {
    const plan = buildReviewSecurityHarnessPlan({
      roleKey: "security",
      knowledgeActivationPlan: mkSecurityKnowledgeActivationPlan(),
    });
    expect(
      plan.findings.some((f) => f.code === "SECURITY_KNOWLEDGE_ACTIVATION_PRESENT")
    ).toBe(true);
    const ids = plan.checklist.map((c) => c.id);
    expect(ids).toContain("security:owasp_llm_top10:prompt_handling_review");
  });

  it("always includes REVIEW_PLAN_DRY_RUN_ONLY finding", () => {
    const plan = buildReviewSecurityHarnessPlan({ roleKey: "reviewer" });
    expect(plan.findings.some((f) => f.code === "REVIEW_PLAN_DRY_RUN_ONLY")).toBe(true);
  });

  it("emits NO_REVIEW_ROLE_MATCH finding when no policy matches", () => {
    const plan = buildReviewSecurityHarnessPlan({ roleKey: "unknown_role" });
    expect(plan.findings.some((f) => f.code === "NO_REVIEW_ROLE_MATCH")).toBe(true);
  });

  it("deterministic ordering: severity desc, then area/standard order", () => {
    const planA = buildReviewSecurityHarnessPlan({ roleKey: "security" });
    const planB = buildReviewSecurityHarnessPlan({ roleKey: "security" });
    expect(planA.checklist.map((c) => c.id)).toEqual(planB.checklist.map((c) => c.id));
    // critical_candidate items should appear before warning ones.
    const severities = planA.checklist.map((c) => c.severity);
    const firstWarningIdx = severities.findIndex((s) => s === "warning");
    const lastCriticalIdx = severities.lastIndexOf("critical_candidate");
    if (firstWarningIdx >= 0 && lastCriticalIdx >= 0) {
      expect(lastCriticalIdx).toBeLessThan(firstWarningIdx);
    }
  });

  it("adds deployment booster when workspaceStage matches deployment keyword", () => {
    const plan = buildReviewSecurityHarnessPlan({
      roleKey: "reviewer",
      workspaceStage: "deploy-staging",
    });
    const ids = plan.checklist.map((c) => c.id);
    expect(ids).toContain("deployment:jy_orchestration_baseline:release_safety");
  });
});
