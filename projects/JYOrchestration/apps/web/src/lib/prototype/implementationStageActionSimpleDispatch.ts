import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import {
  buildImplementationStageActionFocusComposerResult,
  buildImplementationStageActionOpenEnvSettingsResult,
  buildImplementationStageActionShowStatusResult,
  type ImplementationStageActionExecutionResult,
  type ImplementationStageActionRunResult,
} from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationIntegratedStep } from "@/lib/prototype/implementationIntegratedExecutionState";

export type ImplementationStageActionSimpleDispatchDeps = Readonly<{
  readonly projectId: string;
  readonly generateImplementationTaskList: () => ImplementationStageActionRunResult;
  readonly confirmQuickDesignForImplementation: () => ImplementationStageActionRunResult;
  readonly createImplementationSeedFromQuickDesignDraft: () => ImplementationStageActionRunResult;
  readonly startImplementationQuickRun: () => void;
  readonly loadImplementationRuntimeDb: (input: { readonly recover: boolean }) => void;
  readonly generateImplementationWorkPlanDraft: () => ImplementationStageActionRunResult;
  readonly confirmImplementationTaskPlan: () => ImplementationStageActionRunResult;
  readonly reviewDbIntegrationNeed: () => ImplementationStageActionRunResult;
  readonly generateDataModelDraft: () => ImplementationStageActionRunResult;
  readonly confirmMockImplementationMode: () => ImplementationStageActionRunResult;
  readonly applyImplementationStageActionExecutionResult: (
    result: ImplementationStageActionExecutionResult,
  ) => void;
  readonly refreshExecutionEnvironmentStatus: () => Promise<unknown>;
  readonly runImplementationQualityGate: (
    gate: "reviewer" | "security",
  ) => ImplementationStageActionRunResult;
  readonly runIntegratedStageStep: (step: ImplementationIntegratedStep) => ImplementationStageActionRunResult;
  readonly runFinalScmIntegratedStageStep: () => ImplementationStageActionRunResult;
  readonly runPlatformScmMergeStep: () => ImplementationStageActionRunResult;
}>;

const EDIT_IMPLEMENTATION_SCOPE_NOTICE =
  "구현 범위·요구사항 수정은 기획(/requirements) 대화 또는 보드에서 선택한 작업 기준으로 진행해 주세요.";

export function dispatchSimpleImplementationStageAction(
  actionId: ImplementationStageActionId,
  deps: ImplementationStageActionSimpleDispatchDeps,
): ImplementationStageActionRunResult | null {
  switch (actionId) {
    case "GENERATE_IMPLEMENTATION_TASK_LIST":
      return deps.generateImplementationTaskList();
    case "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION":
      return deps.confirmQuickDesignForImplementation();
    case "CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT":
      return deps.createImplementationSeedFromQuickDesignDraft();
    case "START_IMPLEMENTATION_QUICK_RUN":
      deps.startImplementationQuickRun();
      return { outcome: "executed" };
    case "REDISPATCH_IMPLEMENTATION_RUNTIME": {
      const message =
        "재디스패치는 비활성화되었습니다. 선택 CodeTask 실행으로 DB Queue를 다시 시작하세요.";
      return { outcome: "blocked", message };
    }
    case "SHOW_IMPLEMENTATION_RUNTIME_DIAGNOSTICS": {
      deps.loadImplementationRuntimeDb({ recover: false });
      return { outcome: "executed" };
    }
    case "RELEASE_IMPLEMENTATION_EXECUTION_LOCK": {
      const message =
        "실행 잠금 해제는 비활성화되었습니다. 필요 시 선택 CodeTask 실행을 다시 시작하세요.";
      return { outcome: "blocked", message };
    }
    case "RETURN_TO_PLANNING_STAGE":
    case "START_QUICK_DESIGN_FROM_IMPLEMENTATION": {
      const pid = deps.projectId.trim();
      if (pid) {
        window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
      }
      return { outcome: "executed" };
    }
    case "GENERATE_IMPLEMENTATION_WORK_PLAN":
      return deps.generateImplementationWorkPlanDraft();
    case "CONFIRM_IMPLEMENTATION_WORK_PLAN":
      return deps.confirmImplementationTaskPlan();
    case "EDIT_IMPLEMENTATION_SCOPE":
      deps.applyImplementationStageActionExecutionResult(
        buildImplementationStageActionFocusComposerResult(EDIT_IMPLEMENTATION_SCOPE_NOTICE),
      );
      return { outcome: "executed" };
    case "REVIEW_DB_INTEGRATION":
      return deps.reviewDbIntegrationNeed();
    case "GENERATE_DATA_MODEL_DRAFT":
      return deps.generateDataModelDraft();
    case "CONFIRM_MOCK_IMPLEMENTATION":
      return deps.confirmMockImplementationMode();
    case "SHOW_ARTIFACTS": {
      const message =
        "구현 산출물 Hub는 제공되지 않습니다. 기획(/requirements) 화면에서 산출물을 확인해 주세요.";
      return { outcome: "blocked", message };
    }
    case "OPEN_ENV_SETTINGS":
      deps.applyImplementationStageActionExecutionResult(
        buildImplementationStageActionOpenEnvSettingsResult(),
      );
      return { outcome: "executed" };
    case "SHOW_ROLE_CHECK":
      deps.applyImplementationStageActionExecutionResult(
        buildImplementationStageActionShowStatusResult("role"),
      );
      return { outcome: "executed" };
    case "SHOW_SCM_CHECK":
      deps.applyImplementationStageActionExecutionResult(
        buildImplementationStageActionShowStatusResult("scm"),
      );
      return { outcome: "executed" };
    case "SHOW_ENV_CHECK":
      void deps.refreshExecutionEnvironmentStatus().then(() => {
        deps.applyImplementationStageActionExecutionResult(
          buildImplementationStageActionShowStatusResult("env"),
        );
      });
      return { outcome: "executed" };
    case "RUN_REVIEWER_CHECK":
      return deps.runImplementationQualityGate("reviewer");
    case "RUN_SECURITY_CHECK":
      return deps.runImplementationQualityGate("security");
    case "RUN_REFACTOR_COMMON":
      return deps.runIntegratedStageStep("refactor_common");
    case "RUN_INTEGRATED_REVIEW":
      return deps.runIntegratedStageStep("integrated_review");
    case "RUN_INTEGRATED_SECURITY":
      return deps.runIntegratedStageStep("integrated_security");
    case "RUN_FINAL_SCM":
      return deps.runFinalScmIntegratedStageStep();
    case "RUN_PLATFORM_SCM_MERGE":
      return deps.runPlatformScmMergeStep();
    default:
      return null;
  }
}
