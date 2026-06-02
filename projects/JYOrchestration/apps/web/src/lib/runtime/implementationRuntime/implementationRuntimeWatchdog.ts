import {
  IMPLEMENTATION_RUNTIME_STALE_MINUTES,
  IMPLEMENTATION_RUNTIME_WATCHDOG_STALL_MINUTES,
  isRuntimeInFlight,
  type RuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import {
  recordImplementationRuntimeEvent,
  touchImplementationCodeTaskRunHeartbeat,
  transitionImplementationCodeTaskRun,
  type ImplementationRuntimeRunView,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { isWithinImplementationRuntimeLaunchGrace } from "@/lib/runtime/implementationRuntime/implementationRuntimeLaunchGrace";
import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";

function minutesSince(iso: string | null | undefined, nowMs: number): number | null {
  const raw = String(iso ?? "").trim();
  if (!raw) return null;
  const ms = nowMs - Date.parse(raw);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60_000);
}

export type ImplementationRuntimeWatchdogResult = Readonly<{
  readonly shouldPoll: boolean;
  readonly markStale: boolean;
  readonly markFailed: boolean;
  readonly issues: readonly string[];
}>;

export function evaluateImplementationRuntimeWatchdog(input: {
  readonly run: ImplementationRuntimeRunView | null;
  readonly cursorAgentId?: string | null;
  readonly nowIso?: string;
}): ImplementationRuntimeWatchdogResult {
  const nowMs = Date.parse(input.nowIso ?? new Date().toISOString());
  const run = input.run;
  if (!run || !isRuntimeInFlight(run.runtimeState)) {
    return { shouldPoll: false, markStale: false, markFailed: false, issues: [] };
  }

  const issues: string[] = [];
  const anchor = run.lastHeartbeatAt ?? run.updatedAt ?? run.startedAt;
  const stallMinutes = minutesSince(anchor, nowMs);
  const launchGrace =
    isServerTaskCursorPolling() &&
    (run.pollCount ?? 0) === 0 &&
    isWithinImplementationRuntimeLaunchGrace({
      anchorIso: run.startedAt ?? run.updatedAt,
      nowMs,
    });

  if (run.runtimeState === "dispatching" && !String(input.cursorAgentId ?? run.cursorAgentId ?? "").trim()) {
    if (launchGrace) {
      return { shouldPoll: true, markStale: false, markFailed: false, issues: ["launch_grace"] };
    }
    if (stallMinutes != null && stallMinutes >= IMPLEMENTATION_RUNTIME_WATCHDOG_STALL_MINUTES) {
      issues.push("orphan_dispatching");
      return { shouldPoll: false, markStale: false, markFailed: true, issues };
    }
  }

  if (run.runtimeState === "cursor_running") {
    if (launchGrace && !run.cursorAgentId) {
      return { shouldPoll: true, markStale: false, markFailed: false, issues: ["launch_grace"] };
    }
    if (stallMinutes != null && stallMinutes >= IMPLEMENTATION_RUNTIME_WATCHDOG_STALL_MINUTES) {
      issues.push("watchdog_poll");
      if (stallMinutes >= IMPLEMENTATION_RUNTIME_STALE_MINUTES) {
        issues.push("orphan_cursor_running");
        return { shouldPoll: true, markStale: true, markFailed: false, issues };
      }
      return { shouldPoll: true, markStale: false, markFailed: false, issues };
    }
  }

  if (
    stallMinutes != null &&
    stallMinutes >= IMPLEMENTATION_RUNTIME_STALE_MINUTES &&
    (run.runtimeState === "dispatching" || run.runtimeState === "github_verifying")
  ) {
    issues.push("stale_timeout");
    return { shouldPoll: false, markStale: true, markFailed: false, issues };
  }

  return { shouldPoll: false, markStale: false, markFailed: false, issues };
}

export async function applyImplementationRuntimeWatchdogActions(input: {
  readonly run: ImplementationRuntimeRunView;
  readonly plan: ImplementationRuntimeWatchdogResult;
  readonly now?: Date;
}): Promise<RuntimeState | null> {
  const now = input.now ?? new Date();
  if (input.plan.markFailed) {
    await transitionImplementationCodeTaskRun({
      runId: input.run.id,
      toState: "failed",
      patch: {
        failureReason: "dispatch_timeout",
      },
      now,
    });
    await recordImplementationRuntimeEvent({
      projectId: input.run.projectId,
      jobId: input.run.jobId,
      runId: input.run.id,
      eventType: "recovery_orphan_dispatching",
    });
    return "failed";
  }
  if (input.plan.markStale) {
    await transitionImplementationCodeTaskRun({
      runId: input.run.id,
      toState: "stale",
      patch: { failureReason: "execution_stale" },
      now,
    });
    await recordImplementationRuntimeEvent({
      projectId: input.run.projectId,
      jobId: input.run.jobId,
      runId: input.run.id,
      eventType: "recovery_stale",
    });
    return "stale";
  }
  if (input.plan.shouldPoll) {
    await touchImplementationCodeTaskRunHeartbeat({
      runId: input.run.id,
      now,
    });
    await recordImplementationRuntimeEvent({
      projectId: input.run.projectId,
      jobId: input.run.jobId,
      runId: input.run.id,
      eventType: "watchdog_poll",
    });
  }
  return null;
}
