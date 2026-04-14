/**
 * Self-check: planning-originated execution UI/route integration layer (in-process).
 *
 * Scope:
 * - facade → normalized response → view-model → screen UX invariants
 * - request DTO parser invariants
 * - forbidden internal keys never leak into outward shapes
 *
 * Boundary rule under test:
 * - routes/UI attach at facade/response/view-model layers only
 * - no raw handoff/prep/bridge bundles are surfaced to UI
 */

import { getRunStatus } from "../execution/executionService";
import type { PlanningOriginatedExecutionDeps, PlanningOriginatedExecutionResult } from "../../application/planningOriginatedExecution/planningOriginatedExecutionContracts";
import { normalizePlanningOriginatedExecutionResult, planningTerminalBlocksPreparation } from "../../application/planningOriginatedExecution/planningOriginatedExecutionResult";
import { mvpRunPlanningOriginatedExecutionUseCase } from "../../application/usecases/mvpRunPlanningOriginatedExecutionUseCase";
import { mvpPrepareExecutionInputFromPlanningUseCase } from "../../application/usecases/mvpPrepareExecutionInputFromPlanningUseCase";
import { buildPlanningOriginatedExecutionResponse, normalizePlanningOriginatedExecutionResponse, presentPlanningOriginatedExecutionResult } from "../../application/contracts/planningOriginatedExecutionResponseBuilder";
import { buildPlanningOriginatedExecutionViewModel, planningExecutionStructuralActionsForStatus } from "../../application/viewmodels/planningOriginatedExecutionViewModelBuilder";
import { buildPlanningExecutionScreenViewModel } from "../../application/viewmodels/planningOriginatedExecutionScreenUxBuilder";
import { PLANNING_EXECUTION_ACTION_AVAILABILITY } from "../../application/viewmodels/planningOriginatedExecutionScreenUx";
import { parsePlanningExecutionRequest } from "../../http/jyOrchestration/planningOriginatedExecutionRequestDto";
import { buildRequirementGapViewModel } from "../../application/planning/requirementInput/gapUx/buildRequirementGapViewModel";
import { buildRefinedRequirements } from "../../application/planning/requirementInput/refinement/buildRefinedRequirements";
import { evaluateRequirementReadiness } from "../../application/planning/requirementInput/refinement/evaluateRequirementReadiness";
import type { PrepareRequirementRefinementDecisionResult } from "../../application/planning/requirementInput/prepareRequirementRefinementDecision";
import type { RequirementRefinementDecision } from "../../application/planning/requirementInput/refinement/refinementContracts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`mvpSelfCheck(ui/route integration): ${msg}`);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Keys that must never appear on normalized planning-originated execution outward shapes. */
const FORBIDDEN_KEYS = new Set([
  "bundle",
  "handoff",
  "refinement",
  "screens",
  "tasks",
  "ExecutionPreparationBundle",
  "ExecutionBridgePayload",
]);

function assertNoForbiddenKeyLeak(value: unknown, path: string, depth: number, kind: string): void {
  if (depth > 24) return;
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoForbiddenKeyLeak(item, `${path}[${i}]`, depth + 1, kind));
    return;
  }
  for (const key of Object.keys(value)) {
    assert(!FORBIDDEN_KEYS.has(key), `${kind} must not contain forbidden key "${key}" at ${path}`);
    assertNoForbiddenKeyLeak((value as Record<string, unknown>)[key], `${path}.${key}`, depth + 1, kind);
  }
}

function assertNormalizedResponseMatchesFacade(
  internal: PlanningOriginatedExecutionResult,
  tag: string,
  prepBaseline: { ok: true; bundle: { tasks: readonly { id: string }[]; screens: readonly unknown[]; context: { featureCount: number } } }
): void {
  const built = buildPlanningOriginatedExecutionResponse(internal);
  const normalized = normalizePlanningOriginatedExecutionResponse(built);
  assert(built === normalized, `${tag}: normalize is identity on builder output`);
  const out = presentPlanningOriginatedExecutionResult(internal);
  const outAgain = presentPlanningOriginatedExecutionResult(internal);
  assert(stableJson(out) === stableJson(outAgain), `${tag}: present is deterministic`);
  assert(stableJson(out) === stableJson(normalized), `${tag}: present matches normalize(build)`);
  assert(out.status === internal.status, `${tag}: status preserved`);
  assert(out.ok === internal.ok, `${tag}: ok preserved`);
  assertNoForbiddenKeyLeak(out, tag, 0, "planning-originated normalized response");

  if (internal.status === "BLOCKED" || internal.status === "NEEDS_CONFIRMATION") {
    assert(out.ok === false, `${tag}: planning-only branch ok false`);
    assert("planning" in out && !("preview" in out), `${tag}: planning-only shape`);
    assert(typeof out.reasonSummary === "string" && out.reasonSummary.length > 0, `${tag}: reasonSummary`);
    assert(!("runId" in out), `${tag}: no root runId`);
    return;
  }

  assert("preview" in out && out.preview, `${tag}: preview required`);
  assertNoForbiddenKeyLeak(out.preview, `${tag}.preview`, 0, "planning-originated preview");

  const prev = internal.preview;
  assert(out.preview.projectId === prev.projectId, `${tag}: preview projectId`);
  assert(out.preview.featureCount === prev.featureCount, `${tag}: preview featureCount`);
  assert(out.preview.screenCount === prev.screenCount, `${tag}: preview screenCount`);
  assert(out.preview.taskCount === prev.taskCount, `${tag}: preview taskCount`);
  assert(stableJson(out.preview.orderedTaskIds) === stableJson(prev.taskIdsOrdered), `${tag}: orderedTaskIds`);

  assert(
    out.preview.taskCount === prepBaseline.bundle.tasks.length &&
      out.preview.screenCount === prepBaseline.bundle.screens.length &&
      out.preview.featureCount === prepBaseline.bundle.context.featureCount &&
      stableJson(out.preview.orderedTaskIds) === stableJson(prepBaseline.bundle.tasks.map((t) => t.id)),
    `${tag}: preview counts/order match execution preparation baseline`
  );
}

