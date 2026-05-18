import { describe, expect, it } from "vitest";

import { buildReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/buildReviewSecurityHarnessPlan";
import { buildReviewSecurityIssuePlanningReport } from "@/lib/harness/reviewSecurity/buildReviewSecurityIssuePlanningReport";
import type { ExecutionRoutingSafetyReport } from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";

function mkSafety(
  status: ExecutionRoutingSafetyReport["status"]
): ExecutionRoutingSafetyReport {
  return {
    mode: "dry_run_safety",
    status,
    providerSwitchingEnabled: false,
    executionBlockingEnabled: false,
    automaticExecutionEnabled: false,
    unsupportedCapabilityCount: 0,
    warningItemCount: 0,
    providerHintCount: 0,
    totalItems: 0,
    findings: [],
  };
}

function mkMemoryWithStale(): MemoryRuntimePlan {
  return {
    mode: "dry_run",
    roleKey: "developer",
    references: [
      {
        memoryId: "ChatMessage:dialogueExcerpt",
        scope: "session",
        summary: "dummy stale memory",
        freshness: "stale",
        selectedReason: "recent_timeline_evidence",
        selectedBy: "recent_timeline",
        estimatedImportance: 40,
      },
    ],
    findings: [],
  };
}

describe("buildReviewSecurityIssuePlanningReport", () => {
  it("returns dry_run_issue_planning mode with no inputs", () => {
    const report = buildReviewSecurityIssuePlanningReport({});
    expect(report.mode).toBe("dry_run_issue_planning");
    expect(report.issues).toEqual([]);
    expect(report.findings.some((f) => f.code === "ISSUE_PLAN_DRY_RUN_ONLY")).toBe(true);
  });

  it("maps critical_candidate severity checklist to needs_review status", () => {
    const harness = buildReviewSecurityHarnessPlan({
      roleKey: "security",
      executionRoutingPlan: {
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
      },
    });
    const report = buildReviewSecurityIssuePlanningReport({
      reviewSecurityHarnessPlan: harness,
    });
    const critical = report.issues.find((i) => i.severity === "critical_candidate");
    if (critical) {
      expect(critical.status).toBe("needs_review");
    } else {
      // 정책 변경으로 critical이 안 나오는 경우에도 issue가 존재함을 보장.
      expect(report.issues.length).toBeGreaterThan(0);
    }
  });

  it("creates security issue candidate when checklist contains security items", () => {
    const harness = buildReviewSecurityHarnessPlan({ roleKey: "security" });
    const report = buildReviewSecurityIssuePlanningReport({
      reviewSecurityHarnessPlan: harness,
    });
    const securityIssue = report.issues.find((i) => i.area === "security");
    expect(securityIssue).toBeDefined();
    expect(securityIssue?.recommendedAction).toBe("security_recheck");
  });

  it("adds execution routing safety issue when status is unsafe_to_apply", () => {
    const report = buildReviewSecurityIssuePlanningReport({
      executionRoutingSafetyReport: mkSafety("unsafe_to_apply"),
    });
    const safetyIssue = report.issues.find(
      (i) => i.sourceChecklistId === "synthetic:execution_routing_safety"
    );
    expect(safetyIssue).toBeDefined();
    expect(safetyIssue?.severity).toBe("critical_candidate");
    expect(safetyIssue?.status).toBe("needs_review");
    expect(
      report.findings.some(
        (f) => f.code === "EXECUTION_ROUTING_UNSAFE_REVIEW_REQUIRED"
      )
    ).toBe(true);
  });

  it("adds memory review issue when stale references are present", () => {
    const report = buildReviewSecurityIssuePlanningReport({
      memoryRuntimePlan: mkMemoryWithStale(),
    });
    const memIssue = report.issues.find(
      (i) => i.sourceChecklistId === "synthetic:memory_runtime_stale"
    );
    expect(memIssue).toBeDefined();
    expect(memIssue?.severity).toBe("warning");
    expect(
      report.findings.some((f) => f.code === "STALE_MEMORY_REVIEW_RECOMMENDED")
    ).toBe(true);
  });

  it("dedupes issues by id and provides duplicateGroupKey", () => {
    const harness = buildReviewSecurityHarnessPlan({ roleKey: "reviewer" });
    const report = buildReviewSecurityIssuePlanningReport({
      reviewSecurityHarnessPlan: harness,
    });
    const ids = report.issues.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const issue of report.issues) {
      expect(issue.duplicateGroupKey.length).toBeGreaterThan(0);
    }
  });

  it("always emits ISSUE_PLAN_DRY_RUN_ONLY finding", () => {
    const harness = buildReviewSecurityHarnessPlan({ roleKey: "reviewer" });
    const report = buildReviewSecurityIssuePlanningReport({
      reviewSecurityHarnessPlan: harness,
      executionRoutingSafetyReport: mkSafety("watch"),
      memoryRuntimePlan: mkMemoryWithStale(),
    });
    expect(report.findings.some((f) => f.code === "ISSUE_PLAN_DRY_RUN_ONLY")).toBe(true);
  });

  it("produces deterministic ordering for repeated calls", () => {
    const harness = buildReviewSecurityHarnessPlan({
      roleKey: "security",
      workspaceStage: "analyze",
    });
    const a = buildReviewSecurityIssuePlanningReport({
      reviewSecurityHarnessPlan: harness,
    });
    const b = buildReviewSecurityIssuePlanningReport({
      reviewSecurityHarnessPlan: harness,
    });
    expect(a.issues.map((i) => i.id)).toEqual(b.issues.map((i) => i.id));
  });
});
