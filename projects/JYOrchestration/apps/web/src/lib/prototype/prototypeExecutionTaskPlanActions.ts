import {
  buildCursorWorkItemsFromImplementationTaskPlan,
  evaluateCursorExecutionRequestGate,
  formatCursorExecutionBlockedMessage,
  type CursorWorkItem,
} from "@/lib/prototype/implementationCursorWorkItems";
import {
  defaultImplementationDbStrategy,
  type ImplementationDbStrategyV1,
} from "@/lib/prototype/implementationDbStrategy";
import {
  buildImplementationDbSlotsTimelineEntry,
  buildImplementationSlotsFromContext,
  buildImplementationSlotsTimelineEntry,
  formatImplementationSlotsBlockedMessage,
  type ImplementationSlotsV1,
} from "@/lib/prototype/implementationSlots";
import {
  canConfirmImplementationWorkPlanDraft,
  type ImplementationWorkPlanDraftV1,
} from "@/lib/prototype/implementationWorkPlanDraft";
import {
  buildWorkPlanDraftConfirmedTimeline,
  markImplementationWorkPlanDraftConfirmed,
} from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import {
  buildImplementationTaskPlan,
  hasImplementationTaskPlanSummary,
  type ImplementationTaskPlanV1,
} from "@/lib/prototype/implementationTaskPlan";
import { buildImplementationTaskPlanSummaryMessage } from "@/lib/prototype/implementationTaskPlanSummary";
import {
  appendPromptTimeline,
  buildImplementationTaskPlanTimelineEntry,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";


export type ImplementationCursorGateContext = Readonly<{
  readonly plan: ImplementationTaskPlanV1 | null | undefined;
  readonly workItems: readonly CursorWorkItem[] | null | undefined;
  readonly implementationSlotsV1: ImplementationSlotsV1 | null | undefined;
  readonly envOk: boolean;
  readonly designOk: boolean;
}>;

export function buildImplementationCursorGateContext(
  state: Pick<
    RequirementsStateJson,
    "implementationTaskPlanV1" | "cursorWorkItemsV1" | "implementationSlotsV1"
  >,
  readiness: { readonly envOk: boolean; readonly designOk: boolean },
): ImplementationCursorGateContext {
  return {
    plan: state.implementationTaskPlanV1,
    workItems: state.cursorWorkItemsV1,
    implementationSlotsV1: state.implementationSlotsV1,
    envOk: readiness.envOk,
    designOk: readiness.designOk,
  };
}

export function evaluateImplementationCursorGate(ctx: ImplementationCursorGateContext) {
  const base = evaluateCursorExecutionRequestGate(ctx);
  const slotMissing = formatImplementationSlotsBlockedMessage(ctx.implementationSlotsV1);
  if (!slotMissing.length) return base;
  const missing = [...base.missing, ...slotMissing];
  return { allowed: false, missing: [...new Set(missing)] };
}

export function formatImplementationCursorBlockedNotice(ctx: ImplementationCursorGateContext): string {
  return formatCursorExecutionBlockedMessage(evaluateImplementationCursorGate(ctx).missing);
}

export type ConfirmImplementationTaskPlanInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly featureDraftTitles?: readonly string[];
  readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
}>;

export type ConfirmImplementationTaskPlanResult =
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{ readonly kind: "already_confirmed" }>
  | Readonly<{
      readonly kind: "created";
      readonly plan: ImplementationTaskPlanV1;
      readonly workItems: readonly CursorWorkItem[];
      readonly chatPatch: {
        readonly messages: readonly RequirementsMessage[];
        readonly slots: readonly PrototypeExecutionInterviewSlot[];
        readonly answers: Readonly<Record<string, string>>;
        readonly currentSlotKey: string | null;
      };
      readonly orchestrationPatch: {
        readonly implementationTaskPlanV1: ImplementationTaskPlanV1;
        readonly cursorWorkItemsV1: readonly CursorWorkItem[];
        readonly implementationSlotsV1: ImplementationSlotsV1;
        readonly implementationDbStrategyV1: ImplementationDbStrategyV1;
        readonly implementationWorkPlanDraftV1: ImplementationWorkPlanDraftV1;
        readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
      };
    }>;