function planningOriginatedVmFromFacade(internal: PlanningOriginatedExecutionResult) {
  return buildPlanningOriginatedExecutionViewModel(presentPlanningOriginatedExecutionResult(internal));
}

function assertScreenUxStable(internal: PlanningOriginatedExecutionResult, tag: string): void {
  const vm = planningOriginatedVmFromFacade(internal);
  const screen = buildPlanningExecutionScreenViewModel(vm);
  assert(screen.layoutVersion === 1, `${tag}: layoutVersion`);
  assert(screen.activeTab === null, `${tag}: single-screen uses null tab`);
  assert(screen.responseStatus === internal.status, `${tag}: responseStatus`);
  assert(screen.viewModel === vm, `${tag}: screen embeds view-model reference`);
  assert(screen.emphasizedSummary !== null, `${tag}: emphasizedSummary`);
  const sec = screen.visibleSections;
  assert(sec[0] === "INPUT_PANEL" && sec[1] === "STATUS_BANNER", `${tag}: stable top chrome`);
  assert(sec.includes("STATUS_BANNER") && sec.includes("ACTION_BAR"), `${tag}: banner and action bar`);
  if (internal.status !== "BLOCKED" && internal.status !== "NEEDS_CONFIRMATION") {
    assert(sec.includes("METRICS_ROW") && sec.includes("TASK_SCREEN_SUMMARY_PANEL"), `${tag}: metrics+tasks when preview exists`);
  }
  const ref = planningExecutionStructuralActionsForStatus(internal.status);
  assert(ref.primaryAction === vm.actions.primaryAction && ref.secondaryAction === vm.actions.secondaryAction, `${tag}: CTA alignment`);
  const allowed = PLANNING_EXECUTION_ACTION_AVAILABILITY[internal.status] as readonly string[];
  for (const a of vm.actions.availableActions) {
    assert(allowed.includes(a), `${tag}: action ${String(a)} must be allowed`);
  }
  assertNoForbiddenKeyLeak(screen, `${tag}/screenTree`, 0, "planning-originated screen");
}

