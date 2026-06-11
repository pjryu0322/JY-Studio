import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export type DbQueuedQuickRunAutoDispatchResultV1 = Readonly<{
  readonly dispatchOk: boolean;
  readonly dispatchOutcome: string | undefined;
  readonly dispatchReason: string | null;
  readonly orchestrationPatch: Record<string, unknown> | undefined;
}>;

export type ContinueQuickRunModeV1 =
  | "db_queued_auto_dispatch"
  | "recover_missing_server_continuation";

export async function postContinueQuickRun(input: {
  readonly projectId: string;
  readonly mode: ContinueQuickRunModeV1;
}): Promise<DbQueuedQuickRunAutoDispatchResultV1> {
  const pid = input.projectId.trim();
  const res = await credentialsIncludeFetch("/api/prototype/implementation-runtime/continue-quick-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: pid,
      mode: input.mode,
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    outcome?: string;
    reason?: string;
    orchestrationPatch?: Record<string, unknown>;
  };
  const dispatchOk = json.outcome === "dispatched" || json.success === true;
  return {
    dispatchOk,
    dispatchOutcome: json.outcome,
    dispatchReason: json.reason ?? null,
    orchestrationPatch: json.orchestrationPatch,
  };
}

export async function postDbQueuedQuickRunAutoDispatch(input: {
  readonly projectId: string;
}): Promise<DbQueuedQuickRunAutoDispatchResultV1> {
  return postContinueQuickRun({ projectId: input.projectId, mode: "db_queued_auto_dispatch" });
}
