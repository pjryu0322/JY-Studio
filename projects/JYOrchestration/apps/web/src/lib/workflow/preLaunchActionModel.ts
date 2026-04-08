import type { LaunchReadinessResult } from "@/lib/workflow/preExecutionValidation";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import type { ActiveExecutionInputSelection } from "@/lib/workflow/preExecutionStateStore";

export type PreLaunchActionAvailability = {
  canPrepareLaunchAction: boolean;
  actionLabel: string;
  actionReason?: string;
};

export function getPreLaunchActionAvailability(input: {
  active: ActiveExecutionInputSelection | null;
  snapshot: ExecutionLaunchSnapshot | undefined;
  launchReadiness: LaunchReadinessResult;
}): PreLaunchActionAvailability {
  if (!input.active) {
    return {
      canPrepareLaunchAction: false,
      actionLabel: "Select an active input",
      actionReason: "No active prepared input selected.",
    };
  }

  if (!input.snapshot) {
    return {
      canPrepareLaunchAction: false,
      actionLabel: "Prepare snapshot in Tasks",
      actionReason: "Prepared snapshot is missing for this session.",
    };
  }

  if (!input.launchReadiness.isLaunchReady) {
    const primaryReason = input.launchReadiness.reasons[0] ?? "Active input is not launch-ready.";
    return {
      canPrepareLaunchAction: false,
      actionLabel: "Fix readiness issues",
      actionReason: primaryReason,
    };
  }

  return {
    canPrepareLaunchAction: true,
    actionLabel: "Prepare launch handoff",
    actionReason: "Active prepared input is launch-ready.",
  };
}

