import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateGovernanceEnforcementDesign } from "@/lib/agents/evaluateGovernanceEnforcementDesign";
import { evaluateGovernancePrecheckDryRun } from "@/lib/agents/governancePrecheckDryRun";
import type { GovernancePrecheckDryRunResult } from "@/lib/agents/governancePrecheckDryRunTypes";
import * as governancePrecheckModule from "@/lib/agents/governancePrecheckDryRun";

const emptyGov: GovernancePrecheckDryRunResult = {
  mode: "dry_run",
  status: "not_evaluated",
  requiredChecks: [],
  evaluatedPolicyIds: [],
  findings: [],
  warnings: [],
  blockingCandidates: [],
};

describe("multi-agent governance enforcement design stage 2-12", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("not_evaluated returns defer and observe_only", () => {
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: emptyGov });
    expect(report.decision).toBe("defer");
    expect(report.enforcementMode).toBe("observe_only");
  });

  it("pass_candidate returns ready_for_policy_design and observe_only", () => {
    const gov = evaluateGovernancePrecheckDryRun({ requiredChecks: ["stage:ideation"] });
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.decision).toBe("ready_for_policy_design");
    expect(report.enforcementMode).toBe("observe_only");
  });

  it("warning_candidate returns ready_for_policy_design and warn_only", () => {
    const gov = evaluateGovernancePrecheckDryRun({ requiredChecks: ["connector:cursor"] });
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.decision).toBe("ready_for_policy_design");
    expect(report.enforcementMode).toBe("warn_only");
  });

  it("blocking_candidate returns defer and block_candidate", () => {
    const gov: GovernancePrecheckDryRunResult = {
      mode: "dry_run",
      status: "blocking_candidate",
      requiredChecks: ["critical:block"],
      evaluatedPolicyIds: ["policy.block.test"],
      findings: [
        {
          policyId: "policy.block.test",
          check: "critical:block",
          severity: "blocking_candidate",
          message: "blocking policy matched",
        },
      ],
      warnings: [],
      blockingCandidates: ["policy.block.test"],
    };
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.decision).toBe("defer");
    expect(report.enforcementMode).toBe("block_candidate");
  });

  it("blocking_candidate sets approval, override, audit, and rollback flags", () => {
    const gov: GovernancePrecheckDryRunResult = {
      ...emptyGov,
      status: "blocking_candidate",
      findings: [
        { policyId: "p1", check: "c1", severity: "blocking_candidate", message: "block" },
      ],
      blockingCandidates: ["p1"],
    };
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.requiresPolicyApproval).toBe(true);
    expect(report.requiresOperatorOverride).toBe(true);
    expect(report.requiresAuditLog).toBe(true);
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("maps findings to policyDecisions", () => {
    const gov = evaluateGovernancePrecheckDryRun({ requiredChecks: ["connector:cursor"] });
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.policyDecisions.length).toBe(gov.findings.length);
    expect(report.policyDecisions[0]?.policyId).toBeTruthy();
    expect(report.policyDecisions[0]?.enforcementMode).toBe("warn_only");
  });

  it("report mode is read_only_governance_enforcement_design", () => {
    const report = evaluateGovernanceEnforcementDesign({
      governanceDryRun: evaluateGovernancePrecheckDryRun({ requiredChecks: ["stage:ideation"] }),
    });
    expect(report.mode).toBe("read_only_governance_enforcement_design");
  });

  it("maps blocking_candidate severity to block_candidate policyDecision", () => {
    const gov: GovernancePrecheckDryRunResult = {
      ...emptyGov,
      status: "blocking_candidate",
      findings: [
        { policyId: "p1", check: "c1", severity: "blocking_candidate", message: "block" },
      ],
      blockingCandidates: ["p1"],
    };
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.policyDecisions.some((d) => d.enforcementMode === "block_candidate")).toBe(true);
    expect(report.policyDecisions.find((d) => d.check === "c1")?.enforcementMode).toBe(
      "block_candidate",
    );
  });

  it("adds block_candidate policyDecision when only blockingCandidates are present", () => {
    const gov: GovernancePrecheckDryRunResult = {
      ...emptyGov,
      status: "blocking_candidate",
      findings: [],
      blockingCandidates: ["critical:block"],
    };
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.policyDecisions).toHaveLength(1);
    expect(report.policyDecisions[0]?.enforcementMode).toBe("block_candidate");
    expect(report.policyDecisions[0]?.check).toBe("critical:block");
  });

  it("warning_candidate without policyDecisions adds status_findings_mismatch warning", () => {
    const gov: GovernancePrecheckDryRunResult = {
      ...emptyGov,
      status: "warning_candidate",
      findings: [],
      warnings: [],
      blockingCandidates: [],
    };
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.findings.some((f) => f.code === "status_findings_mismatch")).toBe(true);
  });

  it("blocking_candidate without block policyDecision adds blocking_candidate_without_policy_decision warning", () => {
    const gov: GovernancePrecheckDryRunResult = {
      ...emptyGov,
      status: "blocking_candidate",
      findings: [{ policyId: "p1", check: "c1", severity: "info", message: "info only" }],
      blockingCandidates: [],
    };
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(
      report.findings.some((f) => f.code === "blocking_candidate_without_policy_decision"),
    ).toBe(true);
  });

  it("warn_only sets requiresAuditLog true and approval flags false", () => {
    const gov = evaluateGovernancePrecheckDryRun({ requiredChecks: ["connector:cursor"] });
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(report.enforcementMode).toBe("warn_only");
    expect(report.requiresAuditLog).toBe(true);
    expect(report.requiresPolicyApproval).toBe(false);
    expect(report.requiresOperatorOverride).toBe(false);
    expect(report.requiresRollbackPlan).toBe(false);
  });

  it("observe_only sets requiresAuditLog false", () => {
    const report = evaluateGovernanceEnforcementDesign({ governanceDryRun: emptyGov });
    expect(report.enforcementMode).toBe("observe_only");
    expect(report.requiresAuditLog).toBe(false);
    expect(report.requiresPolicyApproval).toBe(false);
  });

  it("does not invoke governance precheck when evaluating design report", () => {
    const precheckSpy = vi.spyOn(governancePrecheckModule, "evaluateGovernancePrecheckDryRun");
    const gov: GovernancePrecheckDryRunResult = {
      mode: "dry_run",
      status: "warning_candidate",
      requiredChecks: ["connector:cursor"],
      evaluatedPolicyIds: ["connector.cursor.required"],
      findings: [
        {
          policyId: "connector.cursor.required",
          check: "connector:cursor",
          severity: "warning",
          message: "policy_matched:connector.cursor.required",
        },
      ],
      warnings: [],
      blockingCandidates: [],
    };
    evaluateGovernanceEnforcementDesign({ governanceDryRun: gov });
    expect(precheckSpy).not.toHaveBeenCalled();
  });
});
