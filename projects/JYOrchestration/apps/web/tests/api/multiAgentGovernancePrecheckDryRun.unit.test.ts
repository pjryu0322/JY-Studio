import { describe, expect, it } from "vitest";
import { evaluateGovernancePrecheckDryRun } from "@/lib/agents/governancePrecheckDryRun";
import {
  getGovernancePoliciesForCheck,
  listGovernancePolicies,
} from "@/lib/agents/governancePolicyRegistry";

describe("multi-agent governance precheck dry-run stage 2-4", () => {
  it("listGovernancePolicies returns default policies", () => {
    const policies = listGovernancePolicies();
    expect(policies.length).toBeGreaterThanOrEqual(5);
    expect(policies.some((p) => p.id === "stage.ideation.required")).toBe(true);
  });

  it("getGovernancePoliciesForCheck returns policies for stage:ideation", () => {
    const policies = getGovernancePoliciesForCheck("stage:ideation");
    expect(policies.length).toBeGreaterThan(0);
    expect(policies[0]?.appliesToChecks).toContain("stage:ideation");
  });

  it("empty requiredChecks returns not_evaluated", () => {
    const r = evaluateGovernancePrecheckDryRun({ requiredChecks: [] });
    expect(r.status).toBe("not_evaluated");
    expect(r.mode).toBe("dry_run");
  });

  it("stage:ideation returns pass_candidate with info finding", () => {
    const r = evaluateGovernancePrecheckDryRun({ requiredChecks: ["stage:ideation"] });
    expect(r.status).toBe("pass_candidate");
    expect(r.findings.some((f) => f.message.includes("stage.ideation.required"))).toBe(true);
  });

  it("connector:cursor returns warning_candidate", () => {
    const r = evaluateGovernancePrecheckDryRun({ requiredChecks: ["connector:cursor"] });
    expect(r.status).toBe("warning_candidate");
    expect(r.findings.some((f) => f.policyId === "connector.cursor.required")).toBe(true);
  });

  it("registry-guard returns warning_candidate", () => {
    const r = evaluateGovernancePrecheckDryRun({ requiredChecks: ["registry-guard"] });
    expect(r.status).toBe("warning_candidate");
  });

  it("unknown check returns warning finding without throwing", () => {
    expect(() =>
      evaluateGovernancePrecheckDryRun({ requiredChecks: ["unknown_check_xyz"] }),
    ).not.toThrow();
    const r = evaluateGovernancePrecheckDryRun({ requiredChecks: ["unknown_check_xyz"] });
    expect(r.warnings.some((w) => w.includes("unknown_governance_check"))).toBe(true);
    expect(r.status).toBe("warning_candidate");
  });

  it("does not perform actual governance blocking", () => {
    const r = evaluateGovernancePrecheckDryRun({
      requiredChecks: ["registry-guard", "connector:cursor"],
    });
    expect(r.mode).toBe("dry_run");
    expect(r.blockingCandidates).toEqual([]);
  });
});
