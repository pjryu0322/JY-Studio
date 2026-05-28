import {
  buildImplementationStageActionTimelineEntry,
  type ImplementationStageActionTimelineSource,
} from "@/lib/prototype/implementationIntentTimeline";
import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  type EffectiveImplementationState,
  type ImplementationStageActionGateResult,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import { hasImplementationWorkPlanDraftReady } from "@/lib/prototype/implementationWorkPlanDraft";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

export type { ImplementationStageActionGateResult, ImplementationStageActionId };

/** Outcome of running a stage action after the stage gate passes. */
export type ImplementationStageActionRunResult =
  | Readonly<{ readonly outcome: "executed" }>
  | Readonly<{ readonly outcome: "blocked"; readonly message: string }>
  | Readonly<{ readonly outcome: "no_op"; readonly message?: string }>;

export type ImplementationStageActionRunTimelinePhase = "executed" | "blocked";

export function stageActionRunResultToTimelinePhase(
  runResult: ImplementationStageActionRunResult,
): ImplementationStageActionRunTimelinePhase {
  return runResult.outcome === "executed" ? "executed" : "blocked";
}

/**
 * Policy A — work plan draft generation requires a non-candidate seed with readiness.ready.
 * Aligns with `buildGenerateImplementationWorkPlanDraftResult()` (Quick Design confirm sets lifecycle confirmed).
 */
export function isImplementationSeedReadyForWorkPlanGeneration(
  seed: ImplementationSeedV1 | null | undefined,
): boolean {
  return (
    Boolean(seed?.readiness?.ready) && seed?.lifecycleStatus !== "candidate"
  );
}

export const IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE =
  "구현 준비정보가 아직 확정되지 않았습니다. [구현 준비정보 확인] 또는 Quick Design 확정 후 작업안을 생성해 주세요.";

export type ImplementationStageActionExecutionResult =
  | Readonly<{
      readonly kind: "handled";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "blocked";
      readonly message: string;
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "focus_composer";
      readonly message: string;
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "open_env_settings";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "open_artifacts";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly kind: "show_status";
      readonly intent: "role" | "scm" | "env";
      readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
    }>;

export function buildImplementationStageActionBlockedResult(
  message: string,
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "blocked", message, timelineEntries };
}

export function buildImplementationStageActionFocusComposerResult(
  message: string,
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "focus_composer", message, timelineEntries };
}

export function buildImplementationStageActionOpenEnvSettingsResult(
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "open_env_settings", timelineEntries };
}

export function buildImplementationStageActionOpenArtifactsResult(
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "open_artifacts", timelineEntries };
}

export function buildImplementationStageActionShowStatusResult(
  intent: "role" | "scm" | "env",
  timelineEntries?: readonly RequirementsPromptTimelineEntry[],
): ImplementationStageActionExecutionResult {
  return { kind: "show_status", intent, timelineEntries };
}

export function buildImplementationStageActionExecutedTimelineEntry(
  actionId: ImplementationStageActionId,
  source: ImplementationStageActionTimelineSource = "cta",
  runId?: string,
): RequirementsPromptTimelineEntry {
  return buildImplementationStageActionTimelineEntry({
    action: "executed",
    actionId,
    source,
    runId,
  });
}

export function buildImplementationStageActionRoutedTimelineEntry(
  actionId: ImplementationStageActionId,
  source: ImplementationStageActionTimelineSource = "cta",
  runId?: string,
): RequirementsPromptTimelineEntry {
  return buildImplementationStageActionTimelineEntry({
    action: "routed",
    actionId,
    source,
    runId,
  });
}

/** Routed + executed/blocked pair for a completed stage action run (batched persist). */
export function buildStageActionRunCompletionTimelineEntries(
  actionId: ImplementationStageActionId,
  runResult: ImplementationStageActionRunResult,
  source: ImplementationStageActionTimelineSource = "cta",
  runId?: string,
): readonly RequirementsPromptTimelineEntry[] {
  const routed = buildImplementationStageActionRoutedTimelineEntry(actionId, source, runId);
  if (stageActionRunResultToTimelinePhase(runResult) === "executed") {
    return [routed, buildImplementationStageActionExecutedTimelineEntry(actionId, source, runId)];
  }
  const message =
    runResult.outcome === "blocked"
      ? runResult.message
      : (runResult.message ?? runResult.outcome);
  return [
    routed,
    buildImplementationStageActionTimelineEntry({
      action: "blocked",
      actionId,
      source,
      message,
      runId,
    }),
  ];
}

