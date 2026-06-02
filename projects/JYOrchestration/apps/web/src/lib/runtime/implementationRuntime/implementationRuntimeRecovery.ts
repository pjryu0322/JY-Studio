import {
  createImplementationCodeTaskRun,
  findActiveImplementationRuntimeJob,
  getImplementationRuntimeBundle,
  pauseImplementationRuntimeJob,
  recordImplementationRuntimeEvent,
  transitionImplementationCodeTaskRun,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  applyImplementationRuntimeWatchdogActions,
  evaluateImplementationRuntimeWatchdog,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeWatchdog";
import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export type DbRuntimeRecoveryResult = Readonly<{
  readonly issues: readonly string[];
  readonly shouldRedispatch: boolean;
  readonly shouldWatchdogPoll: boolean;
  readonly redispatchCodeTaskId: string | null;
  readonly userMessage: string | null;
}>;

export async function recoverImplementationRuntimeDb(input: {
  readonly projectId: string;
  readonly forceRelease?: boolean;
  readonly now?: Date;
}): Promise<DbRuntimeRecoveryResult> {
  const pid = input.projectId.trim();
  const now = input.now ?? new Date();

  if (input.forceRelease) {
    const active = await findActiveImplementationRuntimeJob(pid);
    if (active) {
      for (const run of active.runs) {
        if (
          run.runtimeState === "queued" ||
          run.runtimeState === "dispatching" ||
          run.runtimeState === "cursor_running" ||
          run.runtimeState === "github_verifying"
        ) {
          await transitionImplementationCodeTaskRun({
            runId: run.id,
            toState: "stale",
            patch: { failureReason: "admin_force_release" },
            now,
          });
        }
      }
      await pauseImplementationRuntimeJob({
        jobId: active.id,
        failureReason: "admin_force_release",
        now,
      });
      await recordImplementationRuntimeEvent({
        projectId: pid,
        jobId: active.id,
        eventType: "recovery_force_release",
      });
    }
    return {
      issues: ["force_release"],
      shouldRedispatch: false,
      shouldWatchdogPoll: false,
      redispatchCodeTaskId: null,
      userMessage: "실행 잠금을 해제했습니다. 환경을 확인한 뒤 다시 실행해 주세요.",
    };
  }

  const bundle = await getImplementationRuntimeBundle(pid);
  const issues: string[] = [];
  let shouldRedispatch = false;
  let shouldWatchdogPoll = false;
  let userMessage: string | null = null;

  const current = bundle.currentRun;
  if (!bundle.job) {
    return {
      issues: [],
      shouldRedispatch: false,
      shouldWatchdogPoll: false,
      redispatchCodeTaskId: null,
      userMessage: null,
    };
  }

  if (!current) {
    issues.push("orphan_queued");
    shouldRedispatch = true;
    return {
      issues,
      shouldRedispatch,
      shouldWatchdogPoll: false,
      redispatchCodeTaskId: bundle.job.currentCodeTaskId,
      userMessage: null,
    };
  }

  if (current.runtimeState === "queued" && !current.cursorAgentId) {
    issues.push("orphan_queued");
    shouldRedispatch = true;
    return {
      issues,
      shouldRedispatch,
      shouldWatchdogPoll: false,
      redispatchCodeTaskId: current.codeTaskId,
      userMessage: null,
    };
  }

  const watchdog = evaluateImplementationRuntimeWatchdog({
    run: current,
    nowIso: now.toISOString(),
  });
  issues.push(...watchdog.issues);
  shouldWatchdogPoll = watchdog.shouldPoll;

  const nextState = await applyImplementationRuntimeWatchdogActions({
    run: current,
    plan: watchdog,
    now,
  });
  if (nextState === "stale") {
    userMessage =
      "30분 이상 진행이 없어 실행을 만료(STALE) 처리했습니다. [선택한 CodeTask 실행]으로 다시 시도해 주세요.";
  }

  return {
    issues,
    shouldRedispatch,
    shouldWatchdogPoll,
    redispatchCodeTaskId: null,
    userMessage,
  };
}

export async function ensureQueuedRunForRedispatch(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly codeTaskId: string;
}): Promise<ImplementationRuntimeRunView> {
  const bundle = await getImplementationRuntimeBundle(input.projectId);
  const existing = bundle.runs.find(
    (r) => r.codeTaskId === input.codeTaskId.trim() && r.runtimeState === "queued",
  );
  if (existing) return existing;
  return createImplementationCodeTaskRun({
    projectId: input.projectId,
    jobId: input.jobId,
    codeTaskId: input.codeTaskId,
  });
}
