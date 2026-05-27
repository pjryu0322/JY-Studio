/**
 * ENV_TEST 전용: POST 시작 전 서버 측 준비 상태 검증.
 * 일반 Task 실행 경로에는 사용하지 않는다.
 */

import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";

export type EnvTestReadinessBlocked = {
  ok: false;
  userMessage: string;
  reasonCode: string;
};

export type EnvTestReadinessResult = { ok: true } | EnvTestReadinessBlocked;

export async function assertEnvTestStartReadiness(input: {
  projectId: string;
  userId: string;
  /** prototype MVP 등: validated 전에도 시작을 허용(최소 조건만 검사) */
  allowUnvalidated?: boolean;
}): Promise<EnvTestReadinessResult> {
  const projectId = String(input.projectId ?? "").trim();
  const userId = String(input.userId ?? "").trim();
  const allowUnvalidated = input.allowUnvalidated === true;

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_readiness_check_started",
    projectId,
    userId,
    detail: {},
  });

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({
      where: { projectId },
      select: {
        status: true,
        gitRepoUrl: true,
        gitRepoName: true,
        baseBranch: true,
        autoPush: true,
        repoConnectionOk: true,
        githubAuthConnectionOk: true,
        cursorApiConnectionOk: true,
        executorConnectionOk: true,
        githubAccessToken: true,
        cursorApiToken: true,
      },
    })
  );

  const block = (reasonCode: string, userMessage: string): EnvTestReadinessResult => {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_readiness_check_blocked",
      projectId,
      userId,
      detail: { reasonCode, userMessage },
    });
    return { ok: false, reasonCode, userMessage };
  };

  if (!setup) {
    return block("NO_EXECUTION_SETUP", "실행 환경 준비가 완료되지 않았습니다");
  }

  if (allowUnvalidated) {
    const repoUrlOk = Boolean(String(setup.gitRepoUrl ?? "").trim());
    const repoNameOk = Boolean(String(setup.gitRepoName ?? "").trim());
    const ghTokOk = Boolean(String(setup.githubAccessToken ?? "").trim());
    const curTokOk = Boolean(String(setup.cursorApiToken ?? "").trim());
    if (!repoUrlOk || !repoNameOk || !ghTokOk || !curTokOk) {
      return block("EXECUTION_SETUP_MINIMAL_INCOMPLETE", "실행 환경 준비가 완료되지 않았습니다");
    }
  } else {
    if (String(setup.status ?? "").trim() !== "validated") {
      return block("EXECUTION_SETUP_NOT_VALIDATED", "실행 환경 준비가 완료되지 않았습니다");
    }
  }

  const baseTrim = String(setup.baseBranch ?? "").trim();
  if (!baseTrim) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_base_branch_missing",
      projectId,
      userId,
      detail: { reasonCode: "BASE_BRANCH_MISSING" },
    });
    return block("BASE_BRANCH_MISSING", "기본 브랜치 설정이 없어 ENV_TEST를 진행할 수 없습니다");
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_base_branch_resolved",
    projectId,
    userId,
    detail: { baseBranch: baseTrim },
  });

  if (!allowUnvalidated) {
    if (setup.repoConnectionOk !== true) {
      return block("REPO_CONNECTION", "저장소 연결이 필요합니다");
    }
    if (setup.githubAuthConnectionOk !== true) {
      return block("GITHUB_AUTH", "GitHub 인증이 필요합니다");
    }
    if (setup.cursorApiConnectionOk !== true) {
      return block("CURSOR_API", "Cursor 연결이 필요합니다");
    }
    if (setup.executorConnectionOk !== true) {
      return block("EXECUTOR", "실행 환경 준비가 완료되지 않았습니다");
    }
  }

  if (!allowUnvalidated) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_push_policy_check_started",
      projectId,
      userId,
      detail: {},
    });

    if (setup.autoPush !== true) {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_push_policy_blocked",
        projectId,
        userId,
        detail: { reasonCode: "AUTO_PUSH_OFF" },
      });
      return block("AUTO_PUSH_OFF", "ENV_TEST는 Push 가능한 실행 정책에서만 실행할 수 있습니다");
    }
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_readiness_check_passed",
    projectId,
    userId,
    detail: {},
  });

  return { ok: true };
}