export function buildConfirmImplementationTaskPlanResult(
  input: ConfirmImplementationTaskPlanInput,
): ConfirmImplementationTaskPlanResult {
  const pid = input.projectId.trim();
  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const prior = resolved.messages ?? [];
  if (hasImplementationTaskPlanSummary(prior)) {
    return { kind: "already_confirmed" };
  }
  if (!canConfirmImplementationWorkPlanDraft(input.implementationWorkPlanDraftV1)) {
    return {
      kind: "blocked",
      message: "먼저 [구현 작업안 초안 생성]으로 구현 범위 초안을 만든 뒤 [구현 작업안 확정]을 진행해 주세요.",
    };
  }
  const confirmedDraft = markImplementationWorkPlanDraftConfirmed(input.implementationWorkPlanDraftV1!);
  const plan = buildImplementationTaskPlan({
    projectId: pid,
    projectArtifacts: input.projectArtifacts,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
    featureDraftTitles: input.featureDraftTitles,
    implementationScope: confirmedDraft.implementationScope,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
  const implementationSlotsV1 = buildImplementationSlotsFromContext({
    projectId: pid,
    projectArtifacts: input.projectArtifacts,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
    implementationTaskPlanV1: plan,
    cursorWorkItemsV1: workItems,
    envOk: input.envOk,
    designOk: input.designOk,
    envCursorBadge: input.envOk ? "ok" : "needs",
  });
  const summaryMsg = buildImplementationTaskPlanSummaryMessage(plan, {
    workItems,
    envOk: input.envOk,
    designOk: input.designOk,
    implementationSlotsV1,
  });
  const nextMessages = [...prior, summaryMsg];
  const taskPlanTimeline = buildImplementationTaskPlanTimelineEntry({
    plan,
    workItems,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  const slotsTimeline = buildImplementationSlotsTimelineEntry({ slots: implementationSlotsV1 });
  const dbSlotsTimeline = buildImplementationDbSlotsTimelineEntry({ slots: implementationSlotsV1 });
  const implementationDbStrategyV1 = defaultImplementationDbStrategy();
  const draftConfirmedTimeline = buildWorkPlanDraftConfirmedTimeline(
    confirmedDraft,
    input.promptTimeline,
  );
  return {
    kind: "created",
    plan,
    workItems,
    chatPatch: {
      messages: nextMessages,
      slots: resolved.slots ?? [],
      answers: resolved.answers ?? {},
      currentSlotKey: resolved.currentSlotKey ?? null,
    },
    orchestrationPatch: {
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: workItems,
      implementationSlotsV1,
      implementationDbStrategyV1,
      implementationWorkPlanDraftV1: confirmedDraft,
      promptTimeline: appendPromptTimeline(
        appendPromptTimeline(
          appendPromptTimeline(draftConfirmedTimeline, taskPlanTimeline),
          slotsTimeline,
        ),
        dbSlotsTimeline,
      ),
    },
  };
}

export function buildPrepareImplementationExecutionToast(
  plan: ImplementationTaskPlanV1 | null | undefined,
): string | null {
  if (!plan?.items?.length) {
    return "먼저 [구현 작업안 초안 생성] 후 [구현 작업안 확정]으로 task plan을 생성해 주세요.";
  }
  const ready = plan.items.filter((i) => i.status === "ready").length;
  return `구현 실행 준비: task ${plan.items.length}개 중 ready ${ready}개. 환경·설계가 완료되면 [구현 실행] 또는 [코드 에이전트 WIP 작업 요청]을 진행할 수 있습니다.`;
}
