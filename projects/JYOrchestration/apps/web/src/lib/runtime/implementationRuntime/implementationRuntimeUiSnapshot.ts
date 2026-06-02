import type { RuntimeState } from "@/lib/prototype/implementationRuntimeState";
import {
  formatRuntimeStateKo,
  IMPLEMENTATION_RUNTIME_STATE_VERSION,
  type ImplementationRuntimeActiveDispatchV1,
  type ImplementationRuntimeStateV1,
  type RuntimeGithubState,
} from "@/lib/prototype/implementationRuntimeState";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export const IMPLEMENTATION_RUNTIME_UI_SNAPSHOT_VERSION = "implementation_runtime_ui_snapshot_v1" as const;

export type ImplementationRuntimeUiSnapshotRunV1 = Readonly<{
  readonly codeTaskId: string;
  readonly runtimeState: RuntimeState;
  readonly cursorAgentId: string | null;
  readonly lastHeartbeatAt: string | null;
  readonly updatedAt: string;
}>;

export type ImplementationRuntimeUiSnapshotV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_RUNTIME_UI_SNAPSHOT_VERSION;
  readonly jobId: string | null;
  readonly jobStatus: string;
  readonly currentCodeTaskId: string | null;
  readonly currentRuntimeState: RuntimeState;
  readonly activeDispatch: ImplementationRuntimeActiveDispatchV1 | null;
  readonly runs: readonly ImplementationRuntimeUiSnapshotRunV1[];
  readonly updatedAt: string;
}>;

export function parseImplementationRuntimeUiSnapshotV1(
  raw: unknown,
): ImplementationRuntimeUiSnapshotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== IMPLEMENTATION_RUNTIME_UI_SNAPSHOT_VERSION) return null;
  const currentRuntimeState = String(o.currentRuntimeState ?? "idle").trim() as RuntimeState;
  const runsRaw = Array.isArray(o.runs) ? o.runs : [];
  const runs = runsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const codeTaskId = String(r.codeTaskId ?? "").trim();
      if (!codeTaskId) return null;
      return {
        codeTaskId,
        runtimeState: String(r.runtimeState ?? "idle").trim() as RuntimeState,
        cursorAgentId: r.cursorAgentId != null ? String(r.cursorAgentId) : null,
        lastHeartbeatAt: r.lastHeartbeatAt != null ? String(r.lastHeartbeatAt) : null,
        updatedAt: String(r.updatedAt ?? o.updatedAt ?? new Date().toISOString()),
      };
    })
    .filter((r): r is ImplementationRuntimeUiSnapshotRunV1 => r !== null);

  let activeDispatch: ImplementationRuntimeActiveDispatchV1 | null = null;
  const dispatchRaw = o.activeDispatch;
  if (dispatchRaw && typeof dispatchRaw === "object") {
    const d = dispatchRaw as Record<string, unknown>;
    const codeTaskId = String(d.codeTaskId ?? "").trim();
    if (codeTaskId) {
      activeDispatch = {
        codeTaskId,
        parentTaskId: String(d.parentTaskId ?? "").trim() || codeTaskId,
        workItemId: String(d.workItemId ?? "").trim() || codeTaskId,
      };
    }
  }

  return {
    version: IMPLEMENTATION_RUNTIME_UI_SNAPSHOT_VERSION,
    jobId: o.jobId != null ? String(o.jobId) : null,
    jobStatus: String(o.jobStatus ?? "idle"),
    currentCodeTaskId: o.currentCodeTaskId != null ? String(o.currentCodeTaskId) : null,
    currentRuntimeState,
    activeDispatch,
    runs,
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
  };
}

export function buildImplementationRuntimeUiSnapshotFromBundle(
  bundle: ImplementationRuntimeBundleView,
  input?: {
    readonly activeDispatch?: ImplementationRuntimeActiveDispatchV1 | null;
    readonly nowIso?: string;
  },
): ImplementationRuntimeUiSnapshotV1 {
  const nowIso = input?.nowIso ?? new Date().toISOString();
  return {
    version: IMPLEMENTATION_RUNTIME_UI_SNAPSHOT_VERSION,
    jobId: bundle.job?.id ?? null,
    jobStatus: bundle.job?.status ?? "idle",
    currentCodeTaskId: bundle.job?.currentCodeTaskId ?? null,
    currentRuntimeState: bundle.currentRun?.runtimeState ?? "idle",
    activeDispatch: input?.activeDispatch ?? null,
    runs: bundle.runs.map((r) => ({
      codeTaskId: r.codeTaskId,
      runtimeState: r.runtimeState,
      cursorAgentId: r.cursorAgentId,
      lastHeartbeatAt: r.lastHeartbeatAt,
      updatedAt: r.updatedAt,
    })),
    updatedAt: bundle.job?.updatedAt ?? nowIso,
  };
}