export async function runPlanningOriginatedExecutionUiRouteIntegrationSelfCheck(opts: {
  resetAll: () => void;
}): Promise<void> {
  const { resetAll } = opts;
  resetAll();

  const pFac = "mvp-planning-originated-facade";
  const blocked = normalizePlanningOriginatedExecutionResult(
    await mvpRunPlanningOriginatedExecutionUseCase({
      projectId: pFac,
      inputText: "좋은 플랫폼 만들고 싶다",
      mode: "PREPARE_ONLY",
    })
  );
  assert(blocked.ok === false && blocked.status === "BLOCKED", "facade maps vague planning input to BLOCKED");
  assert(blocked.planningSummary.projectId === pFac && blocked.planningSummary.planningStatus === "BLOCKED", "BLOCKED planningSummary");
  assert(!("preview" in blocked) && !("runId" in blocked), "BLOCKED result must not leak preview or runId");
  assert(planningTerminalBlocksPreparation(blocked.planningSummary.planningStatus), "transition: BLOCKED never runs execution preparation");

  const needsConf = normalizePlanningOriginatedExecutionResult(
    await mvpRunPlanningOriginatedExecutionUseCase({
      projectId: pFac,
      inputText: "사용자가 화상회의를 생성하고 참여할 수 있는 웹 서비스를 만들고 싶다",
      mode: "PREPARE_ONLY",
    })
  );
  assert(needsConf.ok === false && needsConf.status === "NEEDS_CONFIRMATION", "facade maps meeting input to NEEDS_CONFIRMATION");
  assert(!("preview" in needsConf), "NEEDS_CONFIRMATION must not include preview");
  assert(
    planningTerminalBlocksPreparation(needsConf.planningSummary.planningStatus),
    "transition: NEEDS_CONFIRMATION never runs execution preparation"
  );
  {
    const vmNc = planningOriginatedVmFromFacade(needsConf);
    const r = needsConf.planningSummary.readiness;
    assert(r !== null, "NEEDS_CONFIRMATION should expose readiness summary for UX counts");
    if (r) {
      assert(
        vmNc.confirmationNeededSummary !== null,
        "NEEDS_CONFIRMATION view-model must propagate confirmation counts"
      );
      assert(
        vmNc.confirmationNeededSummary !== null &&
          vmNc.confirmationNeededSummary.confirmRequiredCount === r.confirmRequiredCount &&
          vmNc.confirmationNeededSummary.blockingIssueCount === r.blockingIssueCount,
        "NEEDS_CONFIRMATION confirmation summary matches readiness"
      );
    }
  }

  const autoDec: RequirementRefinementDecision = {
    normalizedText: "Stable demo input for planning-originated execution facade",
    drafts: [
      {
        id: `draft-facade-${pFac}`,
        projectId: pFac,
        description: "Browse posts in list and detail",
        source: "USER_INPUT",
        confidence: "HIGH",
      },
    ],
    decisions: [
      {
        gap: { code: "LIST_DETAIL_SCREENS", question: "Confirm list vs detail", severity: "INFO" },
        mode: "AUTO",
        reason: "facade self-check",
        resolvedValue:
          "Assumed UX: one list/browse screen and one detail screen for the same content type, with navigation between them.",
      },
    ],
  };
  const refined = buildRefinedRequirements({ refinementDecision: autoDec });
  const synthFac: PrepareRequirementRefinementDecisionResult = {
    normalizedText: autoDec.normalizedText,
    drafts: [...autoDec.drafts],
    gapViewModel: buildRequirementGapViewModel({ normalizedText: autoDec.normalizedText, drafts: autoDec.drafts, gaps: [] }),
    refinementDecision: autoDec,
    refinedRequirements: refined,
    readinessResult: evaluateRequirementReadiness(autoDec),
  };

  const prepDirect = mvpPrepareExecutionInputFromPlanningUseCase({ projectId: pFac, refinement: synthFac });
  assert(prepDirect.ok === true, "direct preparation use-case succeeds for parity baseline");

  const readyOnly = normalizePlanningOriginatedExecutionResult(
    await mvpRunPlanningOriginatedExecutionUseCase({ projectId: pFac, refinement: synthFac, mode: "PREPARE_ONLY" })
  );
  assert(readyOnly.ok === true && readyOnly.status === "READY_FOR_EXECUTION", "PREPARE_ONLY returns READY_FOR_EXECUTION");

  resetAll();
  const started = normalizePlanningOriginatedExecutionResult(
    await mvpRunPlanningOriginatedExecutionUseCase({ projectId: pFac, refinement: synthFac, mode: "PREPARE_AND_START" })
  );
  assert(started.ok === true && started.status === "EXECUTION_STARTED", "PREPARE_AND_START returns EXECUTION_STARTED");
  assert(started.ok === true && (await getRunStatus(started.runId)).id === started.runId, "run visible after EXECUTION_STARTED");

  resetAll();
  const depsSimFail: PlanningOriginatedExecutionDeps = {
    startFromPreparation: async () => ({ ok: false as const, reason: "SELF_CHECK_SIMULATED_START_FAILURE" }),
  };
  const startFailed = normalizePlanningOriginatedExecutionResult(
    await mvpRunPlanningOriginatedExecutionUseCase({ projectId: pFac, refinement: synthFac, mode: "PREPARE_AND_START" }, depsSimFail)
  );
  assert(startFailed.ok === false && startFailed.status === "EXECUTION_START_FAILED", "guarded start failure maps to EXECUTION_START_FAILED");

  const prepOk = prepDirect;
  assertNormalizedResponseMatchesFacade(blocked, "planning-originated-response/BLOCKED", prepOk);
  assertNormalizedResponseMatchesFacade(needsConf, "planning-originated-response/NEEDS_CONFIRMATION", prepOk);
  assertNormalizedResponseMatchesFacade(readyOnly, "planning-originated-response/READY_FOR_EXECUTION", prepOk);
  assertNormalizedResponseMatchesFacade(started, "planning-originated-response/EXECUTION_STARTED", prepOk);
  assertNormalizedResponseMatchesFacade(startFailed, "planning-originated-response/EXECUTION_START_FAILED", prepOk);

  assertScreenUxStable(blocked, "planning-execution-screen/BLOCKED");
  assertScreenUxStable(needsConf, "planning-execution-screen/NEEDS_CONFIRMATION");
  assertScreenUxStable(readyOnly, "planning-execution-screen/READY_FOR_EXECUTION");
  assertScreenUxStable(started, "planning-execution-screen/EXECUTION_STARTED");
  assertScreenUxStable(startFailed, "planning-execution-screen/EXECUTION_START_FAILED");

  const httpBad = parsePlanningExecutionRequest({});
  assert(httpBad.ok === false, "planning-execution HTTP parse: empty body invalid");
  const httpOk = parsePlanningExecutionRequest({
    projectId: "mvp-route-parse-check",
    mode: "PREPARE_ONLY",
    inputText: "need a simple login screen",
  });
  assert(httpOk.ok === true, "planning-execution HTTP parse: minimal valid body");
}

