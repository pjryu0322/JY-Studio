import { describe, expect, it } from "vitest";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import {
  buildEnvcheckEvidenceExecutionMessage,
  buildEnvcheckResultsFromEnvironmentTest,
} from "@/lib/prototype/envcheckConnectionResultMapper";

describe("envcheckConnectionResultMapper", () => {
  it("marks branch/file/pr passed when branchName and prUrl exist", () => {
    const rows = buildEnvcheckResultsFromEnvironmentTest({
      responseOk: true,
      apiSuccess: true,
      last: {
        taskId: "t1",
        name: "env",
        taskStatus: "done",
        workflowStatus: EXECUTION_WORKFLOW.PR_OPENED,
        branchName: "envcheck/t-hello-world-abc",
        prUrl: "https://github.com/o/r/pull/79",
        updatedAt: new Date().toISOString(),
      },
    });
    expect(rows.find((r) => r.key === "branch_create")?.status).toBe("passed");
    expect(rows.find((r) => r.key === "file_write")?.status).toBe("passed");
    expect(rows.find((r) => r.key === "pull_request_create_or_update")?.status).toBe("passed");
  });

  it("marks branch passed and PR warning when only branchName exists", () => {
    const rows = buildEnvcheckResultsFromEnvironmentTest({
      responseOk: false,
      apiSuccess: false,
      last: {
        taskId: "t1",
        name: "env",
        taskStatus: "running",
        workflowStatus: EXECUTION_WORKFLOW.COMMITTED,
        branchName: "envcheck/t-hello-world-cb19",
        prUrl: null,
        updatedAt: new Date().toISOString(),
      },
    });
    expect(rows.find((r) => r.key === "branch_create")?.status).toBe("passed");
    expect(rows.find((r) => r.key === "pull_request_create_or_update")?.status).toBe("warning");
  });

  it("does not skip envcheck when apiSuccess is false but evidence exists", () => {
    const rows = buildEnvcheckResultsFromEnvironmentTest({
      responseOk: false,
      apiSuccess: false,
      last: {
        taskId: "t1",
        name: "env",
        taskStatus: "done",
        workflowStatus: EXECUTION_WORKFLOW.PR_OPENED,
        branchName: "envcheck/t-hello-world-86c",
        prUrl: "https://github.com/o/r/pull/78",
        updatedAt: new Date().toISOString(),
      },
    });
    expect(rows.every((r) => r.status !== "skipped")).toBe(true);
  });

  it("does not embed raw errors in userSafeMessage", () => {
    const rows = buildEnvcheckResultsFromEnvironmentTest({
      responseOk: false,
      apiSuccess: false,
      message: "Error: github_pat_secret123 forbidden",
      last: null,
    });
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("github_pat");
    expect(serialized).not.toContain("forbidden");
  });

  it("buildEnvcheckEvidenceExecutionMessage reflects all passed", () => {
    const rows = buildEnvcheckResultsFromEnvironmentTest({
      responseOk: true,
      apiSuccess: true,
      last: {
        taskId: "t1",
        name: "env",
        taskStatus: "done",
        workflowStatus: EXECUTION_WORKFLOW.MERGED,
        branchName: "envcheck/t-x",
        prUrl: "https://github.com/o/r/pull/1",
        updatedAt: new Date().toISOString(),
      },
    });
    expect(buildEnvcheckEvidenceExecutionMessage(rows)).toContain("자동 생성 기본 점검이 정상입니다");
  });
});
