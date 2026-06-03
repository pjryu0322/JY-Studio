import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
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

export type ImplementationRuntimeFetchResult = Readonly<{
  readonly success: boolean;
  readonly bundle?: ImplementationRuntimeBundleView;
  readonly diagnostics?: readonly ImplementationRuntimeDiagnosticsRow[];
  readonly message?: string;
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
