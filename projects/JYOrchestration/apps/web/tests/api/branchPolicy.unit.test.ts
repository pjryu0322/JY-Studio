import { afterEach, describe, expect, it } from "vitest";
import { ENV_TEST_STAGE2_TASK_KIND, ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import {
  ENV_TEST_HELLO_WORLD_BRANCH_PREFIX,
  computeExecutionBranchPlan,
  isEnvTestHelloWorldBranchName,
} from "@/lib/execution/branchPolicy";
import { isExecutionAllowManualStayOnBase } from "@/lib/execution/branchSlug";

const projectId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const taskId = "task-1234-5678-90ab-cdef12345678";

describe("computeExecutionBranchPlan", () => {
  afterEach(() => {
    delete process.env.EXECUTION_ALLOW_MANUAL_STAY_ON_BASE;
  });

  it("keeps ENV_TEST hello-world branch naming", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "manual",
      branchPrefix: "orch",
      projectId,
      projectName: "테스트",
      taskId: projectId,
      taskTitle: "Hello",
      baseBranch: "main",
      taskKind: ENV_TEST_TASK_KIND,
    });
    expect(plan.branchName).toMatch(new RegExp(`^${ENV_TEST_HELLO_WORLD_BRANCH_PREFIX}[0-9a-f]{8}$`, "i"));
    expect(plan.manualStayOnBase).toBe(false);
    expect(isEnvTestHelloWorldBranchName(plan.branchName)).toBe(true);
  });

  it("keeps ENV_TEST_STAGE2 branch naming", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "feature-per-task",
      branchPrefix: "orch",
      projectId,
      projectName: "Stage2",
      taskId,
      taskTitle: "S2",
      baseBranch: "main",
      taskKind: ENV_TEST_STAGE2_TASK_KIND,
    });
    expect(plan.branchName.startsWith(ENV_TEST_HELLO_WORLD_BRANCH_PREFIX)).toBe(true);
  });

  it("prefers repositoryName over projectName for feature-per-task branch", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "feature-per-task",
      branchPrefix: "orch",
      projectId,
      projectName: "회의록 자동화",
      repositoryName: "myorg/meeting-summary-service",
      taskId,
      taskTitle: "Add Model",
      baseBranch: "main",
    });
    expect(plan.branchName).toMatch(/^orch\/meeting-summary-service\/t-/);
    expect(plan.branchName).not.toMatch(/p-a1b2c3d4/);
    expect(plan.branchName).not.toBe("main");
    expect(plan.manualStayOnBase).toBe(false);
  });

  it("includes project slug in feature-per-task branch when repositoryName absent", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "feature-per-task",
      branchPrefix: "orch",
      projectId,
      projectName: "Runtime Event",
      taskId,
      taskTitle: "Add Model",
      baseBranch: "main",
    });
    expect(plan.branchName).toMatch(/^orch\/runtime-event\/t-/);
    expect(plan.branchName).not.toBe("main");
    expect(plan.manualStayOnBase).toBe(false);
  });

  it("includes repository slug in feature-per-workflow branch", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "feature-per-workflow",
      branchPrefix: "orch",
      projectId,
      projectName: "My App",
      repositoryName: "org/my-app",
      taskId,
      taskTitle: "ignored",
      baseBranch: "main",
    });
    expect(plan.branchName).toMatch(/^orch\/my-app\/w-[0-9a-f]{8}$/);
  });

  it("uses fallback project slug for Korean-only project name", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "feature-per-task",
      branchPrefix: "orch",
      projectId,
      projectName: "회의록 자동화",
      taskId,
      taskTitle: "task-a",
      baseBranch: "main",
    });
    expect(plan.branchName).toMatch(/^orch\/p-a1b2c3d4\/t-/);
  });

  it("manual strategy avoids baseBranch by default", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "manual",
      branchPrefix: "orch",
      projectId,
      projectName: "App",
      taskId,
      taskTitle: "Fix",
      baseBranch: "main",
    });
    expect(plan.branchName).toMatch(/^orch\/manual\/t-/);
    expect(plan.branchName).not.toBe("main");
    expect(plan.manualStayOnBase).toBe(false);
    expect(isExecutionAllowManualStayOnBase()).toBe(false);
  });

  it("uses ASCII-safe task title slug with Korean fallback", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "feature-per-task",
      branchPrefix: "orch",
      projectId,
      projectName: "회의록",
      repositoryName: "org/meeting-summary-service",
      taskId,
      taskTitle: "런타임 이벤트 추가",
      baseBranch: "main",
    });
    expect(plan.branchName).toMatch(/^orch\/meeting-summary-service\/t-.+-task$/);
    expect(plan.branchName).not.toMatch(/[가-힣]/);
  });

  it("slugifies ASCII task titles", () => {
    const plan = computeExecutionBranchPlan({
      branchStrategy: "feature-per-task",
      branchPrefix: "orch",
      projectId,
      repositoryName: "org/my-app",
      taskId,
      taskTitle: "runtime event model",
      baseBranch: "main",
    });
    expect(plan.branchName).toMatch(/runtime-event-model/);
  });

  it("manual stay-on-base only when EXECUTION_ALLOW_MANUAL_STAY_ON_BASE=1", () => {
    process.env.EXECUTION_ALLOW_MANUAL_STAY_ON_BASE = "1";
    expect(isExecutionAllowManualStayOnBase()).toBe(true);
    const plan = computeExecutionBranchPlan({
      branchStrategy: "manual",
      branchPrefix: "orch",
      projectId,
      projectName: "App",
      taskId,
      taskTitle: "Fix",
      baseBranch: "main",
    });
    expect(plan.branchName).toBe("main");
    expect(plan.manualStayOnBase).toBe(true);
  });
});
