import type { ImplementationPrimaryActionV1 } from "@/lib/prototype/implementationActionRoutingPolicy";
import type { ImplementationControlPlaneSnapshotV1 } from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";

export type ImplementationStageControlPlaneRoutedActionV1 =
  | ImplementationPrimaryActionV1
  | "execute_all_runnable_codetasks";

export function isImplementationStageControlPlaneRoutedAction(
  action: string,
): action is ImplementationStageControlPlaneRoutedActionV1 {
  return (
    action === "execute_selected_runnable_codetasks" ||
    action === "execute_all_runnable_codetasks" ||
    action === "prepare_integration_preview" ||
    action === "open_preview"
  );
}

export function resolveImplementationStageActionCodeTaskIds(input: {
  readonly implementationControlPlaneSnapshot: ImplementationControlPlaneSnapshotV1 | null;
  readonly selectedCodeTaskIdsFromOptions?: readonly string[] | null;
  readonly selectedRunnableFromBridge: readonly string[];
  readonly allRunnableFromSnapshot: readonly string[];
  readonly preferAllRunnable?: boolean;
}): readonly string[] {
  const fromSnapshot = input.implementationControlPlaneSnapshot?.action.codeTaskIds ?? [];
  if (fromSnapshot.length > 0) {
    return fromSnapshot;
  }
  const fromOptions = input.selectedCodeTaskIdsFromOptions ?? [];
  if (fromOptions.length > 0) {
    return fromOptions;
  }
  if (input.preferAllRunnable && input.allRunnableFromSnapshot.length > 0) {
    return input.allRunnableFromSnapshot;
  }
  if (input.selectedRunnableFromBridge.length > 0) {
    return input.selectedRunnableFromBridge;
  }
  return [];
}

export async function routeImplementationStageControlPlaneAction(input: {
  readonly action: ImplementationStageControlPlaneRoutedActionV1;
  readonly codeTaskIds: readonly string[];
  readonly startImplementationQuickRun: (options?: {
    readonly selectedCodeTaskIds?: readonly string[];
  }) => Promise<ImplementationStageActionRunResult>;
  readonly runIntegrationPipeline: () => void;
  readonly openPreview: () => void;
  readonly executeCodeTasks: (input: {
    readonly codeTaskIds: readonly string[];
    readonly source: string;
  }) => Promise<ImplementationStageActionRunResult>;
  readonly appendUserNotice: (message: string) => void;
}): Promise<ImplementationStageActionRunResult> {
  switch (input.action) {
    case "execute_selected_runnable_codetasks":
    case "execute_all_runnable_codetasks": {
      if (!input.codeTaskIds.length) {
        const message = "실행할 CodeTask를 선택해 주세요.";
        input.appendUserNotice(message);
        return { outcome: "blocked", message };
      }
      return input.executeCodeTasks({
        codeTaskIds: input.codeTaskIds,
        source: "stage_action_controller",
      });
    }
    case "prepare_integration_preview": {
      input.runIntegrationPipeline();
      return { outcome: "executed" };
    }
    case "open_preview": {
      input.openPreview();
      return { outcome: "executed" };
    }
    case "blocked_no_selection":
    case "blocked_no_available_action": {
      const message = "실행할 수 있는 작업이 없습니다.";
      return { outcome: "blocked", message };
    }
    default:
      return { outcome: "blocked", message: "지원하지 않는 control plane action입니다." };
  }
}
