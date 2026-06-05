import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export type ImplementationRuntimeDiagnosticsRow = Readonly<{
  readonly codeTaskId: string;
  readonly runtimeState: string;
  readonly runtimeStateLabel: string;
  readonly cursorState: string;
  readonly githubState: string;
  readonly lastUpdate: string;
  readonly heartbeat: string | null;
}>;

export type QuickRunDispatchFromStartJob = Readonly<{
  readonly ok?: boolean;
  readonly outcome?: string;
  readonly reason?: string | null;
  readonly orchestrationPatch?: Record<string, unknown>;
}>;

export type ImplementationRuntimeFetchResult = Readonly<{
  readonly success: boolean;
  readonly bundle?: ImplementationRuntimeBundleView;
  readonly codeTaskQueueSnapshot?: CodeTaskExecutionQueueV1;
  readonly diagnostics?: readonly ImplementationRuntimeDiagnosticsRow[];
  readonly message?: string;
  readonly quickRunDispatch?: QuickRunDispatchFromStartJob;
}>;

export async function fetchImplementationRuntime(
  projectId: string,
  options?: { readonly recover?: boolean },
): Promise<ImplementationRuntimeFetchResult> {
  const pid = projectId.trim();
  if (!pid) return { success: false, message: "projectId가 필요합니다." };
  const recover = options?.recover === true;
  const qs = recover ? "?recover=1" : "";
  const res = await credentialsIncludeFetch(
    `/api/projects/${encodeURIComponent(pid)}/implementation-runtime${qs}`,
  );
  const data = (await res.json().catch(() => ({}))) as ImplementationRuntimeFetchResult;
  if (!res.ok) {
    return { success: false, message: data.message ?? `HTTP ${res.status}` };
  }
  return data;
}

export async function postImplementationRuntimeAction(input: {
  readonly projectId: string;
  readonly action: string;
  readonly requirementsState?: Record<string, unknown>;
  readonly selectedCodeTaskIds?: readonly string[];
  readonly queueItems?: readonly {
    readonly codeTaskId: string;
    readonly parentTaskId: string;
    readonly workItemId?: string | null;
  }[];
  readonly clientTrace?: {
    readonly phase?: string;
    readonly detail?: string;
    readonly selectedCount?: number;
  };
}): Promise<ImplementationRuntimeFetchResult & { readonly recovery?: unknown }> {
  const pid = input.projectId.trim();
  if (!pid) return { success: false, message: "projectId가 필요합니다." };
  const res = await credentialsIncludeFetch(
    `/api/projects/${encodeURIComponent(pid)}/implementation-runtime/actions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: input.action,
        ...(input.requirementsState ? { requirementsState: input.requirementsState } : {}),
        ...(input.selectedCodeTaskIds ? { selectedCodeTaskIds: input.selectedCodeTaskIds } : {}),
        ...(input.queueItems?.length ? { queueItems: input.queueItems } : {}),
        ...(input.clientTrace ? { clientTrace: input.clientTrace } : {}),
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as ImplementationRuntimeFetchResult & {
    readonly recovery?: unknown;
    readonly bundle?: ImplementationRuntimeBundleView;
  };
  if (!res.ok) {
    return { success: false, message: data.message ?? `HTTP ${res.status}` };
  }
  return data;
}
