export type {
  RuntimeState,
  RuntimeGithubState,
} from "@/lib/prototype/implementationRuntimeState";

export {
  RUNTIME_IN_FLIGHT_STATES,
  IMPLEMENTATION_RUNTIME_STALE_MINUTES,
  IMPLEMENTATION_RUNTIME_WATCHDOG_STALL_MINUTES,
  isRuntimeInFlight,
  formatRuntimeStateKo,
} from "@/lib/prototype/implementationRuntimeState";

export type ImplementationJobStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_issues"
  | "failed";

export type ImplementationRuntimeEventType =
  | "job_created"
  | "job_paused"
  | "job_completed"
  | "run_created"
  | "run_transition"
  | "run_heartbeat"
  | "run_stale"
  | "run_failed"
  | "recovery_orphan_queued"
  | "recovery_orphan_dispatching"
  | "recovery_stale"
  | "recovery_force_release"
  | "watchdog_poll"
  | "cursor_dispatched"
  | "cursor_completed"
  | "github_verified";

export type ImplementationRuntimeJobView = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly status: ImplementationJobStatus;
  readonly currentCodeTaskId: string | null;
  readonly selectedCodeTaskIds: readonly string[];
  readonly failureReason: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly updatedAt: string;
}>;

export type ImplementationRuntimeRunView = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly jobId: string;
  readonly codeTaskId: string;
  readonly runtimeState: import("@/lib/prototype/implementationRuntimeState").RuntimeState;
  readonly cursorAgentId: string | null;
  readonly branchName: string | null;
  readonly commitSha: string | null;
  readonly pullRequestUrl: string | null;
  readonly failureReason: string | null;
  readonly lastHeartbeatAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly updatedAt: string;
  readonly taskCursorJobId?: string | null;
  readonly nextPollAt?: string | null;
  readonly pollCount?: number;
  readonly lastPollAt?: string | null;
}>;

export type ImplementationRuntimeBundleView = Readonly<{
  readonly job: ImplementationRuntimeJobView | null;
  readonly runs: readonly ImplementationRuntimeRunView[];
  readonly currentRun: ImplementationRuntimeRunView | null;
}>;
