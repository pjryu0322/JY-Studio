import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { toUserSafeIntegrationErrorMessage } from "@/lib/prototype/implementationIntegrationErrors";
import {
  resolveIntegrationPipelineUserToast,
  sanitizeIntegrationPipelineApiResponseMessage,
} from "@/lib/prototype/implementationIntegrationToastPolicy";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type RunIntegrationBranchPipelineClientResult = Readonly<{
  readonly ok: boolean;
  readonly status?: string;
  readonly previewReady?: boolean;
  readonly nextRequiredStep?: string | null;
  readonly message?: string;
  readonly plan?: CodeTaskIntegrationPlanV1;
  readonly timeline?: readonly RequirementsPromptTimelineEntry[];
  readonly orchestrationPatch?: Record<string, unknown>;
}>;

export async function runIntegrationBranchPipelineClient(input: {
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationQuickRunV1?: unknown;
  readonly createPullRequest?: boolean;
}): Promise<RunIntegrationBranchPipelineClientResult> {
  const res = await credentialsIncludeFetch("/api/prototype/integration/run-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as {
    success?: boolean;
    status?: string;
    previewReady?: boolean;
    nextRequiredStep?: string | null;
    message?: string;
    plan?: CodeTaskIntegrationPlanV1;
    timeline?: readonly RequirementsPromptTimelineEntry[];
    orchestrationPatch?: Record<string, unknown>;
  };
  if (!res.ok) {
    return {
      ok: false,
      status: json.status,
      previewReady: json.previewReady ?? false,
      message: toUserSafeIntegrationErrorMessage(new Error(json.message ?? `HTTP ${res.status}`)),
    };
  }
  const previewReady = json.previewReady === true;
  const status = String(json.status ?? "").trim();
  const toast = resolveIntegrationPipelineUserToast({
    status,
    previewReady,
    integratedAppPreviewReady: previewReady,
    message: json.message,
    serverSaved: true,
  });
  return {
    ok: json.success === true,
    status,
    previewReady,
    nextRequiredStep: json.nextRequiredStep ?? null,
    message: toast.show ? toast.message ?? undefined : undefined,
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