export function buildImplementationRuntimeUiSnapshotFromRuntimeState(input: {
  readonly runtime: ImplementationRuntimeStateV1;
  readonly activeDispatch?: ImplementationRuntimeActiveDispatchV1 | null;
}): ImplementationRuntimeUiSnapshotV1 {
  const dispatch = input.activeDispatch ?? input.runtime.activeDispatch ?? null;
  const codeTaskId = dispatch?.codeTaskId ?? input.runtime.activeCodeTaskId ?? null;
  return {
    version: IMPLEMENTATION_RUNTIME_UI_SNAPSHOT_VERSION,
    jobId: null,
    jobStatus: input.runtime.runtimeState === "idle" ? "idle" : "running",
    currentCodeTaskId: codeTaskId,
    currentRuntimeState: input.runtime.runtimeState,
    activeDispatch: dispatch,
    runs: codeTaskId
      ? [
          {
            codeTaskId,
            runtimeState: input.runtime.runtimeState,
            cursorAgentId: input.runtime.cursorRunId ?? null,
            lastHeartbeatAt: input.runtime.lastStateChangeAt ?? input.runtime.updatedAt,
            updatedAt: input.runtime.updatedAt,
          },
        ]
      : [],
    updatedAt: input.runtime.updatedAt,
  };
}

/** legacy implementationRuntimeStateV1 → UI snapshot (read migration) */
export function legacyRuntimeStateToUiSnapshot(
  runtime: ImplementationRuntimeStateV1,
): ImplementationRuntimeUiSnapshotV1 {
  return buildImplementationRuntimeUiSnapshotFromRuntimeState({ runtime });
}

export function synthesizeRuntimeStateFromUiSnapshot(
  snapshot: ImplementationRuntimeUiSnapshotV1,
  projectId: string,
): ImplementationRuntimeStateV1 {
  const githubState: RuntimeGithubState =
    snapshot.currentRuntimeState === "github_verifying"
      ? "pending"
      : snapshot.runs.some((r) => r.runtimeState === "completed")
        ? "verified"
        : "none";
  return {
    version: IMPLEMENTATION_RUNTIME_STATE_VERSION,
    projectId,
    runtimeState: snapshot.currentRuntimeState,
    githubState,
    updatedAt: snapshot.updatedAt,
    lastStateChangeAt: snapshot.updatedAt,
    ...(snapshot.currentCodeTaskId ? { activeCodeTaskId: snapshot.currentCodeTaskId } : {}),
    ...(snapshot.activeDispatch ? { activeDispatch: snapshot.activeDispatch } : {}),
  };
}

export function resolveImplementationRuntimeStateForRead(input: {
  readonly raw: Record<string, unknown>;
  readonly projectId: string;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): ImplementationRuntimeStateV1 | null {
  if (input.dbBundle?.currentRun || input.dbBundle?.job) {
    const snapshot = buildImplementationRuntimeUiSnapshotFromBundle(input.dbBundle, {
      activeDispatch:
        parseImplementationRuntimeUiSnapshotV1(input.raw.implementationRuntimeUiSnapshotV1)
          ?.activeDispatch ?? null,
    });
    return synthesizeRuntimeStateFromUiSnapshot(snapshot, input.projectId);
  }
  const snapshot = parseImplementationRuntimeUiSnapshotV1(input.raw.implementationRuntimeUiSnapshotV1);
  if (snapshot) {
    return synthesizeRuntimeStateFromUiSnapshot(snapshot, input.projectId);
  }
  const legacy = input.raw.implementationRuntimeStateV1;
  if (legacy) {
    const parsed =
      typeof legacy === "object"
        ? (legacy as ImplementationRuntimeStateV1)
        : null;
    if (parsed?.projectId) return parsed;
  }
  return null;
}

export function stripLegacyImplementationRuntimeStateFromRecord(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const { implementationRuntimeStateV1: _removed, ...rest } = state;
  return rest;
}

export function formatUiSnapshotRuntimeLabel(
  snapshot: ImplementationRuntimeUiSnapshotV1 | null | undefined,
): string | null {
  if (!snapshot) return null;
  return formatRuntimeStateKo(snapshot.currentRuntimeState);
}
