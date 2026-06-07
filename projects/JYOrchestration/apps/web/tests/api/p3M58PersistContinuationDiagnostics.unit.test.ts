import { describe, expect, it } from "vitest";
import { startCodeTaskExecutionQueue } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  resolveSelectedCodeTaskIdsForContinuationContext,
} from "@/lib/prototype/implementationSelectedCodeTaskSequence";
import {
  buildQuickRunContinuationPatchPersistedTimelineEntry,
  buildQuickRunQueuedFallbackTimelineFromServerResult,
} from "@/lib/prototype/quickRunVerifiedContinuationTimeline";
import { deriveCodeTaskRunPhase } from "@/lib/prototype/codeTaskRunDerivedView";
import { formatCodeTaskExecutionFlowPhaseKo } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

describe("P3-M58 persist continuation diagnostics", () => {
  it("resolveSelectedCodeTaskIdsForContinuationContext falls back to code task queue when job empty", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-A", "CODE-B"],
    });
    const resolved = resolveSelectedCodeTaskIdsForContinuationContext({
      dbBundle: null,
      codeTaskExecutionQueueV1: queue,
    });
    expect(resolved.selectedCodeTaskIds).toEqual(["CODE-A", "CODE-B"]);
    expect(resolved.source).toBe("code_task_queue");
  });

  it("reconciles job selection with runtime queue when job is shorter", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
    });
    const resolved = resolveSelectedCodeTaskIdsForContinuationContext({
      dbBundle: {
        job: {
          id: "j1",
          projectId: "p1",
          status: "running",
          currentCodeTaskId: "CODE-A",
          selectedCodeTaskIds: ["CODE-A"],
          failureReason: null,
          startedAt: null,
          completedAt: null,
          updatedAt: "2026-06-04T00:00:00.000Z",
        },
        currentRun: null,
        runs: [],
      },
      codeTaskExecutionQueueV1: queue,
    });
    expect(resolved.source).toBe("reconciled");
    expect(resolved.selectedCodeTaskIds).toEqual(["CODE-A", "CODE-B", "CODE-C"]);
  });

  it("buildQuickRunContinuationPatchPersistedTimelineEntry records persist action", () => {
    const entry = buildQuickRunContinuationPatchPersistedTimelineEntry({
      projectId: "p1",
      hasNextDispatch: false,
    });
    expect(entry.action).toBe("quick_run_continuation_patch_persisted");
  });

  it("buildQuickRunQueuedFallbackTimelineFromServerResult maps dispatched outcome", () => {
    const entries = buildQuickRunQueuedFallbackTimelineFromServerResult({
      projectId: "p1",
      reason: "verified_without_next_dispatch",
      serverResult: {
        ok: true,
        outcome: "dispatched",
        nextCodeTaskId: "CODE-B",
        timelineEntries: [],
      },
    });
    expect(entries[0]?.action).toBe("quick_run_queued_fallback_dispatch_dispatched");
  });

  it("deriveCodeTaskRunPhase shows dispatch pending for queued db run", () => {
    const run: CodeTaskExecutionRunV1 = {
      runId: "r1",
      projectId: "p1",
      processTaskId: "DEV-1",
      workItemId: "wi",
      codeTaskId: "CODE-B",
      status: "queued",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    };
    const phase = deriveCodeTaskRunPhase({
      run,
      dbRun: { runtimeState: "queued" },
    });
    expect(formatCodeTaskExecutionFlowPhaseKo(phase)).toBe("다음 CodeTask 실행 준비 중");
  });
});
