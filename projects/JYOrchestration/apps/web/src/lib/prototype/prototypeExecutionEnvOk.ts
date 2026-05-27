import { fetchEnvironmentTestLast, postExecutionSetupValidate } from "@/components/project-spec/api";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

export type PrototypeExecutionEnvBadge = "ok" | "needs" | "error" | "loading";

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
  const pid = projectId.trim();
  if (!pid) return false;

  try {
    const v = await postExecutionSetupValidate(pid, { scope: "all" });
    const vData = v.res.ok && v.json.success ? v.json.data : null;
    const git = vData?.git ?? "needs";
    const cursor = vData?.cursor ?? "needs";
    const github: PrototypeExecutionEnvBadge = vData?.githubOperableOk === true ? "ok" : "needs";
    let connectionTest: PrototypeExecutionEnvBadge = "needs";

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
        connectionTest = ok ? "ok" : terminal && failed ? "error" : "needs";
      }
    } catch {
      connectionTest = "error";
    }

    const runnable: PrototypeExecutionEnvBadge = vData
      ? vData.git === "ok" && vData.cursor === "ok" && vData.githubOperableOk === true && connectionTest === "ok"
        ? "ok"
        : "needs"
      : "needs";

    return isPrototypeExecutionEnvOk({ runnable, git, github, cursor, connectionTest });
  } catch {
    return false;
  }
}
