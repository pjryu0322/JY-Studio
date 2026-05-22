import { describe, expect, it } from "vitest";
import { dedupeRuntimeTimelineRows } from "@/lib/runtime/runtimeTimelineDedupe";
import type { RuntimeTimelineRow } from "@/lib/runtime/runtimeObservability";

describe("dedupeRuntimeTimelineRows", () => {
  it("collapses memory + DB duplicate rows", () => {
    const detail = { execRunId: "run-1", eventType: "CURSOR_STARTED", runtimeTimeline: true };
    const row: RuntimeTimelineRow = {
      createdAt: "2026-05-19T10:00:00.000Z",
      source: "runtime_event",
      eventType: "CURSOR_STARTED",
      workerName: "cursor",
      detail,
    };
    const dup: RuntimeTimelineRow = { ...row, source: "execution_event" };
    const out = dedupeRuntimeTimelineRows([row, dup]);
    expect(out).toHaveLength(1);
  });

  it("keeps distinct events", () => {
    const a: RuntimeTimelineRow = {
      createdAt: "2026-05-19T10:00:00.000Z",
      source: "runtime_event",
      eventType: "CURSOR_STARTED",
      workerName: "cursor",
    };
    const b: RuntimeTimelineRow = {
      createdAt: "2026-05-19T10:01:00.000Z",
      source: "runtime_event",
      eventType: "CURSOR_COMPLETED",
      workerName: "cursor",
    };
    expect(dedupeRuntimeTimelineRows([a, b])).toHaveLength(2);
  });
});
