import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("implementation parent hook complexity guard", () => {
  const previewDir = join(__dirname, "../../src/components/preview");

  it("keeps implementation parent hook as controller composition shell", () => {
    const parent = readFileSync(
      join(previewDir, "usePrototypeImplementationStagePanel.tsx"),
      "utf8",
    );

    const requiredControllers = [
      "useImplementationRuntimeSyncController",
      "useImplementationDerivedViewModelController",
      "useImplementationNoticeModalController",
      "useImplementationEntryRecoveryController",
      "useImplementationQuickRunController",
      "useImplementationGithubVerifyController",
      "useImplementationIntegrationPipelineController",
      "useImplementationStageActionAdapterController",
      "useImplementationWipChipHandlerController",
      "useImplementationBoardInteractionController",
      "useImplementationChipHandlerController",
      "useImplementationPreviewController",
      "useImplementationFinalScmController",
      "useImplementationQualityIntegratedStageController",
      "useImplementationDeveloperPromptCopyController",
      "useImplementationExecutionLogController",
      "useImplementationAutoPrepSyncController",
      "useImplementationStatusNoticeController",
      "useImplementationPlanningActionController",
      "useImplementationDbStrategyActionController",
      "useImplementationBoardRefreshController",
      "useImplementationToolbarController",
      "useImplementationRuntimeRecoveryController",
      "useImplementationDeliverableViewerController",
    ];

    for (const controller of requiredControllers) {
      expect(parent).toContain(controller);
    }
  });

  it("does not reintroduce heavyweight implementation action bodies into parent hook", () => {
    const parent = readFileSync(
      join(previewDir, "usePrototypeImplementationStagePanel.tsx"),
      "utf8",
    );

    const forbiddenSnippets = [
      "buildWipChipHandlerSlice({",
      "const legacyDispatch = useImplementationStageActionLegacyDispatchBundle",
      "useImplementationStageActionController({",
      "useImplementationStageActionOrchestrator({",
      "executeImplementationQualityGateCheck({",
      "integrateCompletedCodeTasksForPreview({",
      "resolveCodeTaskDeveloperPromptForCopy({",
      "resolveDeveloperPromptCopyFromSelection({",
      "stripExecutionLogTimelineEntries(current)",
      "postImplementationPrepSync(pid,",
      "buildDbIntegrationReviewResult({",
      "buildDataModelDraftResult({",
      "buildMockImplementationModeResult({",
      "buildImplementationBoardRefreshSyncKey({",
      "window.setInterval(tick, 10_000)",
      "/api/prototype/implementation-runtime/retry-failed-task",
      "const [implementationStageNoticeModal, setImplementationStageNoticeModal] = useState",
      "const appendAiNoticeForImplementation = useCallback",
      "const appendUserNotice = useCallback",
      "const appendImplementationExecutionNotice = useCallback",
      "buildImplementationEntryCursorWorkItemsRecovery({",
      "buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry({",
      "const implementationBootstrapInput = useMemo",
      "const implementationStageBoardInput = useMemo",
      "const implementationBootstrapShell = useMemo",
      "const implementationVisibleActionLabels = useMemo",
      "const implementationStageBoardGateContext = useMemo",
      "const effectiveImplementationState = useMemo",
      "useImplementationRuntimeDbSync(",
      "useDbQueuedQuickRunAutoDispatch(",
      "useRecoverServerQuickRunContinuation(",
      "useTaskCursorServerJobPoll(",
      "useImplementationAutoQualityGateTrigger(",
    ];

    for (const snippet of forbiddenSnippets) {
      expect(parent).not.toContain(snippet);
    }
  });

  it("documents parent hook composition policy", () => {
    const parent = readFileSync(
      join(previewDir, "usePrototypeImplementationStagePanel.tsx"),
      "utf8",
    );

    expect(parent).toContain(
      "Implementation stage parent hook is intentionally kept as a controller-composition shell.",
    );
    expect(parent).toContain(
      "Heavyweight business logic must live in named useImplementation*Controller hooks.",
    );
  });
});
