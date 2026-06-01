import type { LlmCodeTaskRefinementCaller } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

export function createProjectLlmCodeTaskRefinementCaller(projectId: string): LlmCodeTaskRefinementCaller {
  const pid = projectId.trim();
  return async (prompt: string) => {
    if (!pid) {
      return { ok: false, message: "projectId가 없습니다." };
    }
    try {
      const response = await fetch("/api/prototype/planning/refine-code-task-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: pid, prompt }),
      });
      const json = (await response.json()) as {
        readonly ok?: boolean;
        readonly text?: string;
        readonly message?: string;
        readonly usage?: {
          readonly promptTokens?: number;
          readonly completionTokens?: number;
          readonly totalTokens?: number;
          readonly model?: string;
        };
      };
      if (!response.ok || !json.ok || !json.text) {
        return { ok: false, message: json.message ?? "LLM CodeTask refinement API failed" };
      }
      return {
        ok: true,
        text: json.text,
        ...(json.usage ? { usage: json.usage } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message };
    }
  };
}

export type RefineCodeTaskPlanServerRequest = Readonly<{
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly heuristicPlan: ImplementationCodeTaskPlanV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly nowIso?: string;
  readonly forceLlm?: boolean;
}>;

export async function refineCodeTaskPlanViaServerApi(
  input: RefineCodeTaskPlanServerRequest,
): Promise<
  | Readonly<{ readonly ok: true; readonly result: unknown }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const projectId = input.projectId.trim();
  if (!projectId) return { ok: false, message: "projectId가 없습니다." };
  try {
    const response = await fetch("/api/prototype/planning/refine-code-task-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "plan",
        projectId,
        taskList: input.taskList,
        heuristicPlan: input.heuristicPlan,
        projectArtifacts: input.projectArtifacts,
        implementationSeedV1: input.implementationSeedV1,
        envOk: input.envOk,
        designOk: input.designOk,
        nowIso: input.nowIso,
        forceLlm: input.forceLlm,
      }),
    });
    const json = (await response.json()) as {
      readonly ok?: boolean;
      readonly result?: unknown;
      readonly message?: string;
    };
    if (!response.ok || !json.ok || !json.result) {
      return { ok: false, message: json.message ?? "LLM CodeTask refinement failed" };
    }
    return { ok: true, result: json.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}
