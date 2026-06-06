import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export async function runIntegrationBranchPipelineClient(input: {
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationQuickRunV1?: unknown;
  readonly createPullRequest?: boolean;
}): Promise<
  Readonly<{
    readonly ok: boolean;
    readonly message?: string;
    readonly plan?: CodeTaskIntegrationPlanV1;
    readonly timeline?: readonly RequirementsPromptTimelineEntry[];
    readonly orchestrationPatch?: Record<string, unknown>;
  }>
> {
  const res = await credentialsIncludeFetch("/api/prototype/integration/run-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    plan?: CodeTaskIntegrationPlanV1;
    timeline?: readonly RequirementsPromptTimelineEntry[];
    orchestrationPatch?: Record<string, unknown>;
  };
  if (!res.ok) {
    return { ok: false, message: json.message ?? `HTTP ${res.status}` };
  }
  return {
    ok: json.success === true,
    message: json.message,
    plan: json.plan,
    timeline: json.timeline,
    orchestrationPatch: json.orchestrationPatch,
  };
}

export async function mergeIntegrationPullRequestClient(input: {
  readonly projectId: string;
}): Promise<Readonly<{ readonly ok: boolean; readonly message?: string }>> {
  const res = await credentialsIncludeFetch("/api/prototype/integration/merge-pr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as { success?: boolean; message?: string };
  if (!res.ok) return { ok: false, message: json.message ?? `HTTP ${res.status}` };
  return { ok: json.success === true, message: json.message };
}
