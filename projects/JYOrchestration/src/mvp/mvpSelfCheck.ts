/**
 * Deterministic in-process checks for the isolated MVP stack (no routes, no DB).
 * Import and call `runMvpSelfCheck()` from tests or a one-off script under src/mvp only.
 */

import {
  mvpClearTaskStore,
  mvpSeedProjectTasks,
  listAllTasks,
  reorderTasks,
  confirmTask,
  type Task,
} from "./task/taskService";
import { buildTaskPrompt, clearPromptCache } from "./prompt/promptService";
import {
  mvpClearReviewPolicy,
  mvpConfigureReviewFailures,
  mvpReviewForceNonRetryableOnce,
  reviewTaskResult,
} from "./reviewer/reviewerService";
import type { ExecutionRun } from "./contracts/mvpExecutionTypes";
import {
  mvpResetExecutionState,
  startRun,
  getRunStatus,
  retryTask,
  DEFAULT_MAX_RETRY_COUNT,
} from "./execution/executionService";
import { mvpGetExecutionStepsForRun } from "./execution/executionStepLog";
import type { MvpExecutionStepRecord } from "./execution/executionStepLog";
import {
  mvpGetExecutionStepsForTask,
  mvpGetLastFailureStepForRun,
  mvpGetRetryCountFromSteps,
  mvpSummarizeExecutionStepFlow,
} from "./execution/executionStepProjections";
import { mvpProjectRunSummary } from "./execution/mvpRunSummary";
import {
  mvpTestInstallRunAtRetryLimit,
  mvpTestInstallRunWithNonRetryableFailure,
} from "./testing/mvpExecutionFixtures";
import { evaluateExecutionReadiness } from "./orchestration/orchestrationService";
import {
  mvpCheckReadinessDto,
  mvpGetRunDetailDto,
  mvpGetRunSummaryDto,
  mvpGetStepFlowSummary,
  mvpGetStepSummaryDtos,
  mvpStartRunIfReady,
} from "./orchestration/mvpOrchestrationFacade";
import {
  mvpExecutionPortsBundle,
  mvpSetExecutionPortsBundleForTesting,
} from "./runtime/mvpExecutionPortsBundle";
import { mvpDefaultTaskProvider } from "./task/taskService";
import { mvpDefaultPromptProvider } from "./prompt/promptService";
import { mvpDefaultCursorExecutor } from "./cursor/cursorService";
import { mvpDefaultGitVerifier } from "./git/gitService";
import { mvpDefaultReviewEngine } from "./reviewer/reviewerService";
import { mvpInMemoryRunStore, mvpInMemoryStepStore } from "./execution/inMemoryExecutionState";
import { mvpCursorResetTestHooks, mvpCursorFailNextWaits } from "./cursor/cursorService";
import { mvpGitResetStubs } from "./git/gitService";
import { createMvpFakeExecutionPortsBundle } from "./testing/mvpFakeExecutionPorts";
import {
  mergePersistedRunParts,
  mvpPersistedRowToStepRecord,
  mvpStepRecordToPersistedRow,
  persistedMetaRowToRunMeta,
  runMetaToPersistedRow,
  splitExecutionRunForPersistence,
} from "./mapping/mvpPersistenceMapping";
import { MvpDraftPrismaRunStoreAdapter } from "./adapters/draft/mvpDraftPrismaRunStoreAdapter";
import { MvpDraftPrismaStepStoreAdapter } from "./adapters/draft/mvpDraftPrismaStepStoreAdapter";
import { mvpBuildRunInspectionViewModel } from "./orchestration/mvpRunInspectionViewModel";
import {
  MvpExecutionApplicationService,
  MVP_EXECUTION_APPLICATION_LAYER_ID,
} from "../application/mvpExecutionApplicationService";
import { appFailureResult, appSuccessResult } from "../application/mvpAppResultHelpers";
import {
  buildPlanningPipelineResultViewModel,
  legacyEarlyStopReasonString,
  runPlanningPipeline,
} from "../application/pipeline";
import { mvpRunPlanningPipelineUseCase } from "../application/usecases/mvpRunPlanningPipelineUseCase";
import {
  buildPlanningExecutionHandoff,
  validatePlanningExecutionHandoff,
  validatePlanningExecutionHandoffBundle,
  validatePlanningExecutionHandoffFromContext,
} from "../application/planningExecutionHandoff";
import { mvpPrepareExecutionHandoffFromPlanningUseCase } from "../application/usecases/mvpPrepareExecutionHandoffFromPlanningUseCase";
import {
  buildExecutionPreparationBundle,
  validateExecutionPreparationBundle,
} from "../application/executionPreparation";
import { mvpPrepareExecutionInputFromPlanningUseCase } from "../application/usecases/mvpPrepareExecutionInputFromPlanningUseCase";
import { dryRunExecutionBridge } from "../application/executionBridge";
import { mvpStartExecutionFromPreparationUseCase } from "../application/usecases/mvpStartExecutionFromPreparationUseCase";
import {
  MVP_EXECUTION_APPLICATION_COMMANDS,
  MVP_EXECUTION_APPLICATION_QUERIES,
} from "../application/mvpExecutionApplicationCqrs";
import {
  MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES,
  routeEnvelopeDraftFromGetReadinessResult,
  routeEnvelopeDraftFromGetRunDetailResult,
  routeEnvelopeDraftFromGetRunInspectionResult,
  routeEnvelopeDraftFromGetRunSummaryResult,
  routeEnvelopeDraftFromGetStepListResult,
  routeEnvelopeDraftFromStartRunResult,
} from "../application/mvpRouteEnvelopeDraft";
import { MVP_EXECUTION_APP_CODE } from "../application/mvpExecutionResultCodes";
import {
  mvpGetExecutionInspectionUseCase,
} from "../application/usecases/mvpGetExecutionInspectionUseCase";
import {
  mvpGetExecutionRunDetailUseCase,
  mvpGetExecutionRunSummaryUseCase,
  mvpGetExecutionStepListUseCase,
} from "../application/usecases/mvpGetExecutionStatusUseCase";
import { mvpPrepareExecutionUseCase } from "../application/usecases/mvpPrepareExecutionUseCase";
import { mvpStartExecutionUseCase } from "../application/usecases/mvpStartExecutionUseCase";
import { buildMvpExecutionStatusView } from "../application/viewmodels/mvpExecutionStatusView";
import {
  createRequirementsFromInput,
  normalizeRequirementText,
  requirementsFromLegacyProjectSpecBody,
} from "../application/usecases/requirement";
import { mvpPrepareMockupFromRequirementInputUseCase } from "../application/usecases/mvpPrepareMockupFromRequirementInputUseCase";
import {
  buildRequirementDrafts,
  buildRequirementGapViewModel,
  buildRefinedRequirements,
  detectRequirementGaps,
  evaluateRequirementReadiness,
  groupRequirementGaps,
  normalizeRequirementInput,
  prepareRequirementInputForRefinement,
  prepareRequirementRefinementDecision,
  prepareRequirementsFromInput,
  refinedRequirementsToMvpRequirements,
  splitRequirementInput,
} from "../application/planning/requirementInput";
import type { PrepareRequirementRefinementDecisionResult } from "../application/planning/requirementInput/prepareRequirementRefinementDecision";
import type { RequirementRefinementDecision, RefinedRequirement } from "../application/planning/requirementInput/refinement/refinementContracts";
import {
  FEATURE_GENERATION_ENTRY_CODE,
  prepareFeatureGenerationEntry,
} from "../application/planning/featureEntry";
import type { FeatureGenerationResult } from "../application/planning/featureGeneration";
import {
  featureDraftsToMvpFeatures,
  generateFeaturesFromRefinedRequirements,
  generateStandardFeatures,
} from "../application/planning/featureGeneration";
import {
  generateIaFromFeatures,
  generateStandardIa,
  iaMenuDraftsToMvpMenuNodes,
  normalizeMenuName,
} from "../application/planning/iaGeneration";
import type { IaMenuDraft } from "../application/planning/iaGeneration/iaGenerationContracts";
import {
  generateStandardScreens,
  inferScreenRoleFromMenuName,
  screenDraftsToMvpScreens,
} from "../application/planning/screenGeneration";
import {
  generateStandardTasks,
  normalizeTaskName as normalizePlanningTaskName,
  taskDraftsToMvpTasks,
} from "../application/planning/taskGeneration";
import type { MvpFeature, MvpRequirement } from "./domain/mvpDomainTypes";
import {
  generateFeaturesFromRequirements,
  generateIAFromFeatures,
  generateMockupTasksFromRequirements,
  generateMockupTasksFromRequirementList,
  generateScreensFromIA,
  generateTasksFromScreens,
} from "./domain/mvpDomainGenerationService";
import { validateDomainMapping } from "./domain/mvpDomainValidationService";
import {
  mvpClearRequirementStore,
  mvpSeedProjectRequirements,
} from "./domain/stores/mvpRequirementStore";
import { mvpClearMenuStore } from "./domain/stores/mvpMenuStore";
import { mvpClearScreenStore, mvpSeedProjectScreens } from "./domain/stores/mvpScreenStore";
import { orderTasksByScreenFlow } from "./domain/mvpDomainOrderingService";
import type { MvpScreen } from "./domain/mvpDomainTypes";
import type { ScreenFlowEdge } from "./screen/mvpScreenFlowTypes";
import {
  generateScreenFlow,
  getOrderedScreensFromFlow,
  validateScreenFlow,
} from "./screen/mvpScreenFlowService";
import { findNavigationEntryScreen } from "./screen/helpers/screenFlowLookup";
import {
  getNextScreens,
  getPreviousScreens,
  getScreenDepth,
  isEntryScreen,
} from "./screen/mvpScreenFlowMetadata";
import { orderTasksByScreenFlow as orderTasksByScreenFlowGraph } from "./screen/mvpScreenFlowTaskOrdering";
import { mvpClearScreenFlowStore } from "./screen/stores/mvpScreenFlowStore";
import { getScreenByTask } from "./domain/mvpDomainTaskScreenService";
import {
  legacyBuildFlowContextPromptLines,
  resolveFlowGraphForTask,
  resolvePrevNextScreenNames,
  resolvePreviousScreenNames,
  resolveNextScreenNames,
  resolveScreenFlowLabelsForPrompt,
  buildFlowContextPromptLines,
} from "./prompt/mvpPromptFlowContext";
import { resolveFlowValidationMode, resolveFlowValidationModeFromPrompt } from "./reviewer/mvpReviewFlowValidationMode";
import {
  MVP_FLOW_VALIDATION_ISSUE_MESSAGE,
  detectFlowValidationEnabledFromPrompt,
  evaluateFlowValidation,
  hasFlowContextBlockInPrompt,
  parseFlowBlockContentFromPrompt,
  parseFlowContextFromPrompt,
  parseResultSummary,
  validateEntryScreenRule,
  validateNavigationToken,
  validateScreenIsolationToken,
} from "./reviewer/mvpReviewFlowValidationHelpers";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(`mvpSelfCheck: ${msg}`);
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function baseTasks(pid: string): Task[] {
  return [
    {
      id: `t-a-${pid}`,
      title: "A",
      description: "first",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 0,
      projectId: pid,
    },
    {
      id: `t-b-${pid}`,
      title: "B",
      description: "second",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 1,
      projectId: pid,
    },
  ];
}

function resetAll(): void {
  mvpSetExecutionPortsBundleForTesting(null);
  mvpClearTaskStore();
  mvpClearRequirementStore();
  mvpClearMenuStore();
  mvpClearScreenStore();
  mvpClearScreenFlowStore();
  clearPromptCache();
  mvpClearReviewPolicy();
  mvpResetExecutionState();
  mvpCursorResetTestHooks();
  mvpGitResetStubs();
}

/**
 * Runs built-in scenarios; throws on first failure.
 */
