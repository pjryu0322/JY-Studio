import type { ImplementationIntegrationStepKindV1 } from "@/lib/prototype/implementationIntegrationStep";

export type ImplementationRuntimeUnitDisplayStatusV1 =
  | "pending"
  | "running"
  | "verifying"
  | "verified"
  | "failed"
  | "skipped"
  | "verification_inconsistent";

export type ImplementationRuntimeSnapshotV1 = Readonly<{
  readonly projectId: string;

  readonly codeTask: Readonly<{
    readonly total: number;
    readonly selected: number;
    readonly completed: number;
    readonly running: number;
    readonly verifying: number;
    readonly failed: number;
    readonly skipped: number;
    readonly pending: number;
    readonly inconsistent: number;
    readonly currentUnitId: string | null;
    readonly currentCodeTaskId: string | null;
    readonly selectedUnitIds: readonly string[];
    readonly pendingCodeTaskIds: readonly string[];
    readonly inconsistentCodeTaskIds: readonly string[];
  }>;

  readonly units: readonly Readonly<{
    readonly unitId: string;
    readonly codeTaskId: string;
    readonly processTaskId: string;
    readonly title: string;
    readonly order: number;
    readonly branchGroup: string;
    readonly baseBranch: string;
    readonly workBranch: string;
    readonly rawStatus: string;
    readonly displayStatus: ImplementationRuntimeUnitDisplayStatusV1;
    readonly hasPersistedGithubOutcome: boolean;
    readonly latestRunId: string | null;
    readonly latestCommitSha: string | null;
    readonly statusLabel: string;
    readonly progressLabel: string;
    readonly userSafeFailureTitle: string | null;
    readonly userSafeFailureMessage: string | null;
    readonly userActionLabel: string | null;
    readonly retryable: boolean;
  }>[];

  readonly integration: Readonly<{
    readonly steps: readonly Readonly<{
      readonly stepId: string;
      readonly kind: ImplementationIntegrationStepKindV1;
      readonly title: string;
      readonly status: "pending" | "ready" | "running" | "completed" | "failed" | "skipped";
      readonly statusLabel: string;
    }>[];
    readonly finalWiringStatus: string;
    readonly integrationBranchStatus: string;
    readonly buildStatus: string;
    readonly appPreviewTargetStatus: string;
    readonly canRunIntegration: boolean;
    readonly canOpenCodeTaskPreview: boolean;
    readonly canOpenIntegratedAppPreview: boolean;
    readonly disabledReason: string | null;
    readonly nextRequiredStep:
      | "codetask_completion"
      | "final_wiring"
      | "integration_branch"
      | "build"
      | "app_preview_target"
      | null;
  }>;

  readonly preview: Readonly<{
    readonly codeTaskPreviewReady: boolean;
    readonly integratedAppPreviewReady: boolean;
    readonly previewUrl: string | null;
    readonly readinessStatus:
      | "code_task_preview_ready"
      | "codetask_completion_pending"
      | "final_wiring_pending"
      | "integration_branch_pending"
      | "build_pending"
      | "app_preview_target_pending"
      | "integrated_app_preview_ready"
      | "integration_blocked";
    readonly message: string;
  }>;

  readonly diagnostics: Readonly<{
    readonly source: "implementation_runtime_snapshot";
    readonly usedExecutionUnitCount: number;
    readonly usedRunCount: number;
    readonly usedIntegrationStepCount: number;
    readonly ignoredCodeTaskPlanCount: number | null;
    readonly ignoredBranchPlanIntegrationCount: number | null;
    readonly warnings: readonly string[];
  }>;
}>;

export type ImplementationRuntimeSnapshotApiSummaryV1 = Readonly<{
  readonly codeTask: Readonly<{
    readonly total: number;
    readonly selected: number;
    readonly completed: number;
    readonly inconsistent: number;
  }>;
  readonly integration: Readonly<{
    readonly canRunIntegration: boolean;
    readonly nextRequiredStep: ImplementationRuntimeSnapshotV1["integration"]["nextRequiredStep"];
  }>;
  readonly preview: Readonly<{
    readonly integratedAppPreviewReady: boolean;
  }>;
}>;

export function toImplementationRuntimeSnapshotApiSummary(
  snapshot: ImplementationRuntimeSnapshotV1,
): ImplementationRuntimeSnapshotApiSummaryV1 {
  return {
    codeTask: {
      total: snapshot.codeTask.total,
      selected: snapshot.codeTask.selected,
      completed: snapshot.codeTask.completed,
      inconsistent: snapshot.codeTask.inconsistent,
    },
    integration: {
      canRunIntegration: snapshot.integration.canRunIntegration,
      nextRequiredStep: snapshot.integration.nextRequiredStep,
    },
    preview: {
      integratedAppPreviewReady: snapshot.preview.integratedAppPreviewReady,
    },
  };
}
