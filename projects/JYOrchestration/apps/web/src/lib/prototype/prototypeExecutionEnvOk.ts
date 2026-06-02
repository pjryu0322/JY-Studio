import type { ExecutionSetupDto } from "@/components/project-spec/api";
import { fetchEnvironmentTestLast, fetchExecutionSetup } from "@/components/project-spec/api";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

export type PrototypeExecutionEnvBadge = "ok" | "needs" | "error" | "loading";

export type PrototypeExecutionEnvStatus = Readonly<{
  readonly git: PrototypeExecutionEnvBadge;
  readonly github: PrototypeExecutionEnvBadge;
  readonly cursor: PrototypeExecutionEnvBadge;
  readonly connectionTest: PrototypeExecutionEnvBadge;
  readonly runnable: PrototypeExecutionEnvBadge;
  readonly message: string | null;
}>;

function storedSideToBadge(ok: boolean | null | undefined): PrototypeExecutionEnvBadge {
  if (ok === true) return "ok";
  if (ok === false) return "error";
  return "needs";
}

export async function resolveConnectionTestEnvBadge(projectId: string): Promise<PrototypeExecutionEnvBadge> {
  const pid = projectId.trim();
  if (!pid) return "needs";
  try {
    const conn = await fetchEnvironmentTestLast(pid);
    if (conn.res.ok && conn.json.success && conn.json.data?.last) {
      const last = conn.json.data.last;
      const wf = String(last.workflowStatus ?? "").trim().toLowerCase();
      const terminal = last.isTerminal === true;
      const failLine = String(last.envTestStage1FailureLine ?? "").trim();
      const failed =
        wf === EXECUTION_WORKFLOW.FAILED ||
        wf === EXECUTION_WORKFLOW.VERIFY_FAILED ||
        Boolean(failLine);
      const mode = last.connectionTestMergeMode ?? "auto";
      const ok =
        terminal &&
        !failed &&
        (wf === EXECUTION_WORKFLOW.MERGED || (wf === EXECUTION_WORKFLOW.PR_OPENED && mode === "skip"));
      return ok ? "ok" : terminal && failed ? "error" : "needs";
    }
    return "needs";
  } catch {
    return "error";
  }
}

/** 저장된 execution-setup 검증 결과만 반영합니다(라이브 validate 호출 없음). */
export function buildPrototypeExecutionEnvStatusFromSetup(
  setup: ExecutionSetupDto | null,
  connectionTest: PrototypeExecutionEnvBadge,
): PrototypeExecutionEnvStatus {
  if (!setup) {
    return {
      git: "needs",
      github: "needs",
      cursor: "needs",
      connectionTest,
      runnable: "needs",
      message: null,
    };
  }

  const git = storedSideToBadge(setup.repoConnectionOk);
  const cursor = storedSideToBadge(setup.executorConnectionOk);
  const github: PrototypeExecutionEnvBadge =
    setup.githubCapabilityValidation?.githubOperableOk === true
      ? "ok"
      : setup.githubAuthConnectionOk === false
        ? "error"
        : "needs";
  // If the saved execution setup is validated, treat the environment as runnable
  // even when the connection-test record is missing/stale.
  const validated = String((setup as unknown as { status?: string }).status ?? "").trim() === "validated";
  const normalizedConnectionTest: PrototypeExecutionEnvBadge = validated ? "ok" : connectionTest;
  const runnable: PrototypeExecutionEnvBadge =
    git === "ok" && cursor === "ok" && github === "ok" && normalizedConnectionTest === "ok"
      ? "ok"
      : "needs";
  const message = setup.lastValidationError?.trim() || null;

  return { git, github, cursor, connectionTest: normalizedConnectionTest, runnable, message };
}

export async function loadPrototypeExecutionEnvStatus(projectId: string): Promise<PrototypeExecutionEnvStatus> {
  const pid = projectId.trim();
  if (!pid) {
    return {
      git: "needs",
      github: "needs",
      cursor: "needs",
      connectionTest: "needs",
      runnable: "needs",
      message: null,
    };
  }

  try {
    const [{ res, json }, connectionTest] = await Promise.all([
      fetchExecutionSetup(pid),
      resolveConnectionTestEnvBadge(pid),
    ]);
    const setup = res.ok && json.success ? (json.data ?? null) : null;
    return buildPrototypeExecutionEnvStatusFromSetup(setup, connectionTest);
  } catch {
    return {
      git: "error",
      github: "error",
      cursor: "error",
      connectionTest: "error",
      runnable: "error",
      message: "환경 정보를 불러오지 못했습니다.",
    };
  }
}

export function isPrototypeExecutionEnvOk(input: {
  readonly runnable?: PrototypeExecutionEnvBadge | string;
  readonly git?: PrototypeExecutionEnvBadge | string;
  readonly github?: PrototypeExecutionEnvBadge | string;
  readonly cursor?: PrototypeExecutionEnvBadge | string;
  readonly connectionTest?: PrototypeExecutionEnvBadge | string;
}): boolean {
  return (
    input.runnable === "ok" ||
    (input.git === "ok" &&
      input.github === "ok" &&
      input.cursor === "ok" &&
      input.connectionTest === "ok")
  );
}

export async function resolveProjectExecutionEnvOk(projectId: string): Promise<boolean> {
  const status = await loadPrototypeExecutionEnvStatus(projectId);
  return isPrototypeExecutionEnvOk(status);
}
