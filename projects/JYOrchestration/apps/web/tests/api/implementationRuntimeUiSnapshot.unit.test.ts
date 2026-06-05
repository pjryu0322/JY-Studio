import { describe, expect, it } from "vitest";
import {
  buildImplementationRuntimeUiSnapshotFromRuntimeState,
  legacyRuntimeStateToUiSnapshot,
  parseImplementationRuntimeUiSnapshotV1,
  stripLegacyImplementationRuntimeStateFromRecord,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";
import { IMPLEMENTATION_RUNTIME_STATE_VERSION } from "@/lib/prototype/implementationRuntimeState";

describe("implementationRuntimeUiSnapshot", () => {
  it("parses ui snapshot v1", () => {
    const parsed = parseImplementationRuntimeUiSnapshotV1({
      version: "implementation_runtime_ui_snapshot_v1",
      jobId: "job-1",
      jobStatus: "running",
      currentCodeTaskId: "ct-1",
      currentRuntimeState: "cursor_running",
      activeDispatch: {
        codeTaskId: "ct-1",
        parentTaskId: "t-1",
        workItemId: "wi-1",
      },
      runs: [
        {
          codeTaskId: "ct-1",
          runtimeState: "cursor_running",
          cursorAgentId: "agent-1",
          lastHeartbeatAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(parsed?.currentRuntimeState).toBe("cursor_running");
    expect(parsed?.activeDispatch?.codeTaskId).toBe("ct-1");
  });

  it("migrates legacy runtime to snapshot", () => {
    const snapshot = legacyRuntimeStateToUiSnapshot({
      version: IMPLEMENTATION_RUNTIME_STATE_VERSION,
      projectId: "p1",
      runtimeState: "queued",
      githubState: "none",
      updatedAt: "2026-06-01T00:00:00.000Z",
      activeDispatch: {
        codeTaskId: "ct-1",
        parentTaskId: "t-1",
        workItemId: "wi-1",
      },
    });
    expect(snapshot.currentRuntimeState).toBe("queued");
    expect(snapshot.activeDispatch?.codeTaskId).toBe("ct-1");
  });

  it("strips legacy runtime field from persisted record", () => {
    const next = stripLegacyImplementationRuntimeStateFromRecord({
      implementationRuntimeStateV1: { runtimeState: "queued" },
      implementationRuntimeUiSnapshotV1: buildImplementationRuntimeUiSnapshotFromRuntimeState({
        runtime: {
          version: IMPLEMENTATION_RUNTIME_STATE_VERSION,
          projectId: "p1",
          runtimeState: "idle",
          githubState: "none",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      }),
    });
    expect(next.implementationRuntimeStateV1).toBeUndefined();
    expect(next.implementationRuntimeUiSnapshotV1).toBeDefined();
  });
});