export async function runMvpSelfCheck(): Promise<void> {
  const pid = "mvp-self-check";

  resetAll();
  {
    const b = mvpExecutionPortsBundle();
    assert(b.tasks === mvpDefaultTaskProvider, "bundle.tasks must be default TaskProvider");
    assert(b.prompt === mvpDefaultPromptProvider, "bundle.prompt must be default PromptProvider");
    assert(b.cursor === mvpDefaultCursorExecutor, "bundle.cursor must be default CursorExecutor");
    assert(b.git === mvpDefaultGitVerifier, "bundle.git must be default GitVerifier");
    assert(b.review === mvpDefaultReviewEngine, "bundle.review must be default ReviewEngine");
    assert(b.runStore === mvpInMemoryRunStore, "bundle.runStore must be in-memory RunStore");
    assert(b.stepStore === mvpInMemoryStepStore, "bundle.stepStore must be in-memory StepStore");
    assert(!(b.runStore instanceof MvpDraftPrismaRunStoreAdapter), "default bundle must not use Prisma run draft");
    assert(!(b.stepStore instanceof MvpDraftPrismaStepStoreAdapter), "default bundle must not use Prisma step draft");
  }

  resetAll();
  {
    const readinessProbe = await mvpCheckReadinessDto({ projectId: "mvp-result-helper-probe" });
    const viaHelper = appSuccessResult({ readiness: readinessProbe });
    const literalOk = { ok: true as const, code: MVP_EXECUTION_APP_CODE.OK, readiness: readinessProbe };
    assert(stableJson(viaHelper) === stableJson(literalOk), "appSuccessResult must match literal success contract");
    const fInv = appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID);
    assert(
      stableJson(fInv) === stableJson({ ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID }),
      "appFailureResult without extras must match literal"
    );
    const fNr = appFailureResult(MVP_EXECUTION_APP_CODE.NOT_READY, { readiness: readinessProbe });
    assert(
      stableJson(fNr) === stableJson({ ok: false, code: MVP_EXECUTION_APP_CODE.NOT_READY, readiness: readinessProbe }),
      "appFailureResult with extras must match literal"
    );

    assert(
      MVP_EXECUTION_APPLICATION_COMMANDS.length === 1 && MVP_EXECUTION_APPLICATION_COMMANDS[0] === "startRun",
      "CQRS: exactly one command and it must be startRun"
    );
    assert(
      !(MVP_EXECUTION_APPLICATION_QUERIES as readonly string[]).includes("startRun"),
      "CQRS: startRun must only be a command"
    );
    assert(
      MVP_EXECUTION_APPLICATION_QUERIES.length === 5 &&
        (["getReadiness", "getRunSummary", "getRunDetail", "getStepList", "getRunInspection"] as const).every((n) =>
          (MVP_EXECUTION_APPLICATION_QUERIES as readonly string[]).includes(n)
        ),
      "CQRS query surface must stay in sync with service methods"
    );

    mvpSeedProjectTasks("mvp-envelope-not-ready", []);
    const appEnv = new MvpExecutionApplicationService();
    const gr = await appEnv.getReadiness({ projectId: "mvp-envelope-not-ready" });
    const envG = routeEnvelopeDraftFromGetReadinessResult(gr);
    assert(
      envG.success === true && gr.ok && stableJson(envG.data) === stableJson({ readiness: gr.readiness }),
      "readiness envelope maps application success"
    );

    const sr = await appEnv.startRun({ projectId: "mvp-envelope-not-ready" });
    assert(sr.ok === false && sr.code === MVP_EXECUTION_APP_CODE.NOT_READY, "startRun when not ready must fail");
    const envS = routeEnvelopeDraftFromStartRunResult(sr);
    assert(
      envS.success === false &&
        "message" in envS &&
        envS.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.NOT_READY],
      "NOT_READY envelope message"
    );
    assert(
      "data" in envS && envS.data != null && stableJson(envS.data) === stableJson({ readiness: sr.readiness }),
      "NOT_READY envelope carries readiness"
    );
  }
  resetAll();

  {
    const p = "mvp-domain-gen";
    const reqs: MvpRequirement[] = [
      { id: `req-1-${p}`, projectId: p, description: "Need a login screen", status: "CONFIRMED" },
      { id: `req-2-${p}`, projectId: p, description: "Need a settings screen", status: "CONFIRMED" },
    ];
    mvpSeedProjectRequirements(p, reqs);
    const features = generateFeaturesFromRequirements(reqs);
    const ia = generateIAFromFeatures(features);
    const screens = generateScreensFromIA(ia);
    const tasks = generateTasksFromScreens(screens, "MOCKUP");
    const v = validateDomainMapping({
      requirements: reqs,
      features,
      menuNodes: ia,
      screens,
      tasks,
      allowLegacyTasks: false,
    });
    assert(v.ok === true, "domain mapping should be valid");
    assert(tasks.length === screens.length, "1 screen = 1 task");
    assert(tasks.every((t) => (t as { screenId?: string }).screenId != null), "generated tasks must have screenId");
    assert(tasks.every((t) => (t as { taskPurpose?: string }).taskPurpose === "MOCKUP"), "generated tasks purpose MOCKUP");
    for (let i = 1; i < tasks.length; i += 1) {
      assert(tasks[i]!.finalOrder >= tasks[i - 1]!.finalOrder, "tasks ordered by screen.order/finalOrder");
    }

    const entryTasks = generateMockupTasksFromRequirements(p);
    assert(entryTasks.length === tasks.length, "entrypoint produces same task count");
    mvpSeedProjectTasks(p, entryTasks);
    const run = await startRun(p);
    assert(run.status === "SUCCESS", "generated tasks should be executable by existing MVP pipeline");
  }

  {
    resetAll();
    const p = "mvp-req-input-canonical";
    const ideaKo =
      "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다";
    const reqsFromInput = createRequirementsFromInput(ideaKo, p);
    assert(reqsFromInput.length >= 2, "requirement input: simple 하고 split should yield multiple requirements");
    assert(
      normalizeRequirementText("  alpha   만들고 싶다  ") === "alpha",
      "normalizeRequirementText trims and strips common filler"
    );
    const prepared = mvpPrepareMockupFromRequirementInputUseCase(p, ideaKo);
    assert(
      prepared.requirements.length === reqsFromInput.length,
      "requirement-input use-case should surface the same requirement count as createRequirementsFromInput"
    );
    assert(prepared.tasks.length >= 2, "requirement input → tasks pipeline should produce multiple mockup tasks");
    mvpSeedProjectTasks(p, prepared.tasks);
    const runInput = await startRun(p);
    assert(runInput.status === "SUCCESS", "requirement-input-derived tasks must remain executable");

    resetAll();
    const pComma = "mvp-req-input-comma";
    const commaIdea = "화상회의 생성 기능, 화상회의 참여 기능";
    const commaReqs = createRequirementsFromInput(commaIdea, pComma);
    assert(commaReqs.length === 2, "comma-separated requirement input should split deterministically");
    const commaTasks = generateMockupTasksFromRequirementList(pComma, commaReqs);
    mvpSeedProjectTasks(pComma, commaTasks);
    const runComma = await startRun(pComma);
    assert(runComma.status === "SUCCESS", "comma-split requirement list should execute");

    resetAll();
    const pLegacy = "mvp-legacy-project-spec-body";
    const legacyReqs = requirementsFromLegacyProjectSpecBody(
      pLegacy,
      "# Old ProjectSpec\n\nLegacy body text for conversion.\n"
    );
    assert(legacyReqs.length === 1, "legacy ProjectSpec body maps to a single coarse requirement");
    const legacyTasks = generateMockupTasksFromRequirementList(pLegacy, legacyReqs);
    mvpSeedProjectTasks(pLegacy, legacyTasks);
    const runLegacy = await startRun(pLegacy);
    assert(runLegacy.status === "SUCCESS", "legacy ProjectSpec-as-text path should still execute");
  }

  {
    resetAll();
    const pPlan = "mvp-planning-requirement-input";
    assert(
      normalizeRequirementInput("  line1\nline2   ").text.replace(/\s+/g, " ") ===
        normalizeRequirementInput("line1 line2").text,
      "normalizeRequirementInput flattens newlines like spaces"
    );
    const commaParts = splitRequirementInput("화상회의 생성 기능, 화상회의 참여 기능");
    assert(commaParts.length === 2, "planning split: comma yields two draft descriptions");

    const vcNorm = normalizeRequirementInput(
      "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다"
    ).text;
    const vcParts = splitRequirementInput(vcNorm);
    assert(
      vcParts.length === 2 &&
        vcParts[0] === "화상회의 생성 기능이 필요하다" &&
        vcParts[1] === "화상회의 참여 기능이 필요하다",
      "planning split: deterministic two-intent video-meeting phrasing"
    );

    const vague = "We want a dashboard for teams";
    const gaps = detectRequirementGaps(normalizeRequirementInput(vague).text, []);
    assert(
      gaps.some((g) => g.code === "AUTH_SCOPE"),
      "gap detection: underspecified idea should mention authentication scope"
    );

    const built = buildRequirementDrafts({ projectId: pPlan, inputText: vague });
    assert(built.drafts.length >= 1 && built.normalizedText.length > 0, "buildRequirementDrafts produces drafts");
    assert(built.gaps.some((g) => g.code === "AUTH_SCOPE"), "buildRequirementDrafts runs gap detection");

    const prep = prepareRequirementsFromInput({
      projectId: pPlan,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
    });
    assert(prep.requirements.length === 2, "prepareRequirementsFromInput maps two drafts to requirements");
    const featuresP = generateFeaturesFromRequirements(prep.requirements);
    const menuP = generateIAFromFeatures(featuresP);
    const screensP = generateScreensFromIA(menuP);
    const tasksP = generateTasksFromScreens(screensP, "MOCKUP");
    const vmap = validateDomainMapping({
      requirements: prep.requirements,
      features: featuresP,
      menuNodes: menuP,
      screens: screensP,
      tasks: tasksP,
      allowLegacyTasks: false,
    });
    assert(vmap.ok === true, "planning-derived requirements must stay domain-valid");

    mvpSeedProjectTasks(pPlan, generateMockupTasksFromRequirementList(pPlan, prep.requirements));
    const runPlan = await startRun(pPlan);
    assert(runPlan.status === "SUCCESS", "planning prepareRequirementsFromInput path must execute");

    resetAll();
    const pLegacyCreate = "mvp-legacy-createRequirementsFromInput";
    const legacyCreate = createRequirementsFromInput(
      "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
      pLegacyCreate
    );
    assert(legacyCreate.length >= 2, "legacy createRequirementsFromInput must remain unchanged for same input shape");
  }

  {
    resetAll();
    const pGap = "mvp-gap-ux-viewmodel";
    const vague = "We want a dashboard for teams";
    const gaps = detectRequirementGaps(normalizeRequirementInput(vague).text, []);
    const groups = groupRequirementGaps(gaps);
    assert(groups.some((g) => g.code === "AUTHENTICATION"), "AUTH_SCOPE gaps map to AUTHENTICATION group");
    const stableTwice = stableJson(groupRequirementGaps(gaps)) === stableJson(groupRequirementGaps(gaps));
    assert(stableTwice, "groupRequirementGaps output must be stable for same input");

    const drafts = buildRequirementDrafts({ projectId: pGap, inputText: vague }).drafts;
    const vm = buildRequirementGapViewModel({
      normalizedText: normalizeRequirementInput(vague).text,
      drafts,
      gaps,
    });
    assert(vm.summary.totalDrafts === drafts.length, "view model summary totalDrafts");
    assert(vm.summary.totalGapQuestions === gaps.length, "view model summary totalGapQuestions");
    assert(vm.sections[0]!.priority === "HIGH", "high-priority section (authentication) must appear first");
    assert(
      vm.summary.highPriorityCount === vm.sections.filter((s) => s.priority === "HIGH").reduce((n, s) => n + s.questions.length, 0),
      "highPriorityCount must match questions in HIGH sections"
    );

    const refined = prepareRequirementInputForRefinement({
      projectId: pGap,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
    });
    assert(refined.gapViewModel.sections.length >= 1, "refinement handoff includes gap sections");
    assert(refined.requirements.length === refined.drafts.length, "refinement includes aligned requirements");
    const featR = generateFeaturesFromRequirements(refined.requirements);
    const menuR = generateIAFromFeatures(featR);
    const screensR = generateScreensFromIA(menuR);
    const tasksR = generateTasksFromScreens(screensR, "MOCKUP");
    const vmapR = validateDomainMapping({
      requirements: refined.requirements,
      features: featR,
      menuNodes: menuR,
      screens: screensR,
      tasks: tasksR,
      allowLegacyTasks: false,
    });
    assert(vmapR.ok === true, "refinement requirements stay compatible with downstream mapping");
  }

  {
    resetAll();
    const pRef = "mvp-requirement-refinement-decision";
    const video = prepareRequirementRefinementDecision({
      projectId: pRef,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
    });
    assert(video.readinessResult.isReady === false, "video meeting idea stays gated until access/auth choices");
    assert(
      video.refinementDecision.decisions.some(
        (d) => d.gap.code === "VISIBILITY_OR_ROLES" && d.mode === "USER_CONFIRM"
      ),
      "meeting collaboration without explicit visibility is USER_CONFIRM"
    );
    assert(
      video.refinementDecision.decisions.some((d) => d.gap.code === "AUTH_SCOPE" && d.mode === "USER_CONFIRM"),
      "implicit authentication scope is USER_CONFIRM"
    );

    const listDetail = prepareRequirementRefinementDecision({
      projectId: pRef,
      inputText: "게시글 목록과 상세를 볼 수 있는 서비스",
    });
    const listDec = listDetail.refinementDecision.decisions.find((d) => d.gap.code === "LIST_DETAIL_SCREENS");
    assert(listDec?.mode === "AUTO" && Boolean(listDec.resolvedValue), "explicit list/detail intent is AUTO-resolved");
    assert(listDetail.readinessResult.isReady === false, "remaining confirm gaps block automatic downstream");
    assert(
      listDetail.readinessResult.confirmRequired.some((d) => d.gap.code === "AUTH_SCOPE"),
      "readiness lists authentication scope as confirm-required"
    );
    assert(
      listDetail.refinedRequirements.length >= 1 &&
        listDetail.refinedRequirements.some((r) => r.source === "AUTO_RESOLVED" && r.status === "REFINED"),
      "AUTO list/detail resolution enriches refined requirement rows"
    );

    const vagueKo = prepareRequirementRefinementDecision({
      projectId: pRef,
      inputText: "좋은 플랫폼 만들고 싶다",
    });
    assert(vagueKo.readinessResult.isReady === false, "generic goal text is not automatically ready");
    assert(
      vagueKo.readinessResult.blockingIssues.some((d) => d.gap.code === "NO_ACTIONABLE_INTENT"),
      "marketing-style vagueness yields synthetic blocking intent"
    );

    const autoOnlyDecision: RequirementRefinementDecision = {
      normalizedText: "Stable demo input for refinement-only readiness",
      drafts: [
        {
          id: `draft-auto-${pRef}`,
          projectId: pRef,
          description: "Browse posts in list and detail",
          source: "USER_INPUT",
          confidence: "HIGH",
        },
      ],
      decisions: [
        {
          gap: {
            code: "LIST_DETAIL_SCREENS",
            question: "Confirm list vs detail",
            severity: "INFO",
          },
          mode: "AUTO",
          reason: "synthetic self-check row",
          resolvedValue:
            "Assumed UX: one list/browse screen and one detail screen for the same content type, with navigation between them.",
        },
      ],
    };
    assert(evaluateRequirementReadiness(autoOnlyDecision).isReady === true, "AUTO-only gap decisions are ready");
    const refinedOnlyAuto = buildRefinedRequirements({ refinementDecision: autoOnlyDecision });

    const entryListDetail = prepareFeatureGenerationEntry({
      source: "requirement_input",
      projectId: pRef,
      inputText: "게시글 목록과 상세를 볼 수 있는 서비스",
    });
    assert(
      entryListDetail.featureGenerationEntry.ok === false &&
        entryListDetail.featureGenerationEntry.status === "NEEDS_CONFIRMATION",
      "list/detail idea with unresolved auth stays outside automatic feature generation"
    );
    assert(
      entryListDetail.featureGenerationEntry.pendingGapDecisions.some((d) => d.gap.code === "AUTH_SCOPE"),
      "feature entry preserves AUTH gap as pending confirmation"
    );

    const entryVideoMeeting = prepareFeatureGenerationEntry({
      source: "requirement_input",
      projectId: pRef,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
    });
    assert(
      entryVideoMeeting.featureGenerationEntry.ok === false &&
        entryVideoMeeting.featureGenerationEntry.status === "NEEDS_CONFIRMATION",
      "video meeting phrasing needs confirmation before feature synthesis"
    );
    assert(
      entryVideoMeeting.featureGenerationEntry.reasons.some(
        (r) => r.code === FEATURE_GENERATION_ENTRY_CODE.NEEDS_CONFIRMATION_ACCESS_SCOPE
      ),
      "visibility / roles surface as access-scope confirmation reasons"
    );

    const entryVague = prepareFeatureGenerationEntry({
      source: "requirement_input",
      projectId: pRef,
      inputText: "좋은 플랫폼 만들고 싶다",
    });
    assert(
      entryVague.featureGenerationEntry.ok === false && entryVague.featureGenerationEntry.status === "BLOCKED",
      "generic marketing input is blocked at feature entry"
    );
    assert(
      entryVague.featureGenerationEntry.reasons.some((r) => r.code === FEATURE_GENERATION_ENTRY_CODE.BLOCKED_VAGUE_INPUT),
      "vague input carries BLOCKED_VAGUE_INPUT reason code"
    );

    const synthRefinementBundle: PrepareRequirementRefinementDecisionResult = {
      normalizedText: autoOnlyDecision.normalizedText,
      drafts: autoOnlyDecision.drafts,
      gapViewModel: buildRequirementGapViewModel({
        normalizedText: autoOnlyDecision.normalizedText,
        drafts: autoOnlyDecision.drafts,
        gaps: [],
      }),
      refinementDecision: autoOnlyDecision,
      refinedRequirements: refinedOnlyAuto,
      readinessResult: evaluateRequirementReadiness(autoOnlyDecision),
    };
    const entryReady = prepareFeatureGenerationEntry({
      source: "refinement_result",
      refinement: synthRefinementBundle,
    });
    assert(
      entryReady.featureGenerationEntry.ok === true && entryReady.featureGenerationEntry.status === "READY",
      "AUTO-only refinement bundle passes the feature-generation entry gate"
    );
    assert(
      entryReady.featureGenerationEntry.input.projectId === pRef &&
        entryReady.featureGenerationEntry.input.refinedRequirements.length === refinedOnlyAuto.length,
      "READY entry exposes a stable input bundle for downstream generators"
    );
    const stdFromReady = generateStandardFeatures({ entry: entryReady.featureGenerationEntry });
    assert(
      stdFromReady.state === "GENERATED" && stdFromReady.result != null,
      "generateStandardFeatures runs only on READY entry control output"
    );
    const mvpStandardFromRefined = featureDraftsToMvpFeatures(stdFromReady.result.features);
    assert(
      mvpStandardFromRefined.length === 1 && mvpStandardFromRefined[0]!.requirementIds.length === 1,
      "standard feature generation stays aligned with a single refined requirement row"
    );
    const mvpFromRefined = refinedRequirementsToMvpRequirements(
      entryReady.featureGenerationEntry.input.refinedRequirements
    );
    assert(mvpFromRefined.length === 1 && mvpFromRefined[0]!.status === "CONFIRMED", "refined rows map to confirmed MVP requirements");
    const featsAuto = generateFeaturesFromRequirements(mvpFromRefined);
    const menuAuto = generateIAFromFeatures(featsAuto);
    const screensAuto = generateScreensFromIA(menuAuto);
    const tasksAuto = generateTasksFromScreens(screensAuto, "MOCKUP");
    const vmapAuto = validateDomainMapping({
      requirements: mvpFromRefined,
      features: featsAuto,
      menuNodes: menuAuto,
      screens: screensAuto,
      tasks: tasksAuto,
      allowLegacyTasks: false,
    });
    assert(vmapAuto.ok === true, "refinement-mapped requirements stay domain-valid through task generation");
    mvpSeedProjectTasks(pRef, generateMockupTasksFromRequirementList(pRef, mvpFromRefined));
    const runRef = await startRun(pRef);
    assert(runRef.status === "SUCCESS", "refined-to-MVP requirement list should still execute");

    const pStd = "mvp-standard-feature-grouping";
    const refinedVideoPair: RefinedRequirement[] = [
      {
        id: `rr-v0-${pStd}`,
        projectId: pStd,
        description: "화상회의 생성 기능이 필요하다",
        source: "USER_INPUT",
        status: "REFINED",
      },
      {
        id: `rr-v1-${pStd}`,
        projectId: pStd,
        description: "화상회의 참여 기능이 필요하다",
        source: "USER_INPUT",
        status: "REFINED",
      },
    ];
    const genVideo = generateFeaturesFromRefinedRequirements({
      projectId: pStd,
      refinedRequirements: refinedVideoPair,
    });
    assert(
      genVideo.features.length === 1 &&
        genVideo.features[0]!.name === "화상회의" &&
        genVideo.features[0]!.requirementIds.length === 2,
      "related video-meeting capabilities merge into one deterministic feature"
    );
    assert(
      genVideo.traces[0]!.featureId === genVideo.features[0]!.id &&
        genVideo.traces[0]!.requirementIds.join(",") === genVideo.features[0]!.requirementIds.join(","),
      "feature source trace lists the same requirement ids as the draft"
    );

    const refinedPostBrowse: RefinedRequirement[] = [
      {
        id: `rr-p0-${pStd}`,
        projectId: pStd,
        description: "게시글 목록 조회",
        source: "USER_INPUT",
        status: "REFINED",
      },
      {
        id: `rr-p1-${pStd}`,
        projectId: pStd,
        description: "게시글 상세 조회",
        source: "USER_INPUT",
        status: "REFINED",
      },
    ];
    const genPost = generateFeaturesFromRefinedRequirements({
      projectId: pStd,
      refinedRequirements: refinedPostBrowse,
    });
    assert(
      genPost.features.length === 1 && genPost.features[0]!.name === "게시글 조회",
      "list/detail post browse descriptions collapse to a single 게시글 조회 feature"
    );

    const refinedLoginAndPost: RefinedRequirement[] = [
      {
        id: `rr-l-${pStd}`,
        projectId: pStd,
        description: "로그인",
        source: "USER_INPUT",
        status: "REFINED",
      },
      refinedPostBrowse[0]!,
    ];
    const genSplit = generateFeaturesFromRefinedRequirements({
      projectId: pStd,
      refinedRequirements: refinedLoginAndPost,
    });
    assert(genSplit.features.length === 2, "unrelated capabilities stay in separate features");

    const mvpReqVideo = refinedRequirementsToMvpRequirements(refinedVideoPair);
    const mvpFeatVideo = featureDraftsToMvpFeatures(genVideo.features);
    const menuVideo = generateIAFromFeatures(mvpFeatVideo);
    const screensVideo = generateScreensFromIA(menuVideo);
    const tasksVideo = generateTasksFromScreens(screensVideo, "MOCKUP");
    const vmapVideo = validateDomainMapping({
      requirements: mvpReqVideo,
      features: mvpFeatVideo,
      menuNodes: menuVideo,
      screens: screensVideo,
      tasks: tasksVideo,
      allowLegacyTasks: false,
    });
    assert(vmapVideo.ok === true, "standard-generated features remain valid IA generation inputs");

    const invalidStd = generateStandardFeatures({
      entry: { ok: false, status: "BLOCKED", reasons: [], pendingGapDecisions: [] },
    });
    assert(
      invalidStd.state === "INVALID_READY_BUNDLE" && invalidStd.result == null,
      "generateStandardFeatures rejects non-READY entry results"
    );

    const pIa = "mvp-standard-ia-generation";
    assert(normalizeMenuName("화상회의 관리 기능") === "화상회의", "IA menu name normalization strips redundant capability tails");
    assert(normalizeMenuName("게시글 조회 기능") === "게시글 조회", "IA menu name normalization keeps concise browse labels");

    const iaSingle = generateIaFromFeatures([
      { id: `feat-ia-0-${pIa}`, projectId: pIa, name: "화상회의", order: 0 },
    ]);
    const rootId = `menu-root-${pIa}`;
    const topSingle = iaSingle.menuNodes.filter((m) => m.parentId === rootId);
    assert(topSingle.length === 1 && topSingle[0]!.name === "화상회의", "single feature becomes one stable top-level menu under root");

    const iaGrouped = generateIaFromFeatures([
      { id: `feat-ia-p0-${pIa}`, projectId: pIa, name: "게시글 조회", order: 0 },
      { id: `feat-ia-p1-${pIa}`, projectId: pIa, name: "게시글 작성", order: 1 },
    ]);
    const postParent = iaGrouped.menuNodes.find((m) => m.id === `menu-group-${pIa}-post`);
    assert(postParent != null && postParent.name === "게시글", "two post lines share a grouped parent menu");
    const postChildren = iaGrouped.menuNodes
      .filter((m) => m.parentId === postParent!.id)
      .sort((a, b) => a.order - b.order);
    assert(
      postChildren.length === 2 && postChildren[0]!.name === "조회" && postChildren[1]!.name === "작성",
      "grouped post menus use normalized child titles"
    );
    const parentTrace = iaGrouped.traces.find((t) => t.menuId === postParent!.id);
    assert(
      parentTrace != null &&
        parentTrace.featureIds.includes(`feat-ia-p0-${pIa}`) &&
        parentTrace.featureIds.includes(`feat-ia-p1-${pIa}`),
      "IA traces preserve source feature ids on grouped parent"
    );

    const iaFlat = generateIaFromFeatures([
      { id: `feat-ia-l-${pIa}`, projectId: pIa, name: "로그인", order: 0 },
      { id: `feat-ia-b-${pIa}`, projectId: pIa, name: "게시글 조회", order: 1 },
    ]);
    const topFlat = iaFlat.menuNodes.filter((m) => m.parentId === rootId);
    assert(topFlat.length === 2, "unrelated capabilities stay as separate root-level menus");

    const groupedFeatureResult: FeatureGenerationResult = {
      projectId: pIa,
      traces: [],
      features: [
        {
          id: `feat-ia-p0-${pIa}`,
          projectId: pIa,
          name: "게시글 조회",
          requirementIds: [`req-ia-p0-${pIa}`],
          order: 0,
          source: "REQUIREMENT_REFINEMENT" as const,
        },
        {
          id: `feat-ia-p1-${pIa}`,
          projectId: pIa,
          name: "게시글 작성",
          requirementIds: [`req-ia-p1-${pIa}`],
          order: 1,
          source: "REQUIREMENT_REFINEMENT" as const,
        },
      ],
    };
    const stdIa = generateStandardIa({ featureResult: groupedFeatureResult });
    assert(stdIa.state === "GENERATED" && stdIa.result != null, "generateStandardIa consumes standardized feature results");
    const mvpMenuIa = iaMenuDraftsToMvpMenuNodes(stdIa.result.menuNodes);
    const mvpReqIa: MvpRequirement[] = [
      { id: `req-ia-p0-${pIa}`, projectId: pIa, description: "게시글 조회", status: "CONFIRMED" },
      { id: `req-ia-p1-${pIa}`, projectId: pIa, description: "게시글 작성", status: "CONFIRMED" },
    ];
    const mvpFeatsIa: MvpFeature[] = groupedFeatureResult.features.map((f) => ({
      id: f.id,
      projectId: f.projectId,
      name: f.name,
      requirementIds: f.requirementIds,
      order: f.order,
    }));
    const screensIa = generateScreensFromIA(mvpMenuIa);
    const tasksIa = generateTasksFromScreens(screensIa, "MOCKUP");
    const vmapIa = validateDomainMapping({
      requirements: mvpReqIa,
      features: mvpFeatsIa,
      menuNodes: mvpMenuIa,
      screens: screensIa,
      tasks: tasksIa,
      allowLegacyTasks: false,
    });
    assert(vmapIa.ok === true, "standard IA rows map cleanly into the existing screen generation path");

    const emptyIa = generateStandardIa({ featureResult: { projectId: pIa, features: [], traces: [] } });
    assert(
      emptyIa.state === "EMPTY_FEATURES" && emptyIa.result != null && emptyIa.result.menuNodes.length === 0,
      "empty feature list yields EMPTY_FEATURES with an explicit empty menu set"
    );

    const scrSingle = generateStandardScreens({ iaResult: iaSingle });
    assert(
      scrSingle.state === "GENERATED" &&
        scrSingle.result != null &&
        scrSingle.result.screens.length === 1 &&
        scrSingle.result.screens[0]!.routePath === "/video-meeting",
      "single IA menu maps to one screen with a deterministic route"
    );
    assert(inferScreenRoleFromMenuName("조회") === "LIST", "screen role inference treats 조회 as LIST");
    assert(inferScreenRoleFromMenuName("게시글 작성") === "CREATE", "screen role inference treats 작성-bearing names as CREATE");

    const scrGrouped = generateStandardScreens({ iaResult: iaGrouped });
    assert(
      scrGrouped.state === "GENERATED" && scrGrouped.result != null && scrGrouped.result.screens.length === 3,
      "grouped 게시글 IA yields parent + two child screens"
    );
    const listScreen = scrGrouped.result.screens.find((s) => s.name === "조회");
    const writeScreen = scrGrouped.result.screens.find((s) => s.name === "작성");
    assert(
      listScreen != null &&
        writeScreen != null &&
        listScreen.routePath === "/posts/list" &&
        writeScreen.routePath === "/posts/create" &&
        listScreen.screenRole === "LIST" &&
        writeScreen.screenRole === "CREATE",
      "child screens get stable hierarchical routes and inferred roles"
    );
    assert(
      scrGrouped.result.traces.every((t) => scrGrouped.result!.screens.some((s) => s.id === t.screenId && s.menuId === t.menuId)),
      "screen traces preserve menuId linkage for every generated screen"
    );

    const scrFlat = generateStandardScreens({ iaResult: iaFlat });
    assert(
      scrFlat.state === "GENERATED" && scrFlat.result != null && scrFlat.result.screens.length === 2,
      "unrelated IA menus become separate screens"
    );

    const mvpMenuForScreens = iaMenuDraftsToMvpMenuNodes(iaGrouped.menuNodes);
    const mvpScreensPlan = screenDraftsToMvpScreens(scrGrouped.result!.screens);
    const tasksFromPlan = generateTasksFromScreens(mvpScreensPlan, "MOCKUP");
    const vmapScreens = validateDomainMapping({
      requirements: mvpReqIa,
      features: mvpFeatsIa,
      menuNodes: mvpMenuForScreens,
      screens: mvpScreensPlan,
      tasks: tasksFromPlan,
      allowLegacyTasks: false,
    });
    assert(vmapScreens.ok === true, "planning-generated screens stay compatible with task generation inputs");

    const rootOnlyMenus: IaMenuDraft[] = [
      { id: `menu-root-${pIa}`, projectId: pIa, name: "Root", parentId: null, order: 0, sourceFeatureIds: [] },
    ];
    const emptyScreens = generateStandardScreens({
      iaResult: { projectId: pIa, menuNodes: rootOnlyMenus, traces: [] },
    });
    assert(
      emptyScreens.state === "EMPTY_IA" && emptyScreens.result != null && emptyScreens.result.screens.length === 0,
      "root-only IA bundle yields EMPTY_IA with no screens"
    );

    const invalidIaMenus: IaMenuDraft[] = [
      { id: "bad-menu-1", projectId: pIa, name: "orphan", parentId: "missing-parent", order: 0, sourceFeatureIds: [] },
    ];
    const invalidScreens = generateStandardScreens({
      iaResult: { projectId: pIa, menuNodes: invalidIaMenus, traces: [] },
    });
    assert(invalidScreens.state === "INVALID_MENU_INPUT" && invalidScreens.result == null, "orphan menu parents are rejected at the screen gate");

    assert(
      normalizePlanningTaskName("화상회의") === "화상회의 화면 생성",
      "planning task titles append a clear mockup action suffix"
    );
    assert(normalizePlanningTaskName("") === "미지정 화면 생성", "blank screen names map to a safe default task title");

    const stdTasksGrouped = generateStandardTasks({ screenResult: scrGrouped.result! });
    assert(
      stdTasksGrouped.state === "GENERATED" &&
        stdTasksGrouped.result != null &&
        stdTasksGrouped.result.tasks.length === scrGrouped.result!.screens.length,
      "each generated screen yields exactly one planning task"
    );
    const screenIds = new Set(scrGrouped.result!.screens.map((s) => s.id));
    assert(
      stdTasksGrouped.result.tasks.every((t) => screenIds.has(t.screenId)),
      "every task references a valid screen id"
    );
    const sortedScreens = [...scrGrouped.result!.screens].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    assert(
      stdTasksGrouped.result.tasks.every((t, i) => t.screenId === sortedScreens[i]!.id && t.order === i),
      "task order follows sorted screen order"
    );

    const mvpPlanTasks = taskDraftsToMvpTasks(stdTasksGrouped.result.tasks);
    assert(
      mvpPlanTasks.every(
        (t) => t.status === "CONFIRMED" && t.type === "FUNCTIONAL" && t.screenId != null && t.taskPurpose === "MOCKUP"
      ),
      "planning task drafts map to execution-ready MVP task rows"
    );
    const pTaskPlan = `mvp-planning-task-gen-${pIa}`;
    resetAll();
    mvpSeedProjectTasks(pTaskPlan, mvpPlanTasks);
    const runPlanTasks = await startRun(pTaskPlan);
    assert(runPlanTasks.status === "SUCCESS", "planning-derived mockup tasks remain executable by the MVP pipeline");

    const emptyTasks = generateStandardTasks({ screenResult: { projectId: pIa, screens: [], traces: [] } });
    assert(
      emptyTasks.state === "EMPTY_SCREEN" &&
        emptyTasks.result != null &&
        emptyTasks.result.tasks.length === 0,
      "empty screen bundle yields EMPTY_SCREEN task generation state"
    );

    const invalidScreensForTasks = {
      projectId: pIa,
      traces: [],
      screens: [
        { id: "s-bad-a", projectId: pIa, name: "A", menuId: "m-a", routePath: "/a", order: 0, screenRole: "GENERAL" as const },
        { id: "s-bad-b", projectId: "other", name: "B", menuId: "m-b", routePath: "/b", order: 1, screenRole: "GENERAL" as const },
      ],
    };
    const invalidTasks = generateStandardTasks({ screenResult: invalidScreensForTasks });
    assert(invalidTasks.state === "INVALID_SCREEN_INPUT" && invalidTasks.result == null, "mixed project screens are rejected at the task gate");

    const pPipe = `mvp-planning-pipeline-${pIa}`;
    const pipeVague = runPlanningPipeline({ projectId: pPipe, inputText: "좋은 플랫폼 만들고 싶다" });
    assert(pipeVague.status === "BLOCKED", "unified pipeline blocks vague product ideas");
    assert(
      pipeVague.traceLogs?.some((l) => l.includes("stepFeatureEntryGate")),
      "pipeline trace records the feature entry gate step"
    );
    assert(
      pipeVague.earlyStopReason === "feature_entry_gate:BLOCKED",
      "pipeline records early stop reason at the feature entry gate (BLOCKED)"
    );
    assert(
      (pipeVague.executedSteps ?? []).length === 6 && pipeVague.executedSteps?.at(-1) === "stepFeatureEntryGate",
      "pipeline executedSteps lists each step function until the terminal gate"
    );
    assert(pipeVague.pipelineStop?.code === "FEATURE_ENTRY_GATE_BLOCKED", "typed pipeline stop for vague BLOCKED path");
    assert(
      pipeVague.pipelineStop != null && legacyEarlyStopReasonString(pipeVague.pipelineStop) === pipeVague.earlyStopReason,
      "typed stop maps to legacy earlyStopReason string (BLOCKED)"
    );
    {
      const vmVague = buildPlanningPipelineResultViewModel(pipeVague);
      assert(
        vmVague.stopReason?.code === "FEATURE_ENTRY_GATE_BLOCKED" && vmVague.legacyEarlyStopReason === pipeVague.earlyStopReason,
        "planning result view model stop reason matches context (BLOCKED)"
      );
      assert(
        vmVague.status === pipeVague.status &&
          stableJson([...vmVague.executedSteps]) === stableJson(pipeVague.executedSteps ?? []) &&
          vmVague.snapshots.requirementDraftCount === (pipeVague.requirementDrafts?.length ?? 0) &&
          vmVague.snapshots.gapCount === (pipeVague.requirementGaps?.length ?? 0),
        "view model mirrors pipeline context fields for partial run"
      );
      const viaUse = mvpRunPlanningPipelineUseCase({ projectId: pPipe, inputText: "좋은 플랫폼 만들고 싶다" });
      assert(
        stableJson(buildPlanningPipelineResultViewModel(viaUse.context)) === stableJson(viaUse.viewModel),
        "use-case view model equals builder on returned context"
      );
      assert(
        viaUse.viewModel.legacyEarlyStopReason === pipeVague.earlyStopReason && viaUse.viewModel.status === pipeVague.status,
        "use-case output matches direct runPlanningPipeline for same vague input"
      );
    }

    const vagueHandoff = mvpPrepareExecutionHandoffFromPlanningUseCase({ projectId: pPipe, inputText: "좋은 플랫폼 만들고 싶다" });
    assert(vagueHandoff.ok === false && vagueHandoff.reason.length > 0, "BLOCKED planning cannot yield execution handoff");
    assert(validatePlanningExecutionHandoffFromContext(pipeVague).ok === false, "BLOCKED context fails handoff eligibility");
    const vagueExecPrep = mvpPrepareExecutionInputFromPlanningUseCase({ projectId: pPipe, inputText: "좋은 플랫폼 만들고 싶다" });
    assert(vagueExecPrep.ok === false, "BLOCKED planning cannot yield execution preparation bundle");

    const pipeVideo = runPlanningPipeline({
      projectId: pPipe,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
    });
    assert(pipeVideo.status === "NEEDS_CONFIRMATION", "unified pipeline defers video meeting scope until confirmation");
    assert(
      pipeVideo.earlyStopReason === "feature_entry_gate:NEEDS_CONFIRMATION",
      "pipeline records early stop reason at the feature entry gate (NEEDS_CONFIRMATION)"
    );
    assert(pipeVideo.pipelineStop?.code === "FEATURE_ENTRY_GATE_NEEDS_CONFIRMATION", "typed pipeline stop for video NEEDS_CONFIRMATION path");
    assert(
      pipeVideo.pipelineStop != null && legacyEarlyStopReasonString(pipeVideo.pipelineStop) === pipeVideo.earlyStopReason,
      "typed stop maps to legacy earlyStopReason string (NEEDS_CONFIRMATION)"
    );
    const videoHandoff = mvpPrepareExecutionHandoffFromPlanningUseCase({
      projectId: pPipe,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
    });
    assert(videoHandoff.ok === false, "NEEDS_CONFIRMATION planning cannot yield execution handoff");
    assert(validatePlanningExecutionHandoffFromContext(pipeVideo).ok === false, "NEEDS_CONFIRMATION context fails handoff eligibility");
    const videoExecPrep = mvpPrepareExecutionInputFromPlanningUseCase({
      projectId: pPipe,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
    });
    assert(videoExecPrep.ok === false, "NEEDS_CONFIRMATION planning cannot yield execution preparation bundle");

    const listIdea = "게시글 목록과 상세를 볼 수 있는 서비스";
    const standaloneRef = prepareRequirementRefinementDecision({ projectId: pPipe, inputText: listIdea });
    const pipeList = runPlanningPipeline({ projectId: pPipe, inputText: listIdea });
    assert(
      pipeList.normalizedText === standaloneRef.normalizedText &&
        pipeList.readinessResult?.isReady === standaloneRef.readinessResult.isReady &&
        pipeList.featureGenerationEntry?.ok === false,
      "pipeline refinement stage matches standalone prepareRequirementRefinementDecision for the same input"
    );

    const autoDraftsPipe = autoOnlyDecision.drafts.map((d) => ({ ...d, projectId: pPipe }));
    const autoDecisionPipe: RequirementRefinementDecision = {
      ...autoOnlyDecision,
      drafts: autoDraftsPipe,
    };
    const refinedPipe = buildRefinedRequirements({ refinementDecision: autoDecisionPipe });
    const synthPipeBundle: PrepareRequirementRefinementDecisionResult = {
      normalizedText: autoDecisionPipe.normalizedText,
      drafts: autoDraftsPipe,
      gapViewModel: buildRequirementGapViewModel({
        normalizedText: autoDecisionPipe.normalizedText,
        drafts: autoDraftsPipe,
        gaps: [],
      }),
      refinementDecision: autoDecisionPipe,
      refinedRequirements: refinedPipe,
      readinessResult: evaluateRequirementReadiness(autoDecisionPipe),
    };
    const pipeFromRefinement = runPlanningPipeline({ projectId: pPipe, refinement: synthPipeBundle });
    assert(
      pipeFromRefinement.status === "READY" &&
        pipeFromRefinement.tasks != null &&
        pipeFromRefinement.tasks.tasks.length >= 1,
      "pipeline can complete through tasks when refinement bundle is already READY at the gate"
    );
    assert(
      pipeFromRefinement.earlyStopReason === undefined && pipeFromRefinement.pipelineStop === undefined,
      "successful READY pipeline must not set earlyStopReason or typed pipelineStop"
    );
    assert(
      (pipeFromRefinement.executedSteps ?? []).join(",") ===
        "stepFeatureEntryGate,stepFeatureGeneration,stepIaGeneration,stepScreenGeneration,stepTaskGeneration",
      "from_refinement pipeline executes the downstream planning steps in order"
    );
    assert(
      pipeFromRefinement.stageOutputCounts?.tasks === pipeFromRefinement.tasks?.tasks.length &&
        pipeFromRefinement.stageOutputCounts?.features === pipeFromRefinement.features?.features.length &&
        pipeFromRefinement.stageOutputCounts?.screens === pipeFromRefinement.screens?.screens.length,
      "stageOutputCounts mirror final artifact list lengths"
    );
    {
      const vmReady = buildPlanningPipelineResultViewModel(pipeFromRefinement);
      assert(vmReady.stopReason === null && vmReady.legacyEarlyStopReason === undefined, "READY view model has no stop reason");
      assert(
        vmReady.outputsPresent.tasks === true &&
          vmReady.outputsPresent.features === true &&
          vmReady.outputsPresent.screens === true &&
          vmReady.outputsPresent.iaResult === true,
        "READY view model marks downstream artifacts present"
      );
      const featNames = [...new Set(pipeFromRefinement.features!.features.map((f) => f.name.trim()))].sort((a, b) =>
        a.localeCompare(b)
      );
      assert(stableJson(vmReady.snapshots.featureNamesOrdered) === stableJson(featNames), "snapshot feature names match context");
      const routes = [...new Set(pipeFromRefinement.screens!.screens.map((s) => s.routePath.trim()))].sort((a, b) =>
        a.localeCompare(b)
      );
      assert(stableJson(vmReady.snapshots.screenRoutesOrdered) === stableJson(routes), "snapshot routes match context");
      const taskIds = [...pipeFromRefinement.tasks!.tasks]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((t) => t.id);
      assert(
        stableJson(vmReady.snapshots.taskIdsOrdered) === stableJson(taskIds) &&
          (vmReady.snapshots.taskIdsOrdered?.length ?? 0) === (vmReady.stageOutputCounts.tasks ?? 0),
        "snapshot task ids and count consistent with stageOutputCounts"
      );
      assert(
        (vmReady.snapshots.iaRootMenuCount ?? 0) ===
          pipeFromRefinement.iaResult!.menuNodes.filter((n) => n.parentId == null).length,
        "snapshot IA root count matches context"
      );
      const ucA = mvpRunPlanningPipelineUseCase({ projectId: pPipe, refinement: synthPipeBundle });
      const ucB = mvpRunPlanningPipelineUseCase({ projectId: pPipe, refinement: synthPipeBundle });
      assert(stableJson(ucA.viewModel) === stableJson(ucB.viewModel), "planning use-case view model is deterministic");
      assert(
        stableJson(buildPlanningPipelineResultViewModel(ucA.context)) === stableJson(ucA.viewModel),
        "view model builder matches use-case for READY refinement path"
      );
      assert(
        vmReady.readinessSummary != null &&
          vmReady.readinessSummary.isReady === true &&
          vmReady.readinessSummary.blockingIssueCount === 0 &&
          vmReady.readinessSummary.confirmRequiredCount === 0,
        "READY view model exposes readiness summary for handoff clarity"
      );
      assert(
        (vmReady.refinementSummary?.gapDecisionCount ?? 0) === pipeFromRefinement.refinementDecision!.decisions.length,
        "refinement summary gap decision count matches context"
      );

      const handoffPrep = mvpPrepareExecutionHandoffFromPlanningUseCase({ projectId: pPipe, refinement: synthPipeBundle });
      assert(handoffPrep.ok === true, "READY refinement path must produce execution handoff bundle");
      const hb = handoffPrep.bundle;
      assert(hb.pipelineStatus === "READY" && hb.projectId === pPipe, "handoff bundle carries READY and projectId");
      assert(
        stableJson(hb.features.features.map((f) => f.id).sort()) ===
          stableJson(pipeFromRefinement.features!.features.map((f) => f.id).sort()),
        "handoff feature ids match pipeline output"
      );
      assert(
        stableJson(hb.tasks.tasks.map((t) => t.id).sort()) ===
          stableJson(pipeFromRefinement.tasks!.tasks.map((t) => t.id).sort()),
        "handoff task ids match pipeline output"
      );
      assert(
        stableJson(hb.screens.screens.map((s) => s.id).sort()) ===
          stableJson(pipeFromRefinement.screens!.screens.map((s) => s.id).sort()),
        "handoff screen ids match pipeline output"
      );
      assert(validatePlanningExecutionHandoffFromContext(pipeFromRefinement).ok === true, "READY context passes handoff gate");
      assert(validatePlanningExecutionHandoff(hb).ok === true, "validatePlanningExecutionHandoff accepts READY bundle");
      assert(validatePlanningExecutionHandoff(pipeFromRefinement).ok === true, "dispatcher validates READY context");
      const builtCtx = buildPlanningExecutionHandoff(pipeFromRefinement);
      assert(
        builtCtx.ok === true && validatePlanningExecutionHandoffBundle(builtCtx.bundle).ok === true,
        "handoff builder plus post-validator succeeds on READY pipeline"
      );
      const badBundle = {
        ...builtCtx.bundle,
        traceMetadata: {
          ...builtCtx.bundle.traceMetadata,
          stageOutputCounts: { ...builtCtx.bundle.traceMetadata.stageOutputCounts, tasks: 999 },
        },
      };
      assert(validatePlanningExecutionHandoffBundle(badBundle).ok === false, "handoff validator rejects inconsistent trace task count");

      const execInput = mvpPrepareExecutionInputFromPlanningUseCase({ projectId: pPipe, refinement: synthPipeBundle });
      assert(execInput.ok === true, "READY planning yields execution preparation bundle via use-case");
      assert(execInput.bundle.source === "PLANNING_HANDOFF", "execution prep bundle is tagged from planning handoff");
      assert(
        execInput.bundle.context.featureCount === hb.features.features.length,
        "execution prep context featureCount matches handoff features"
      );
      assert(
        execInput.bundle.tasks.map((t) => t.id).join(",") === hb.tasks.tasks.map((t) => t.id).join(","),
        "execution preparation preserves handoff task order"
      );
      assert(
        execInput.bundle.tasks.every((t) => t.name.length > 0 && t.screenId.length > 0 && t.projectId === pPipe),
        "execution prep tasks carry non-empty prompt-relevant fields and projectId"
      );
      assert(
        execInput.bundle.tasks.every((t) => execInput.bundle.screens.some((s) => s.id === t.screenId)),
        "every execution prep task references a bundled screen ref"
      );
      const prepDirect = buildExecutionPreparationBundle(hb);
      assert(
        prepDirect.ok === true && validateExecutionPreparationBundle(prepDirect.bundle).ok === true,
        "handoff-to-execution adapter plus dry-run succeeds on validated handoff"
      );
      const dupTail = {
        ...execInput.bundle,
        tasks: [...execInput.bundle.tasks, execInput.bundle.tasks[execInput.bundle.tasks.length - 1]!],
      };
      assert(validateExecutionPreparationBundle(dupTail).ok === false, "execution prep dry-run rejects duplicate task id");
      const badScreenPrep = {
        ...execInput.bundle,
        tasks: execInput.bundle.tasks.map((t, i) =>
          i === 0 ? { ...t, screenId: "unknown-screen-id-selfcheck" } : t
        ),
      };
      assert(validateExecutionPreparationBundle(badScreenPrep).ok === false, "execution prep dry-run rejects unknown screen");
      const emptyRoute = {
        ...execInput.bundle,
        screens: execInput.bundle.screens.map((s, i) => (i === 0 ? { ...s, routePath: "   " } : s)),
      };
      assert(validateExecutionPreparationBundle(emptyRoute).ok === false, "execution prep rejects empty screen routePath");
      const dupScreen = {
        ...execInput.bundle,
        screens: [...execInput.bundle.screens, execInput.bundle.screens[execInput.bundle.screens.length - 1]!],
      };
      assert(validateExecutionPreparationBundle(dupScreen).ok === false, "execution prep rejects duplicate screen id");

      const dryBridge = dryRunExecutionBridge(execInput.bundle);
      assert(dryBridge.ok === true, "execution bridge dry-run succeeds without store seeding or startRun");
      assert(
        dryBridge.bridgeInput!.tasks.map((x) => x.taskId).join(",") === execInput.bundle.tasks.map((t) => t.id).join(","),
        "bridge dry-run preserves preparation task order"
      );
    }
    assert(pipeFromRefinement.features != null, "READY pipeline run materializes features");
    const altIa = generateStandardIa({ featureResult: pipeFromRefinement.features });
    assert(altIa.state === "GENERATED" && altIa.result != null, "standalone IA step matches pipeline preconditions");
    const altScreens = generateStandardScreens({ iaResult: altIa.result });
    assert(altScreens.state === "GENERATED" && altScreens.result != null, "standalone screen step matches pipeline");
    const altTasks = generateStandardTasks({ screenResult: altScreens.result });
    assert(
      altTasks.state === "GENERATED" &&
        altTasks.result != null &&
        pipeFromRefinement.tasks != null &&
        altTasks.result.tasks.length === pipeFromRefinement.tasks.tasks.length,
      "pipeline task output matches the same standalone module sequence applied to the pipeline feature result"
    );
  }

  {
    resetAll();
    const pB = "mvp-exec-bridge-entry";
    const autoDecisionB: RequirementRefinementDecision = {
      normalizedText: "Stable demo input for refinement-only readiness",
      drafts: [
        {
          id: `draft-auto-${pB}`,
          projectId: pB,
          description: "Browse posts in list and detail",
          source: "USER_INPUT",
          confidence: "HIGH",
        },
      ],
      decisions: [
        {
          gap: {
            code: "LIST_DETAIL_SCREENS",
            question: "Confirm list vs detail",
            severity: "INFO",
          },
          mode: "AUTO",
          reason: "synthetic bridge self-check row",
          resolvedValue:
            "Assumed UX: one list/browse screen and one detail screen for the same content type, with navigation between them.",
        },
      ],
    };
    const refinedB = buildRefinedRequirements({ refinementDecision: autoDecisionB });
    const synthB: PrepareRequirementRefinementDecisionResult = {
      normalizedText: autoDecisionB.normalizedText,
      drafts: [...autoDecisionB.drafts],
      gapViewModel: buildRequirementGapViewModel({
        normalizedText: autoDecisionB.normalizedText,
        drafts: autoDecisionB.drafts,
        gaps: [],
      }),
      refinementDecision: autoDecisionB,
      refinedRequirements: refinedB,
      readinessResult: evaluateRequirementReadiness(autoDecisionB),
    };
    const prepB = mvpPrepareExecutionInputFromPlanningUseCase({ projectId: pB, refinement: synthB });
    assert(prepB.ok === true, "bridge self-check obtains execution preparation bundle");
    const dryB = dryRunExecutionBridge(prepB.bundle);
    assert(dryB.ok === true && dryB.bridgeInput != null, "isolated dry-run for bridge entry project");
    const badPrep = { ...prepB.bundle, tasks: [], context: { ...prepB.bundle.context, taskCount: 0 } };
    assert(dryRunExecutionBridge(badPrep).ok === false, "malformed preparation fails dry-run before any execution");
    const startedB = await mvpStartExecutionFromPreparationUseCase(prepB.bundle);
    assert(startedB.ok === true, "guarded bridge path starts execution via mvpStartExecutionUseCase");
    const runSt = await getRunStatus(startedB.runId);
    assert(runSt != null, "bridge-started run is visible to executionService projections");
    const listedB = await listAllTasks(pB);
    assert(
      listedB.map((t) => t.id).join(",") === dryB.bridgeInput!.tasks.map((x) => x.taskId).join(","),
      "seeded MVP task order matches bridge input task ids"
    );
  }

  {
    const p = "mvp-domain-prompt-screen-aware";
    resetAll();
    const reqs: MvpRequirement[] = [
      { id: `req-1-${p}`, projectId: p, description: "Need a login screen", status: "CONFIRMED" },
      { id: `req-2-${p}`, projectId: p, description: "Need a settings screen", status: "CONFIRMED" },
    ];
    mvpSeedProjectRequirements(p, reqs);
    const tasks = generateMockupTasksFromRequirements(p);
    assert(tasks.length === 2, "expected 2 tasks from 2 requirements (MVP)");
    mvpSeedProjectTasks(p, tasks);

    const t0 = tasks[0]!;
    const t1 = tasks[1]!;
    const prompt0 = await mvpDefaultPromptProvider.generatePrompt(t0.id);
    const prompt1 = await mvpDefaultPromptProvider.generatePrompt(t1.id);
    assert(prompt0.includes("## 1.1 Screen context (domain-aware)"), "prompt includes screen context section");
    assert(prompt0.includes("UI Scope: this screen only"), "prompt includes UI scope constraint");
    assert(prompt0.includes("Route:"), "prompt includes route path");
    assert(prompt0.includes(`Generated for screen ${t0.screenId}`) === false, "prompt should not leak raw generator text");
    assert(prompt0 !== prompt1, "different screens should generate different prompts");
    assert(!prompt0.includes(tasks[1]!.title), "no cross-screen contamination by other task title");
    assert(prompt0.includes("### Flow context (preparation only)"), "prompt includes flow context block");
    assert(prompt0.includes("This screen is an ENTRY screen.") || prompt0.includes("This screen comes AFTER:"), "prompt has entry/previous flow line");
    assert(prompt0.includes("Next screen(s):"), "prompt includes next screen line");
    assert(prompt1.includes("This screen comes AFTER:"), "non-entry screen should come AFTER previous");

    // Parity check: extracted flow helpers should reproduce the same flow block.
    const screen0 = getScreenByTask(t0.id);
    assert(screen0 != null, "screen lookup for task");
    const graph0 = resolveFlowGraphForTask({ ...t0 }, screen0);
    assert(graph0 != null, "flow graph should resolve for domain-generated task");
    assert(
      stableJson(resolveScreenFlowLabelsForPrompt({ ...t0 }, screen0)) ===
        stableJson({
          graph: graph0,
          prevNames: resolvePreviousScreenNames(graph0, screen0.id),
          nextNames: resolveNextScreenNames(graph0, screen0.id),
        }),
      "resolveScreenFlowLabelsForPrompt must match explicit graph + prev/next name resolution"
    );
    const { prevNames, nextNames } = resolvePrevNextScreenNames(graph0, screen0.id);
    assert(
      stableJson({ prevNames, nextNames }) ===
        stableJson({
          prevNames: resolvePreviousScreenNames(graph0, screen0.id),
          nextNames: resolveNextScreenNames(graph0, screen0.id),
        }),
      "split prev/next screen name helpers must match combined resolver"
    );
    assert(
      prompt0 === buildTaskPrompt({ taskId: t0.id, projectId: p }),
      "generatePrompt output must match buildTaskPrompt rebuild (parity / no drift)"
    );
    const parsedFlow0 = parseFlowContextFromPrompt(prompt0);
    assert(
      hasFlowContextBlockInPrompt(prompt0) === parsedFlow0.hasFlowBlock,
      "hasFlowContextBlockInPrompt matches parseFlowContextFromPrompt"
    );
    assert(
      detectFlowValidationEnabledFromPrompt(prompt0) === parsedFlow0.flowValidationEnabled,
      "detectFlowValidationEnabledFromPrompt matches parseFlowContextFromPrompt"
    );
    const blockContent0 = parseFlowBlockContentFromPrompt(prompt0);
    assert(
      blockContent0.isEntry === parsedFlow0.isEntry &&
        stableJson(blockContent0.nextScreens) === stableJson(parsedFlow0.nextScreens),
      "parseFlowBlockContentFromPrompt matches parseFlowContextFromPrompt fields"
    );
    const modeFromPrompt0 = resolveFlowValidationModeFromPrompt(prompt0);
    assert(
      modeFromPrompt0.source === "prompt_substrings" &&
        modeFromPrompt0.hasFlowContextBlock === parsedFlow0.hasFlowBlock &&
        modeFromPrompt0.validationEnabled === parsedFlow0.flowValidationEnabled,
      "resolveFlowValidationModeFromPrompt matches parseFlowContextFromPrompt"
    );
    assert(resolveFlowValidationMode(prompt0) === "OFF", "default generated prompt keeps flow validation mode OFF");
    const blockNew = buildFlowContextPromptLines({ screen: screen0, graph: graph0, prevNames, nextNames }).join("\n");
    const blockLegacy = legacyBuildFlowContextPromptLines(screen0, graph0, prevNames, nextNames).join("\n");
    assert(blockNew === blockLegacy, "flow context helper parity (legacy vs new builder)");
    assert(prompt0.includes(blockNew.trim()), "prompt contains flow block built by helper");

    resetAll();
    const legacyPid = "mvp-legacy-task-prompt";
    mvpSeedProjectTasks(legacyPid, [baseTasks(legacyPid)[0]!]);
    const legacyTask = (await listAllTasks(legacyPid))[0]!;
    const legacyPrompt = await mvpDefaultPromptProvider.generatePrompt(legacyTask.id);
    assert(!legacyPrompt.includes("## 1.1 Screen context (domain-aware)"), "legacy tasks keep old prompt shape (no screen context)");
  }

  {
    resetAll();
    const p = "mvp-flow-reviewer";
    const reqs: MvpRequirement[] = [
      { id: `req-1-${p}`, projectId: p, description: "Need entry", status: "CONFIRMED" },
      { id: `req-2-${p}`, projectId: p, description: "Need next", status: "CONFIRMED" },
    ];
    mvpSeedProjectRequirements(p, reqs);
    const tasks = generateMockupTasksFromRequirements(p);
    mvpSeedProjectTasks(p, tasks);
    const entryTask = tasks[0]!;
    const entryPrompt = await mvpDefaultPromptProvider.generatePrompt(entryTask.id);
    const entryPromptWithFlowValidation = `${entryPrompt}\nFlow validation: ON\n`;
    assert(resolveFlowValidationMode(entryPromptWithFlowValidation) === "ON", "appended marker must flip mode to ON");

    const bad = await reviewTaskResult({
      taskId: entryTask.id,
      prompt: entryPromptWithFlowValidation,
      result: { summary: "mvp-cursor-ok", changedFiles: [`mvp/${entryTask.id}.ts`] },
    });
    assert(bad.status === "FAILED" && bad.flowValidation?.isConsistent === false, "reviewer detects missing flow tokens");
    const badEval = evaluateFlowValidation(entryPromptWithFlowValidation, { summary: "mvp-cursor-ok" });
    assert(badEval.enabled === true && badEval.issues.length > 0, "flow validation helper parity (bad)");
    assert(
      stableJson(badEval.issues) ===
        stableJson([
          "MISSING_SCREEN_ISOLATION_TOKEN: expected summary to include SCREEN_ONLY_OK",
          "MISSING_NAVIGATION_TOKEN: expected summary to include NAV_OK when next screens exist",
        ]),
      "flow validation issue strings must remain stable"
    );
    assert(
      Array.isArray(badEval.issueCodes) && badEval.issueCodes.join(",") === "MISSING_SCREEN_ISOLATION_TOKEN,MISSING_NAVIGATION_TOKEN",
      "flow validation should expose typed issue codes (internal)"
    );
    assert(
      (badEval.issueCodes ?? []).every((c, i) => MVP_FLOW_VALIDATION_ISSUE_MESSAGE[c] === badEval.issues[i]),
      "typed flow issues must map to the same outward issue strings"
    );
    const expectedBadReview = {
      status: "FAILED" as const,
      reason:
        "FLOW_VALIDATION_FAILED: MISSING_SCREEN_ISOLATION_TOKEN: expected summary to include SCREEN_ONLY_OK | MISSING_NAVIGATION_TOKEN: expected summary to include NAV_OK when next screens exist",
      retryable: true,
      flowValidation: {
        isConsistent: false,
        issues: [
          "MISSING_SCREEN_ISOLATION_TOKEN: expected summary to include SCREEN_ONLY_OK",
          "MISSING_NAVIGATION_TOKEN: expected summary to include NAV_OK when next screens exist",
        ],
      },
    };
    assert(
      stableJson({ status: bad.status, reason: bad.reason, retryable: bad.retryable, flowValidation: bad.flowValidation }) ===
        stableJson(expectedBadReview),
      "reviewer FAILED shape+reason parity (frozen snapshot)"
    );
    assert(
      stableJson(bad.flowValidation?.issues) === stableJson(badEval.issues),
      "reviewer flowValidation.issues must match evaluateFlowValidation issues (parity)"
    );
    const badSummary = parseResultSummary({ summary: "mvp-cursor-ok" });
    const badCodes = [
      validateScreenIsolationToken(badSummary),
      validateNavigationToken(badSummary, parseFlowContextFromPrompt(entryPromptWithFlowValidation).nextScreens.length),
      validateEntryScreenRule(badSummary, parseFlowContextFromPrompt(entryPromptWithFlowValidation).isEntry),
    ].filter((c): c is NonNullable<typeof c> => c != null);
    assert(
      stableJson(badCodes) === stableJson(["MISSING_SCREEN_ISOLATION_TOKEN", "MISSING_NAVIGATION_TOKEN"]),
      "token validators must agree with typed issue codes for bad summary"
    );

    const good = await reviewTaskResult({
      taskId: entryTask.id,
      prompt: entryPromptWithFlowValidation,
      result: { summary: "SCREEN_ONLY_OK NAV_OK", changedFiles: [`mvp/${entryTask.id}.ts`] },
    });
    assert(good.status === "PASSED" && good.flowValidation?.isConsistent === true, "reviewer allows valid flow tokens");
    const goodEval = evaluateFlowValidation(entryPromptWithFlowValidation, { summary: "SCREEN_ONLY_OK NAV_OK" });
    assert(goodEval.enabled === true && goodEval.issues.length === 0, "flow validation helper parity (good)");
    const expectedGoodReview = {
      status: "PASSED" as const,
      retryable: false,
      flowValidation: { isConsistent: true, issues: [] as string[] },
    };
    assert(
      stableJson({ status: good.status, reason: good.reason, retryable: good.retryable, flowValidation: good.flowValidation }) ===
        stableJson(expectedGoodReview),
      "reviewer PASSED shape parity (frozen snapshot)"
    );
    assert(
      stableJson(good.flowValidation?.issues) === stableJson(goodEval.issues),
      "reviewer PASSED flowValidation.issues must match evaluateFlowValidation (empty parity)"
    );

    resetAll();
    const legacyPid = "mvp-flow-reviewer-legacy";
    mvpSeedProjectTasks(legacyPid, [baseTasks(legacyPid)[0]!]);
    const legacyTask = (await listAllTasks(legacyPid))[0]!;
    const legacyPrompt = await mvpDefaultPromptProvider.generatePrompt(legacyTask.id);
    const legacyReview = await reviewTaskResult({
      taskId: legacyTask.id,
      prompt: legacyPrompt,
      result: { summary: "mvp-cursor-ok", changedFiles: [`mvp/${legacyTask.id}.ts`] },
    });
    assert(legacyReview.status === "PASSED", "legacy tasks still pass reviewer without flow tokens");
  }

  {
    resetAll();
    const p = "mvp-domain-ordering";
    mvpSeedProjectScreens(p, [
      { id: `screen-a-${p}`, projectId: p, name: "A", menuId: "m1", routePath: "/a", order: 1 },
      { id: `screen-b-${p}`, projectId: p, name: "B", menuId: "m1", routePath: "/b", order: 0 },
    ]);
    const tasks: Task[] = [
      { ...baseTasks(p)[0]!, id: `t-a-${p}`, finalOrder: 5, screenId: `screen-a-${p}`, taskPurpose: "MOCKUP" },
      { ...baseTasks(p)[1]!, id: `t-b-${p}`, finalOrder: 2, screenId: `screen-b-${p}`, taskPurpose: "MOCKUP" },
      { ...baseTasks(p)[0]!, id: `t-legacy-${p}`, finalOrder: 0 },
    ];
    const ordered = orderTasksByScreenFlow(tasks);
    assert(ordered[0]!.id === `t-b-${p}` && ordered[1]!.id === `t-a-${p}`, "tasks ordered by screen.order");
    assert(ordered[2]!.id === `t-legacy-${p}`, "legacy tasks placed after screen-aware tasks");
  }

  {
    resetAll();
    const p = "mvp-screen-flow";
    const screens: MvpScreen[] = [
      { id: `screen-0-${p}`, projectId: p, name: "Entry", menuId: "m1", routePath: "/entry", order: 0 },
      { id: `screen-1-${p}`, projectId: p, name: "Next", menuId: "m1", routePath: "/next", order: 1 },
      { id: `screen-2-${p}`, projectId: p, name: "Last", menuId: "m1", routePath: "/last", order: 2 },
    ];
    const g = generateScreenFlow(screens);
    const ok = validateScreenFlow(g);
    assert(ok.ok === true, "generated screen flow should validate");
    const ord = getOrderedScreensFromFlow(g);
    assert(ord.map((s) => s.id).join(",") === screens.map((s) => s.id).join(","), "ordered screens follow linear flow");
    assert(
      findNavigationEntryScreen(g)?.id === screens[0]!.id,
      "findNavigationEntryScreen matches linear NAVIGATION entry"
    );
    assert(isEntryScreen(g, screens[0]!.id) === true, "entry screen detection");
    assert(getNextScreens(g, screens[0]!.id)[0] === screens[1]!.id, "next screen helper");
    assert(getPreviousScreens(g, screens[2]!.id)[0] === screens[1]!.id, "previous screen helper");
    assert(getScreenDepth(g, screens[0]!.id) === 0 && getScreenDepth(g, screens[2]!.id) === 2, "screen depth helper");

    const tasks: Task[] = [
      { ...baseTasks(p)[0]!, id: `t1-${p}`, finalOrder: 0, screenId: screens[1]!.id, taskPurpose: "MOCKUP" },
      { ...baseTasks(p)[0]!, id: `t0-${p}`, finalOrder: 0, screenId: screens[0]!.id, taskPurpose: "MOCKUP" },
      { ...baseTasks(p)[0]!, id: `t2-${p}`, finalOrder: 0, screenId: screens[2]!.id, taskPurpose: "MOCKUP" },
      { ...baseTasks(p)[0]!, id: `tLegacy-${p}`, finalOrder: 0 },
    ];
    const orderedTasks = orderTasksByScreenFlowGraph(tasks, g.screens, g.edges);
    assert(
      orderedTasks.slice(0, 3).map((t) => (t as { screenId?: string }).screenId).join(",") ===
        screens.map((s) => s.id).join(","),
      "tasks are ordered by screen flow order"
    );
    assert(orderedTasks[3]!.id === `tLegacy-${p}`, "legacy task remains supported after flow tasks");
  }

  {
    const sampleRun: ExecutionRun = {
      id: "run-rt",
      projectId: "p-rt",
      status: "RUNNING",
      currentTaskIndex: 1,
      tasks: [
        {
          taskId: "a",
          status: "SUCCESS",
          retryCount: 0,
          lastFailureCode: "REVIEW_FAILED",
          lastFailureMessage: "x",
          lastFailureRetryable: false,
          totalExecuteAttempts: 2,
        },
        { taskId: "b", status: "PENDING", retryCount: 1 },
      ],
    };
    const { run: runRow, tasks: taskRows } = splitExecutionRunForPersistence(sampleRun);
    assert(runRow.id === sampleRun.id && runRow.projectId === sampleRun.projectId && runRow.status === sampleRun.status, "run row keys");
    assert(runRow.currentTaskIndex === sampleRun.currentTaskIndex, "currentTaskIndex preserved");
    assert(taskRows.length === 2 && taskRows[0]!.taskId === "a" && taskRows[1]!.sortOrder === 1, "task rows preserve order");
    const merged = mergePersistedRunParts(runRow, taskRows);
    assert(merged.id === sampleRun.id && merged.tasks.length === sampleRun.tasks.length, "merge restores run");
    assert(merged.tasks[0]!.lastFailureCode === "REVIEW_FAILED" && merged.tasks[0]!.totalExecuteAttempts === 2, "task snapshot fields round-trip");
    assert(merged.tasks[1]!.retryCount === 1 && merged.tasks[1]!.status === "PENDING", "second task preserved");

    const step: MvpExecutionStepRecord = {
      runId: "r1",
      taskId: "t1",
      sequence: 3,
      stepType: "CURSOR_FAILED",
      status: "FAILURE",
      message: "boom",
      timestamp: 1700000000000,
      failurePayload: {
        failureCode: "CURSOR_FAILED",
        failureMessage: "boom",
        retryable: true,
        sourceStepType: "CURSOR_FAILED",
      },
    };
    const persistedStep = mvpStepRecordToPersistedRow(step);
    assert(persistedStep.sequence === 3 && persistedStep.failurePayloadJson != null, "step row carries sequence and JSON");
    const stepBack = mvpPersistedRowToStepRecord(persistedStep);
    assert(
      stepBack.failurePayload?.failureCode === "CURSOR_FAILED" &&
        stepBack.failurePayload.retryable === true &&
        stepBack.stepType === "CURSOR_FAILED",
      "structured failure survives JSON round-trip"
    );

    const metaRow = runMetaToPersistedRow("rid", { failureReason: "TASK_NOT_FOUND:gone" });
    assert(persistedMetaRowToRunMeta(metaRow).failureReason === "TASK_NOT_FOUND:gone", "run meta mapping");

    let draftRunThrew = false;
    try {
      new MvpDraftPrismaRunStoreAdapter().get("x");
    } catch (e) {
      draftRunThrew = e instanceof Error && e.message.includes("NOT_IMPLEMENTED_IN_MVP");
    }
    assert(draftRunThrew, "draft Prisma run adapter must be isolated (throws)");

    let draftStepThrew = false;
    try {
      new MvpDraftPrismaStepStoreAdapter().getStepsForRun("x");
    } catch (e) {
      draftStepThrew = e instanceof Error && e.message.includes("NOT_IMPLEMENTED_IN_MVP");
    }
    assert(draftStepThrew, "draft Prisma step adapter must be isolated (throws)");
  }

  resetAll();
  mvpSeedProjectTasks(pid, []);
  const blocked = await mvpStartRunIfReady(pid);
  assert(blocked.ok === false && blocked.reason === "NOT_READY", "facade must reject start when not ready");
  assert(blocked.readiness.isReady === false, "readiness DTO must reflect blockers");
  assert(blocked.readiness.blockers.length > 0, "not-ready readiness must list blockers");

  {
    assert(
      MVP_EXECUTION_APPLICATION_LAYER_ID === "jyorchestration:application:mvp-execution",
      "application layer id must remain JYOrchestration-scoped (no external package coupling)"
    );
    const app = new MvpExecutionApplicationService();
    const appReadiness = await app.getReadiness({ projectId: pid });
    assert(appReadiness.ok === true && appReadiness.code === MVP_EXECUTION_APP_CODE.OK, "application getReadiness ok shape");
    assert(
      appReadiness.readiness.isReady === false &&
        appReadiness.readiness.blockers.join(",") === blocked.readiness.blockers.join(","),
      "application getReadiness must match MVP facade readiness"
    );
    const appStart = await app.startRun({ projectId: pid });
    assert(
      appStart.ok === false &&
        appStart.code === MVP_EXECUTION_APP_CODE.NOT_READY &&
        appStart.readiness.isReady === false,
      "application startRun must respect readiness (no run when not ready)"
    );
  }

  {
    const uReadiness = await mvpPrepareExecutionUseCase({ projectId: pid });
    assert(stableJson(uReadiness) === stableJson(await new MvpExecutionApplicationService().getReadiness({ projectId: pid })), "use-case prepare parity with facade");
    const uStart = await mvpStartExecutionUseCase({ projectId: pid });
    assert(stableJson(uStart) === stableJson(await new MvpExecutionApplicationService().startRun({ projectId: pid })), "use-case start parity with facade");
  }

  resetAll();
  mvpSeedProjectTasks(pid, baseTasks(pid));
  const viaFacade = await mvpStartRunIfReady(pid);
  assert(viaFacade.ok === true, "facade must start when ready");
  const r1 = viaFacade.run;
  assert(r1.status === "SUCCESS", "two tasks should both succeed");
  assert(r1.tasks.every((t) => t.status === "SUCCESS"), "all task states SUCCESS");
  const steps1 = mvpGetExecutionStepsForRun(r1.id);
  for (let i = 1; i < steps1.length; i += 1) {
    assert(steps1[i]!.sequence === steps1[i - 1]!.sequence + 1, "step sequence must be strictly monotonic");
  }
  const types1 = steps1.map((s) => s.stepType);
  assert(types1.includes("RUN_SUCCESS"), "successful run should log RUN_SUCCESS");
  assert(types1.filter((t) => t === "TASK_COMPLETED").length === 2, "two tasks should log TASK_COMPLETED");
  const tid0 = r1.tasks[0]!.taskId;
  const taskSteps0 = mvpGetExecutionStepsForTask(r1.id, tid0);
  assert(taskSteps0.length > 0, "task-scoped steps should exist for first task");
  assert(taskSteps0.every((s) => s.taskId === tid0), "task filter must only return matching taskId");
  assert(mvpGetLastFailureStepForRun(r1.id) === undefined, "successful run should have no failure step");
  assert(mvpSummarizeExecutionStepFlow(r1.id).length > 0, "flow summary must be non-empty");
  const sumOk = await mvpProjectRunSummary(r1.id);
  assert(sumOk != null, "run summary should exist");
  assert(sumOk.runStatus === "SUCCESS", "summary status SUCCESS");
  assert(sumOk.totalTasks === 2 && sumOk.completedTasks === 2 && sumOk.failedTasks === 0, "summary task counts");
  assert(sumOk.totalStepCount === steps1.length, "summary step count should match log length");
  assert(sumOk.lastFailureCode == null && sumOk.lastFailureMessage == null, "no last failure on success");
  const dtoOk = await mvpGetRunSummaryDto(r1.id);
  assert(dtoOk?.runStatus === "SUCCESS" && dtoOk.totalStepCount === steps1.length, "facade run summary DTO after success");
  const stepDtosOk = mvpGetStepSummaryDtos(r1.id);
  assert(stepDtosOk.length === steps1.length, "facade step DTOs must match log length");
  assert(
    stepDtosOk.every((d, i) => d.sequence === steps1[i]!.sequence && d.stepType === steps1[i]!.stepType),
    "step DTOs must preserve sequence and type from port-backed log"
  );
  assert(mvpGetStepFlowSummary(r1.id).includes("RUN_SUCCESS"), "step flow summary must mention RUN_SUCCESS");
  const readinessDto = await mvpCheckReadinessDto({ projectId: pid });
  assert(readinessDto.isReady === true && readinessDto.projectId === pid, "readiness DTO should be ready after seed");

  const portSteps = mvpExecutionPortsBundle().stepStore.getStepsForRun(r1.id);
  assert(
    portSteps.length === steps1.length &&
      portSteps.every((s, i) => s.sequence === steps1[i]!.sequence && s.message === steps1[i]!.message),
    "StepStore view must match executionStepLog reader"
  );

  const detailOk = await mvpGetRunDetailDto(r1.id);
  assert(detailOk != null && detailOk.runStatus === "SUCCESS", "run detail DTO after success");
  assert(detailOk.tasks.length === 2 && detailOk.tasks.every((t) => t.status === "SUCCESS"), "detail tasks SUCCESS");
  assert(detailOk.totalStepCount === steps1.length, "detail step count");
  assert(
    detailOk.retrySummary.automaticRetrySteps === 0 && detailOk.retrySummary.totalTaskRetryCount === 0,
    "detail retry summary on happy path"
  );
  assert(detailOk.latestFailurePayload === undefined, "no structured failure payload on success detail");
  assert(
    detailOk.stepFlowSummary != null && detailOk.stepFlowSummary.includes("RUN_SUCCESS"),
    "detail step flow summary"
  );

  const inspectOk = await mvpBuildRunInspectionViewModel({ projectId: pid, runId: r1.id });
  assert(inspectOk.runId === r1.id && inspectOk.projectId === pid, "inspection keys");
  assert(inspectOk.readiness.isReady === true, "inspection bundles readiness");
  assert(inspectOk.runSummary?.runStatus === "SUCCESS" && inspectOk.runSummary.totalStepCount === steps1.length, "inspection summary");
  assert(inspectOk.runDetail?.tasks.length === 2 && inspectOk.runDetail.runStatus === "SUCCESS", "inspection detail");
  assert(inspectOk.steps.length === steps1.length && inspectOk.stepFlowSummary.includes("RUN_SUCCESS"), "inspection steps + flow");

  {
    const app = new MvpExecutionApplicationService();
    const appSum = await app.getRunSummary({ runId: r1.id });
    assert(appSum.ok === true && appSum.code === MVP_EXECUTION_APP_CODE.OK, "application getRunSummary success code");
    assert(
      appSum.summary.runId === dtoOk?.runId &&
        appSum.summary.runStatus === dtoOk?.runStatus &&
        appSum.summary.totalStepCount === dtoOk?.totalStepCount,
      "application getRunSummary must match facade DTO"
    );
    const appDet = await app.getRunDetail({ runId: r1.id });
    assert(appDet.ok === true && appDet.code === MVP_EXECUTION_APP_CODE.OK, "application getRunDetail success code");
    assert(stableJson(appDet.detail) === stableJson(detailOk), "application getRunDetail JSON parity vs facade");

    const appSteps = await app.getStepList({ runId: r1.id });
    assert(appSteps.ok === true && appSteps.code === MVP_EXECUTION_APP_CODE.OK, "application getStepList success code");
    assert(stableJson(appSteps.steps) === stableJson(stepDtosOk), "application step list JSON parity vs facade");
    assert(appSteps.stepFlowSummary === inspectOk.stepFlowSummary, "application step flow must match facade inspection flow");

    const appInsp = await app.getRunInspection({ projectId: pid, runId: r1.id });
    assert(appInsp.ok === true && appInsp.code === MVP_EXECUTION_APP_CODE.OK, "application getRunInspection success code");
    assert(stableJson(appInsp.inspection) === stableJson(inspectOk), "application getRunInspection JSON parity vs facade VM");
  }

  {
    const ucSum = await mvpGetExecutionRunSummaryUseCase({ runId: r1.id });
    const ucDet = await mvpGetExecutionRunDetailUseCase({ runId: r1.id });
    const ucSteps = await mvpGetExecutionStepListUseCase({ runId: r1.id });
    const ucInsp = await mvpGetExecutionInspectionUseCase({ projectId: pid, runId: r1.id });
    assert(stableJson(ucSum) === stableJson(await new MvpExecutionApplicationService().getRunSummary({ runId: r1.id })), "use-case summary parity");
    assert(stableJson(ucDet) === stableJson(await new MvpExecutionApplicationService().getRunDetail({ runId: r1.id })), "use-case detail parity");
    assert(stableJson(ucSteps) === stableJson(await new MvpExecutionApplicationService().getStepList({ runId: r1.id })), "use-case step list parity");
    assert(stableJson(ucInsp) === stableJson(await new MvpExecutionApplicationService().getRunInspection({ projectId: pid, runId: r1.id })), "use-case inspection parity");

    const statusView = buildMvpExecutionStatusView({
      runId: r1.id,
      summary: ucSum.ok ? ucSum.summary : null,
      detail: ucDet.ok ? ucDet.detail : null,
      steps: ucSteps.ok ? ucSteps.steps : [],
      stepFlowSummary: ucSteps.ok ? ucSteps.stepFlowSummary : "",
      inspection: ucInsp.ok ? ucInsp.inspection : null,
    });
    assert(statusView.runId === r1.id && statusView.summary?.runId === r1.id, "status view composition basics");
  }

  let threw = false;
  try {
    buildTaskPrompt({ taskId: tid0, projectId: "wrong-project" });
  } catch {
    threw = true;
  }
  assert(threw, "buildTaskPrompt must reject cross-project contract mismatch");

  {
    const pStart = "mvp-app-start-parity";
    resetAll();
    mvpSeedProjectTasks(pStart, baseTasks(pStart));
    const facadeStart = await mvpStartRunIfReady(pStart);
    assert(facadeStart.ok === true, "facade baseline start when ready");
    const summaryViaFacade = await mvpGetRunSummaryDto(facadeStart.run.id);
    resetAll();
    mvpSeedProjectTasks(pStart, baseTasks(pStart));
    const appSvc = new MvpExecutionApplicationService();
    const appStart = await appSvc.startRun({ projectId: pStart });
    assert(
      appStart.ok === true && appStart.code === MVP_EXECUTION_APP_CODE.OK,
      "application startRun when ready must succeed"
    );
    const summaryViaAppRes = await appSvc.getRunSummary({ runId: appStart.runId });
    assert(
      summaryViaAppRes.ok === true && summaryViaAppRes.code === MVP_EXECUTION_APP_CODE.OK,
      "getRunSummary after successful startRun must succeed"
    );
    const summaryViaApp = summaryViaAppRes.summary;
    assert(
      summaryViaFacade?.runStatus === summaryViaApp?.runStatus &&
        summaryViaFacade?.totalTasks === summaryViaApp?.totalTasks &&
        summaryViaFacade?.completedTasks === summaryViaApp?.completedTasks &&
        summaryViaFacade?.failedTasks === summaryViaApp?.failedTasks &&
        summaryViaFacade?.totalStepCount === summaryViaApp?.totalStepCount,
      "application startRun path must match MVP facade run outcome (summary parity)"
    );
  }

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpConfigureReviewFailures(baseTasks(pid)[0]!.id, 1);
  const r2 = await startRun(pid);
  assert(r2.status === "SUCCESS", "review fail once then pass on retry");
  assert(r2.tasks[0]!.status === "SUCCESS", "single task SUCCESS after one forced review failure");

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpCursorFailNextWaits(1);
  const rCursorRetry = await startRun(pid);
  assert(rCursorRetry.status === "SUCCESS", "cursor failure once should retry on same task then succeed");
  assert(rCursorRetry.tasks[0]!.retryCount === 1, "one in-run retry should increment retryCount");
  const stepsCur = mvpGetExecutionStepsForRun(rCursorRetry.id);
  const typesCur = stepsCur.map((s) => s.stepType);
  const iFail = typesCur.indexOf("CURSOR_FAILED");
  const iSched = typesCur.indexOf("TASK_RETRY_SCHEDULED");
  const iDone = typesCur.indexOf("CURSOR_COMPLETED");
  assert(iFail >= 0 && iSched > iFail && iDone > iSched, "cursor retry path should log fail, retry schedule, then completion");

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpReviewForceNonRetryableOnce(baseTasks(pid)[0]!.id);
  const rNonRetry = await startRun(pid);
  assert(rNonRetry.status === "FAILED", "non-retryable review must fail the run without further retries");
  const stNonRetry = await getRunStatus(rNonRetry.id);
  assert(stNonRetry.failureReason?.includes("REVIEW_FAILED"), "failure reason should reference REVIEW_FAILED");
  const stepsNr = mvpGetExecutionStepsForRun(rNonRetry.id);
  const typesNr = stepsNr.map((s) => s.stepType);
  assert(typesNr.includes("REVIEW_FAILED"), "non-retryable path should log REVIEW_FAILED");
  const iRunFail = typesNr.indexOf("RUN_FAILED");
  const iRevFail = typesNr.indexOf("REVIEW_FAILED");
  assert(iRunFail > iRevFail, "RUN_FAILED should follow REVIEW_FAILED in the log");
  assert(!typesNr.includes("TASK_RETRY_SCHEDULED"), "non-retryable review must not schedule task retry");
  const lastFailNr = mvpGetLastFailureStepForRun(rNonRetry.id);
  assert(lastFailNr != null && lastFailNr.status === "FAILURE", "last failure step must exist for failed run");
  assert(
    lastFailNr.failurePayload != null &&
      lastFailNr.failurePayload.failureCode === "REVIEW_FAILED" &&
      lastFailNr.failurePayload.sourceStepType === "REVIEW_FAILED",
    "failure step must preserve structured failure payload"
  );
  const sumFail = await mvpProjectRunSummary(rNonRetry.id);
  assert(sumFail?.runStatus === "FAILED" && sumFail.failedTasks === 1, "summary should reflect failed run");
  assert(sumFail?.lastFailureMessage != null, "summary should surface last failure message");
  assert(
    sumFail?.lastFailurePayload?.failureCode === "REVIEW_FAILED" && sumFail.lastFailurePayload.retryable === false,
    "run summary projection must carry structured failure from step"
  );
  const dtoFail = await mvpGetRunSummaryDto(rNonRetry.id);
  assert(
    dtoFail?.runStatus === "FAILED" &&
      dtoFail.lastFailurePayload?.failureCode === "REVIEW_FAILED" &&
      dtoFail.lastFailurePayload.sourceStepType === "REVIEW_FAILED",
    "facade run summary DTO must expose structured failure after failure"
  );
  const stepDtosFail = mvpGetStepSummaryDtos(rNonRetry.id);
  const reviewFailDto = stepDtosFail.find((d) => d.stepType === "REVIEW_FAILED");
  assert(
    reviewFailDto?.failurePayload?.failureCode === "REVIEW_FAILED" && reviewFailDto.failurePayload.retryable === false,
    "step summary DTOs must include failurePayload on failure steps"
  );

  const detailFail = await mvpGetRunDetailDto(rNonRetry.id);
  assert(detailFail != null && detailFail.runStatus === "FAILED", "run detail DTO after failure");
  assert(detailFail.tasks.length === 1 && detailFail.tasks[0]!.status === "FAILED", "detail task FAILED");
  assert(
    detailFail.latestFailurePayload?.failureCode === "REVIEW_FAILED" && detailFail.latestFailurePayload.retryable === false,
    "run detail DTO must preserve structured failure"
  );
  assert(detailFail.totalStepCount === stepsNr.length, "detail step count matches log");
  assert(
    detailFail.stepFlowSummary != null && detailFail.stepFlowSummary.includes("REVIEW_FAILED"),
    "detail flow includes failing step"
  );

  const inspectFail = await mvpBuildRunInspectionViewModel({ projectId: pid, runId: rNonRetry.id });
  assert(inspectFail.runSummary?.runStatus === "FAILED" && inspectFail.runDetail?.runStatus === "FAILED", "inspection after failure");
  assert(
    inspectFail.runDetail?.latestFailurePayload?.failureCode === "REVIEW_FAILED" &&
      inspectFail.runSummary?.lastFailurePayload?.failureCode === "REVIEW_FAILED",
    "inspection preserves structured failure across summary and detail"
  );
  assert(
    inspectFail.steps.some((s) => s.stepType === "REVIEW_FAILED" && s.failurePayload?.failureCode === "REVIEW_FAILED"),
    "inspection step list carries failure payload"
  );
  assert(inspectFail.stepFlowSummary.includes("REVIEW_FAILED"), "inspection flow includes failure");

  {
    const app = new MvpExecutionApplicationService();
    const appSum = await app.getRunSummary({ runId: rNonRetry.id });
    assert(appSum.ok === true && appSum.code === MVP_EXECUTION_APP_CODE.OK, "application getRunSummary ok on failure run");
    assert(
      appSum.summary.runStatus === "FAILED" && appSum.summary.lastFailurePayload?.failureCode === "REVIEW_FAILED",
      "application summary on failure path"
    );
    assert(stableJson(appSum.summary.lastFailurePayload) === stableJson(dtoFail?.lastFailurePayload), "summary failure payload parity");

    const appDet = await app.getRunDetail({ runId: rNonRetry.id });
    assert(appDet.ok === true && appDet.code === MVP_EXECUTION_APP_CODE.OK, "application getRunDetail ok on failure run");
    assert(
      appDet.detail.runStatus === "FAILED" && appDet.detail.latestFailurePayload?.failureCode === "REVIEW_FAILED",
      "application detail on failure path"
    );
    assert(stableJson(appDet.detail.latestFailurePayload) === stableJson(detailFail?.latestFailurePayload), "detail failure payload parity");

    const appSteps = await app.getStepList({ runId: rNonRetry.id });
    assert(appSteps.ok === true && appSteps.code === MVP_EXECUTION_APP_CODE.OK, "application getStepList ok on failure run");
    assert(stableJson(appSteps.steps) === stableJson(stepDtosFail), "failure step list JSON parity vs facade");
    assert(appSteps.stepFlowSummary === inspectFail.stepFlowSummary, "failure step flow parity vs facade inspection");

    const appInsp = await app.getRunInspection({ projectId: pid, runId: rNonRetry.id });
    assert(appInsp.ok === true && appInsp.code === MVP_EXECUTION_APP_CODE.OK, "application getRunInspection ok on failure run");
    assert(
      appInsp.inspection.runDetail?.latestFailurePayload?.failureCode === "REVIEW_FAILED" &&
        appInsp.inspection.runSummary?.lastFailurePayload?.failureCode === "REVIEW_FAILED",
      "application inspection preserves structured failure"
    );
    assert(stableJson(appInsp.inspection) === stableJson(inspectFail), "failure inspection JSON parity vs facade VM");
  }

  {
    const app = new MvpExecutionApplicationService();
    const badPidReadiness = await app.getReadiness({ projectId: "  \t  " });
    assert(
      badPidReadiness.ok === false && badPidReadiness.code === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "application getReadiness rejects blank projectId"
    );
    const envBadPid = routeEnvelopeDraftFromGetReadinessResult(badPidReadiness);
    assert(
      envBadPid.success === false &&
        envBadPid.appCode === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID &&
        envBadPid.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID],
      "envelope maps INVALID_PROJECT_ID from getReadiness"
    );
    const badPidStart = await app.startRun({ projectId: "" });
    assert(
      badPidStart.ok === false && badPidStart.code === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "application startRun rejects blank projectId"
    );
    const badRid = await app.getRunSummary({ runId: " \n " });
    assert(badRid.ok === false && badRid.code === MVP_EXECUTION_APP_CODE.INVALID_RUN_ID, "application rejects blank runId");
    const envBadRid = routeEnvelopeDraftFromGetRunSummaryResult(badRid);
    assert(
      envBadRid.success === false &&
        envBadRid.appCode === MVP_EXECUTION_APP_CODE.INVALID_RUN_ID &&
        envBadRid.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.INVALID_RUN_ID],
      "envelope maps INVALID_RUN_ID from getRunSummary"
    );
    const missingRun = await app.getRunSummary({ runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingRun.ok === false && missingRun.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application maps unknown run to RUN_NOT_FOUND"
    );
    const envMissSum = routeEnvelopeDraftFromGetRunSummaryResult(missingRun);
    assert(
      envMissSum.success === false &&
        envMissSum.appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND &&
        envMissSum.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND],
      "envelope maps RUN_NOT_FOUND from getRunSummary"
    );
    const missingDetail = await app.getRunDetail({ runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingDetail.ok === false && missingDetail.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application getRunDetail RUN_NOT_FOUND"
    );
    const envMissDet = routeEnvelopeDraftFromGetRunDetailResult(missingDetail);
    assert(
      envMissDet.success === false && envMissDet.appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "envelope maps RUN_NOT_FOUND from getRunDetail"
    );
    const missingSteps = await app.getStepList({ runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingSteps.ok === false && missingSteps.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application getStepList RUN_NOT_FOUND"
    );
    assert(
      routeEnvelopeDraftFromGetStepListResult(missingSteps).appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "envelope maps RUN_NOT_FOUND from getStepList"
    );
    const missingInsp = await app.getRunInspection({ projectId: pid, runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingInsp.ok === false && missingInsp.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application getRunInspection RUN_NOT_FOUND"
    );
    assert(
      routeEnvelopeDraftFromGetRunInspectionResult(missingInsp).appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "envelope maps RUN_NOT_FOUND from getRunInspection"
    );
    const badInspPid = await app.getRunInspection({ projectId: "", runId: rNonRetry.id });
    assert(
      badInspPid.ok === false && badInspPid.code === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "application getRunInspection rejects blank projectId"
    );
    assert(
      routeEnvelopeDraftFromGetRunInspectionResult(badInspPid).appCode === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "envelope maps INVALID_PROJECT_ID from getRunInspection"
    );
  }

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpCursorFailNextWaits(DEFAULT_MAX_RETRY_COUNT + 2);
  const r3 = await startRun(pid);
  assert(r3.status === "FAILED", "cursor failures beyond retry budget should fail the run");
  const st3 = await getRunStatus(r3.id);
  assert(st3.failureReason?.includes("CURSOR_FAILED"), "failure reason should mention CURSOR_FAILED");
  assert(mvpGetRetryCountFromSteps(r3.id) === DEFAULT_MAX_RETRY_COUNT, "retry steps should match policy budget");
  const sumCurFail = await mvpProjectRunSummary(r3.id);
  assert(sumCurFail?.failedTasks === 1 && sumCurFail.lastFailureCode === "CURSOR_FAILED", "summary last failure code");

  resetAll();
  mvpSeedProjectTasks(pid, []);
  const ready = await evaluateExecutionReadiness({ projectId: pid });
  assert(ready.isReady === false, "empty explicit seed => not ready");
  assert(ready.blockers.includes("NO_EXECUTABLE_TASKS"), "expected NO_EXECUTABLE_TASKS blocker");

  resetAll();
  mvpSeedProjectTasks(pid, [{ ...baseTasks(pid)[0]!, finalOrder: -1 }]);
  const rNeg = await evaluateExecutionReadiness({ projectId: pid });
  assert(rNeg.isReady === false, "negative finalOrder should not be ready");
  assert(rNeg.blockers.includes("FINAL_ORDER_NEGATIVE"), "expected FINAL_ORDER_NEGATIVE blocker");

  resetAll();
  const ta = `t-a-${pid}`;
  const tb = `t-b-${pid}`;
  mvpSeedProjectTasks(pid, [
    { ...baseTasks(pid)[0]!, status: "DRAFT" },
    { ...baseTasks(pid)[1]! },
  ]);
  const conf = await confirmTask({ taskId: ta, actorId: "actor-1" });
  assert(conf.confirmed === true, "confirmTask should set CONFIRMED when task exists");
  const ord = await reorderTasks({ projectId: pid, orderedTaskIds: [tb, ta] });
  assert(ord.ok === true, "reorderTasks should succeed when ids are a valid permutation");
  const listed = await listAllTasks(pid);
  const byOrder = [...listed].sort((a, b) => a.finalOrder - b.finalOrder).map((t) => t.id);
  assert(byOrder[0] === tb && byOrder[1] === ta, "reorderTasks should update finalOrder in memory");

  resetAll();
  const tidMax = `t-max-retry-${pid}`;
  const ridMax = mvpTestInstallRunAtRetryLimit({ projectId: pid, taskId: tidMax });
  const beforeMax = await getRunStatus(ridMax);
  const stepsBefore = mvpGetExecutionStepsForRun(ridMax);
  assert(beforeMax.tasks[0]!.retryCount === DEFAULT_MAX_RETRY_COUNT, "fixture at max retry");
  await retryTask(ridMax, tidMax);
  const stepsAfter = mvpGetExecutionStepsForRun(ridMax);
  assert(stepsAfter.length === stepsBefore.length, "rejected retryTask must not append step log entries");
  const afterMax = await getRunStatus(ridMax);
  assert(afterMax.tasks[0]!.retryCount === DEFAULT_MAX_RETRY_COUNT, "retryTask must not bypass max retry");
  assert(afterMax.tasks[0]!.status === "FAILED", "task should stay FAILED when retry is rejected");
  assert(afterMax.status === "RUNNING", "synthetic run stays RUNNING for policy-only check");

  resetAll();
  const tidNr = `t-nonretry-retry-${pid}`;
  const ridNr = mvpTestInstallRunWithNonRetryableFailure({ projectId: pid, taskId: tidNr });
  await retryTask(ridNr, tidNr);
  const afterNr = await getRunStatus(ridNr);
  assert(afterNr.tasks[0]!.retryCount === 0, "retryTask must not run after non-retryable failure");
  assert(afterNr.tasks[0]!.status === "FAILED", "task should remain FAILED when manual retry is rejected");

  resetAll();
  {
    const { bundle: fakeOkBundle, counters: cOk } = createMvpFakeExecutionPortsBundle({ reviewPass: true });
    mvpSetExecutionPortsBundleForTesting(fakeOkBundle);
    mvpResetExecutionState();
    const fakeStart = await mvpStartRunIfReady("mvp-fake-ok-project");
    assert(fakeStart.ok === true, "orchestration must drive execution through injected fake bundle");
    assert(
      cOk.getExecutableTasks >= 1 &&
        cOk.generatePrompt >= 1 &&
        cOk.submitTaskPrompt >= 1 &&
        cOk.waitForCompletion >= 1 &&
        cOk.reviewTaskResult >= 1,
      "fake Task/Prompt/Cursor/Review adapters must be invoked"
    );
    assert(cOk.stepAppend >= 1, "injected StepStore.append must be used");
    const fakeDetail = await mvpGetRunDetailDto(fakeStart.run.id);
    assert(
      fakeDetail?.runStatus === "SUCCESS" && fakeDetail.tasks.length === 1 && fakeDetail.tasks[0]!.taskId === "fake-task-1",
      "fake run detail DTO"
    );
    assert(
      fakeDetail?.totalStepCount === fakeOkBundle.stepStore.getStepsForRun(fakeStart.run.id).length,
      "detail step count must follow injected StepStore"
    );

    const { bundle: fakeEmptyBundle, counters: cEmpty } = createMvpFakeExecutionPortsBundle({
      emptyExecutableSet: true,
    });
    mvpSetExecutionPortsBundleForTesting(fakeEmptyBundle);
    mvpResetExecutionState();
    const fakeBlocked = await mvpStartRunIfReady("mvp-fake-empty");
    assert(fakeBlocked.ok === false && fakeBlocked.reason === "NOT_READY", "facade rejects start when fake tasks empty");
    assert(cEmpty.getExecutableTasks >= 1, "readiness must consult fake TaskProvider");

    const { bundle: fakeFailBundle, counters: cFail } = createMvpFakeExecutionPortsBundle({ reviewPass: false });
    mvpSetExecutionPortsBundleForTesting(fakeFailBundle);
    mvpResetExecutionState();
    const fakeFailStart = await mvpStartRunIfReady("mvp-fake-fail-project");
    assert(fakeFailStart.ok === true && fakeFailStart.run.status === "FAILED", "fake failing review ends run");
    const fakeFailDetail = await mvpGetRunDetailDto(fakeFailStart.run.id);
    assert(
      fakeFailDetail?.latestFailurePayload?.failureCode === "REVIEW_FAILED" &&
        fakeFailDetail.latestFailurePayload.retryable === false,
      "fake failure path must surface structured failure in run detail DTO"
    );
    assert(cFail.reviewTaskResult >= 1, "fake review must run on failure path");
  }
  resetAll();
}
