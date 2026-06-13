import { describe, expect, it } from "vitest";
import {
  codeTaskGithubOutcomeAppliesToExecutionUnit,
  buildVerifiedCodeTaskGithubOutcome,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { ENV_TEST_HELLO_WORLD_BRANCH_PREFIX } from "@/lib/execution/branchPolicy";
import {
  hasVerifiedCodeTaskCompletionEvidence,
  resolveCodeTaskBoardState,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { CODE_TASK_EXECUTION_RUN_VERSION, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

describe("hasVerifiedCodeTaskCompletionEvidence", () => {
  it("requires commit, branch head, or noCodeChange evidence", () => {
    expect(hasVerifiedCodeTaskCompletionEvidence({})).toBe(false);
    expect(hasVerifiedCodeTaskCompletionEvidence({ commitSha: "abc" })).toBe(true);
    expect(hasVerifiedCodeTaskCompletionEvidence({ branchHeadCommit: "def" })).toBe(true);
    expect(hasVerifiedCodeTaskCompletionEvidence({ noCodeChangeEvidence: true })).toBe(true);
  });
});

describe("resolveCodeTaskBoardState completion evidence", () => {
  it("does not mark CodeTask completed with only githubOutcomeSaved", () => {
    const result = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DEV-COMMON-002-001",
      title: "오류 메시지 공통 기능 구현",
      statusLabel: "완료",
      progressLabel: "GitHub outcome 저장됨",
      githubOutcomeSaved: true,
      commitSha: null,
      branchName: "wip/common/components",
      noCodeChangeEvidence: false,
      runIntegrationReady: null,
    });

    expect(result.isIntegrationReady).toBe(false);
    expect(result.isCompleted).toBe(false);
    expect(result.statusLabel).toBe("검증 중");
  });

  it("does not mark running Cursor execution as completed without evidence", () => {
    const result = resolveCodeTaskBoardState({
      codeTaskId: "CODE-RUNNING",
      title: "Running task",
      statusLabel: "실행 중",
      progressLabel: "실행 중",
      githubOutcomeSaved: false,
      commitSha: null,
    });
    expect(result.isCompleted).toBe(false);
    expect(result.isIntegrationReady).toBe(false);
    expect(result.isRunnableForUser).toBe(false);
  });

  it("requires commit, branch head, or noCodeChange evidence for integration readiness", () => {
    const onlyOutcome = resolveCodeTaskBoardState({
      codeTaskId: "A",
      title: "A",
      statusLabel: "완료",
      progressLabel: "GitHub outcome 저장됨",
      githubOutcomeSaved: true,
    });
    expect(onlyOutcome.isIntegrationReady).toBe(false);

    const withCommit = resolveCodeTaskBoardState({
      codeTaskId: "B",
      title: "B",
      statusLabel: "완료",
      progressLabel: "GitHub commit 확인됨",
      githubOutcomeSaved: true,
      commitSha: "sha1",
    });
    expect(withCommit.isIntegrationReady).toBe(true);

    const withBranchHead = resolveCodeTaskBoardState({
      codeTaskId: "C",
      title: "C",
      statusLabel: "완료",
      progressLabel: "GitHub branch head 확인됨",
      branchHeadCommit: "sha2",
    });
    expect(withBranchHead.isIntegrationReady).toBe(true);

    const noCodeChange = resolveCodeTaskBoardState({
      codeTaskId: "D",
      title: "D",
      statusLabel: "완료",
      progressLabel: "코드 변경 없음 증거 확인됨",
      noCodeChangeEvidence: true,
    });
    expect(noCodeChange.isIntegrationReady).toBe(true);
  });
});

describe("codeTaskGithubOutcomeAppliesToExecutionUnit", () => {
  it("does not apply ENV_TEST github outcome to CodeTask execution unit", () => {
    const envBranch = `${ENV_TEST_HELLO_WORLD_BRANCH_PREFIX}deadbeef`;
    const outcome = buildVerifiedCodeTaskGithubOutcome({
      checkedAt: "2026-06-13T00:00:00.000Z",
      workBranch: envBranch,
      commitSha: "envsha",
    });
    expect(
      codeTaskGithubOutcomeAppliesToExecutionUnit({
        outcome,
        workBranch: "wip/common/components",
      }),
    ).toBe(false);

    const unit: ImplementationExecutionUnitV1 = {
      unitId: "u1",
      codeTaskId: "CODE-DEV-COMMON-002-001",
      processTaskId: "DEV-COMMON-002",
      title: "task",
      order: 0,
      branchGroup: "common",
      baseBranch: "main",
      workBranch: "wip/common/components",
      dependencies: [],
      status: "running",
    };
    const run: CodeTaskExecutionRunV1 = {
      version: CODE_TASK_EXECUTION_RUN_VERSION,
      runId: "run-env",
      projectId: "p1",
      processTaskId: "DEV-COMMON-002",
      workItemId: "wi",
      codeTaskId: unit.codeTaskId,
      status: "github_verified",
      attemptNo: 1,
      createdAt: "2026-06-13T00:00:00.000Z",
      updatedAt: "2026-06-13T00:00:00.000Z",
      workBranch: envBranch,
      githubOutcome: outcome,
      commitSha: "envsha",
    };
    const resolved = resolveAuthoritativeCodeTaskOutcome({ unit, runs: [run] });
    expect(resolved.status).not.toBe("verified");
    expect(resolved.hasPersistedGithubOutcome).toBe(false);
  });
});
