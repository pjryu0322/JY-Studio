import { describe, expect, it } from "vitest";
import {
  asReadonlyArray,
  normalizeCodeTaskIntegrationPlan,
  normalizePartialIntegrationPlanArrays,
} from "@/lib/prototype/implementationIntegrationPlanNormalize";
import { assertIntegrationMergeTargets } from "@/lib/prototype/implementationIntegrationPlanValidation";
import {
  IntegrationPipelineDomainError,
  toUserSafeIntegrationErrorMessage,
  buildIntegrationPipelineRuntimeErrorLogFields,
} from "@/lib/prototype/implementationIntegrationErrors";
import { evaluateImplementationPreviewReadiness } from "@/lib/prototype/implementationPreviewReadiness";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";

const NOW = "2026-06-03T00:00:00.000Z";

const BASE_PLAN: CodeTaskIntegrationPlanV1 = {
  version: "code_task_integration_plan_v1",
  projectId: "proj-1",
  targetRepository: "https://github.com/o/r",
  baseBranch: "main",
  integrationBranch: "integration/proj-1",
  createdAt: NOW,
  status: "draft",
  strategy: "merge",
  included: [],
  excluded: [],
};

describe("P3-M67 integration plan array normalization", () => {
  it("normalizes undefined included/excluded/mergeResults to empty arrays", () => {
    const raw = {
      ...BASE_PLAN,
      included: undefined,
      excluded: undefined,
      mergeResults: undefined,
    } as unknown as CodeTaskIntegrationPlanV1;
    const plan = normalizeCodeTaskIntegrationPlan(raw);
    expect(plan.included).toEqual([]);
    expect(plan.excluded).toEqual([]);
    expect(plan.mergeResults).toEqual([]);
    expect(plan.included.filter(() => true)).toEqual([]);
  });

  it("normalizePartialIntegrationPlanArrays reports non-array fields", () => {
    const raw = {
      ...BASE_PLAN,
      included: undefined,
      excluded: [],
      mergeResults: null,
    } as unknown as CodeTaskIntegrationPlanV1;
    const { audit } = normalizePartialIntegrationPlanArrays(raw);
    expect(audit.includedWasArray).toBe(false);
    expect(audit.mergeResultsWasArray).toBe(false);
  });
});

describe("P3-M67 merge target guards", () => {
  it("throws integration_included_targets_empty when included is empty", () => {
    expect(() =>
      assertIntegrationMergeTargets({
        plan: BASE_PLAN,
        effectiveSourceBranch: null,
        mergeItems: [],
      }),
    ).toThrow(IntegrationPipelineDomainError);
    try {
      assertIntegrationMergeTargets({
        plan: BASE_PLAN,
        effectiveSourceBranch: null,
        mergeItems: [],
      });
    } catch (e) {
      expect((e as IntegrationPipelineDomainError).code).toBe("integration_included_targets_empty");
    }
  });

  it("throws integration_source_missing when effective source has no matching merge item", () => {
    const plan: CodeTaskIntegrationPlanV1 = {
      ...BASE_PLAN,
      included: [
        {
          codeTaskId: "CT-1",
          taskId: "DEV-1",
          title: "A",
          workBranch: "wip/a",
          commitSha: "sha1",
        },
        {
          codeTaskId: "CT-2",
          taskId: "DEV-2",
          title: "B",
          workBranch: "wip/b",
          commitSha: "sha2",
        },
      ],
    };
    expect(() =>
      assertIntegrationMergeTargets({
        plan,
        effectiveSourceBranch: "wip/missing",
        mergeItems: [],
      }),
    ).toThrow(IntegrationPipelineDomainError);
  });

  it("allows effective source matching included workBranch", () => {
    const plan: CodeTaskIntegrationPlanV1 = {
      ...BASE_PLAN,
      included: [
        {
          codeTaskId: "CT-1",
          taskId: "DEV-1",
          title: "A",
          workBranch: "wip/head",
          commitSha: "sha1",
        },
        {
          codeTaskId: "CT-2",
          taskId: "DEV-2",
          title: "B",
          workBranch: "wip/b",
          commitSha: "sha2",
        },
      ],
    };
    const mergeItems = asReadonlyArray(plan.included).filter((i) => i.workBranch === "wip/head");
    expect(() =>
      assertIntegrationMergeTargets({
        plan,
        effectiveSourceBranch: "wip/head",
        mergeItems,
      }),
    ).not.toThrow();
  });
});

describe("P3-M67 safe integration error messages", () => {
  it("maps TypeError filter message to safe user text", () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'filter')");
    expect(toUserSafeIntegrationErrorMessage(err)).toBe(
      "Preview 준비를 계속 진행해야 합니다.\n아래 버튼을 눌러 다음 단계를 실행해 주세요.",
    );
    expect(toUserSafeIntegrationErrorMessage(err)).not.toMatch(/Cannot read properties/);
  });

  it("buildIntegrationPipelineRuntimeErrorLogFields includes safeMessage", () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'filter')");
    const fields = buildIntegrationPipelineRuntimeErrorLogFields(err);
    expect(fields.errorName).toBe("TypeError");
    expect(fields.safeMessage).toContain("Preview 준비를 계속 진행");
  });
});

describe("P3-M67 preview readiness after failed integration plan", () => {
  const eligibility = {
    canIntegrate: true,
    included: [
      {
        codeTaskId: "CT-1",
        taskId: "DEV-A",
        title: "Feature",
        status: "completed",
        source: "runtime_run" as const,
      },
    ],
    excluded: [],
    warnings: [],
    hasAppShell: true,
    hasAnyScreenTask: true,
  };

  it("does not mark integrated app preview ready when plan status is failed", () => {
    const readiness = evaluateImplementationPreviewReadiness({
      projectId: "proj-1",
      codeTaskPlan: null,
      codeTaskRuns: [],
      eligibility,
      previewRuntime: null,
      integrationPlan: { ...BASE_PLAN, status: "failed", failureMessage: "runtime" },
    });
    expect(readiness.integratedAppPreviewReady).toBe(false);
  });
});