export function stageActionExecutionResultFromGate(
  gate: ImplementationStageActionGateResult,
  input?: {
    readonly actionId: ImplementationStageActionId;
    readonly source?: ImplementationStageActionTimelineSource;
  },
): ImplementationStageActionExecutionResult | null {
  if (gate.ok) return null;
  const timelineEntries =
    input?.actionId != null
      ? buildStageActionRunCompletionTimelineEntries(
          input.actionId,
          { outcome: "blocked", message: gate.message },
          input.source ?? "cta",
        )
      : undefined;
  return buildImplementationStageActionBlockedResult(gate.message, timelineEntries);
}

/** Gate failure → blocked result; gate pass → null (panel runs the action). */
export function buildImplementationStageActionExecutionDecision(
  actionId: ImplementationStageActionId,
  state: EffectiveImplementationState,
  source: ImplementationStageActionTimelineSource = "cta",
): ImplementationStageActionExecutionResult | null {
  const gate = evaluateImplementationStageActionGate(actionId, state);
  return stageActionExecutionResultFromGate(gate, { actionId, source });
}

export function evaluateImplementationStageActionGate(
  actionId: ImplementationStageActionId,
  state: EffectiveImplementationState,
): ImplementationStageActionGateResult {
  switch (actionId) {
    case "GENERATE_IMPLEMENTATION_WORK_PLAN": {
      if (!state.designOk) {
        return { ok: false, message: "기획 산출물 준비 후 작업안을 생성할 수 있습니다." };
      }
      if (!state.envOk) {
        return { ok: false, message: "환경 준비가 완료된 뒤 작업안을 생성할 수 있습니다." };
      }
      if (!isImplementationSeedReadyForWorkPlanGeneration(state.implementationSeedV1)) {
        return { ok: false, message: IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE };
      }
      return { ok: true };
    }
    case "CONFIRM_IMPLEMENTATION_WORK_PLAN":
      return canConfirmImplementationWorkPlanFromEffectiveState(state);
    case "REVIEW_DB_INTEGRATION": {
      if (
        state.implementationTaskPlanV1 ||
        hasImplementationWorkPlanDraftReady(state.implementationWorkPlanDraftV1)
      ) {
        return { ok: true };
      }
      return { ok: false, message: "먼저 [구현 작업안 초안 생성]을 진행해 주세요." };
    }
    case "GENERATE_DATA_MODEL_DRAFT": {
      const dbStrategy = state.implementationDbStrategyV1;
      if (state.implementationTaskPlanV1 || dbStrategy?.dbDecisionRequested) {
        return { ok: true };
      }
      return {
        ok: false,
        message: "DB 연동 필요성 검토 또는 구현 작업안 확정 후 진행해 주세요.",
      };
    }
    case "CONFIRM_MOCK_IMPLEMENTATION": {
      if (
        state.implementationTaskPlanV1 ||
        hasImplementationWorkPlanDraftReady(state.implementationWorkPlanDraftV1)
      ) {
        return { ok: true };
      }
      return { ok: false, message: "먼저 [구현 작업안 초안 생성]을 진행해 주세요." };
    }
    case "OPEN_ENV_SETTINGS":
    case "SHOW_ARTIFACTS":
    case "SHOW_ROLE_CHECK":
    case "SHOW_SCM_CHECK":
    case "SHOW_ENV_CHECK":
    case "EDIT_IMPLEMENTATION_SCOPE":
      return { ok: true };
    case "REQUEST_CODE_AGENT_WIP": {
      if (!state.implementationTaskPlanV1) {
        return { ok: false, message: "먼저 [구현 작업안 확정]으로 작업 계획을 확정해 주세요." };
      }
      if (!state.envOk) {
        return { ok: false, message: "환경 준비가 완료된 뒤 Code Agent WIP 작업을 요청할 수 있습니다." };
      }
      return { ok: true };
    }
  }
}
