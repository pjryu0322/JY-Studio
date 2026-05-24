import { buildFastPlanDraftNextActions } from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";
import { agentIdForPlatformRole } from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import {
  buildAnalystMemberDraft,
  buildArchitectMemberDraft,
  buildDesignerMemberDraft,
  buildFastPlanDraftUserMessage,
  buildPlannerMemberDraft,
  collectFastPlanDraftContext,
} from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { defaultProjectAiTeamConfig } from "@/lib/platform-orchestration/projectAiTeamDefaults";
import {
  evaluateFlowRoleReadiness,
  hasRole,
  type ProjectAiTeamConfig,
} from "@/lib/platform-orchestration/projectAiTeam";
import { newPlatformOrchestrationId, platformOrchestrationNowIso } from "@/lib/platform-orchestration/platformIds";
import {
  createCompletedMemberRun,
  createPlatformRunResult,
  createPlatformTimelineEvent,
  createSkippedMemberRun,
} from "@/lib/platform-orchestration/runResultFactory";
import type {
  PlatformMemberDraft,
  PlatformMemberRun,
  PlatformMemberRole,
  PlatformOrchestrationTrigger,
  PlatformRunResult,
} from "@/lib/platform-orchestration/types";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

const SKIPPED_REASON = "프로젝트 AI팀에 해당 역할이 비활성화되어 초안 생성을 건너뜀";

export type RunFastPlanDraftFlowInput = Readonly<{
  readonly trigger: PlatformOrchestrationTrigger;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly conversationMessages: readonly unknown[];
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
  readonly problemInterview?: ProblemInterviewState | null;
  readonly projectAiTeam?: ProjectAiTeamConfig | null;
  readonly nowIso?: string;
}>;

function resolveTeam(input: RunFastPlanDraftFlowInput): ProjectAiTeamConfig {
  const projectId = String(input.trigger.projectId ?? "").trim() || "unknown";
  return input.projectAiTeam ?? defaultProjectAiTeamConfig(projectId);
}

function runForRole(input: {
  readonly flowId: "fast_plan_draft";
  readonly role: PlatformMemberRole;
  readonly team: ProjectAiTeamConfig;
  readonly traceId: string;
  readonly nowIso: string;
  readonly buildDraft: (runId: string) => PlatformMemberDraft;
  readonly collected: ReturnType<typeof collectFastPlanDraftContext>;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
}): { readonly run: PlatformMemberRun; readonly draft: PlatformMemberDraft | null } {
  const active = hasRole(input.team, input.role);
  if (!active) {
    return {
      run: createSkippedMemberRun({
        flowId: input.flowId,
        agentId: `ai-${input.role}`,
        role: input.role,
        traceId: input.traceId,
        reason: SKIPPED_REASON,
      }),
      draft: null,
    };
  }
  const run = createCompletedMemberRun({
    flowId: input.flowId,
    agentId: agentIdForPlatformRole(input.role),
    role: input.role,
    traceId: input.traceId,
    startedAt: input.nowIso,
    completedAt: input.nowIso,
    outputSummary: `${input.role} draft completed`,
  });
  return { run, draft: input.buildDraft(run.runId) };
}

export function extractFastPlanDraftV1FromRunResult(
  result: PlatformRunResult,
): FastPlanDraftStateV1 | null {
  for (const patch of result.statePatches) {
    if (patch.kind !== "fast_plan") continue;
    const payload = patch.payload as { readonly fastPlanDraftV1?: FastPlanDraftStateV1 };
    if (payload?.fastPlanDraftV1) return payload.fastPlanDraftV1;
  }
  return null;
}

export function runFastPlanDraftFlow(input: RunFastPlanDraftFlowInput): PlatformRunResult {
  const nowIso = input.nowIso ?? platformOrchestrationNowIso();
  const team = resolveTeam(input);
  const readiness = evaluateFlowRoleReadiness({ flowId: "fast_plan_draft", team });
  const traceId = newPlatformOrchestrationId("fptr");
  const collected = collectFastPlanDraftContext({
    projectId: String(input.trigger.projectId ?? ""),
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationMessages: input.conversationMessages,
    serviceFlow: input.serviceFlow,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
    featurePlanning: input.featurePlanning ?? null,
    problemInterview: input.problemInterview ?? null,
  });

  const timelineEvents = [
    createPlatformTimelineEvent({
      flowId: "fast_plan_draft",
      eventType: "trigger_received",
      message: "fast_plan_draft flow started",
      at: nowIso,
      detail: { triggerId: input.trigger.triggerId },
    }),
  ];

  if (!readiness.ready) {
    timelineEvents.push(
      createPlatformTimelineEvent({
        flowId: "fast_plan_draft",
        eventType: "validation_checked",
        message: `필수 역할 부족: ${readiness.missingRequiredRoles.join(", ")}`,
        at: nowIso,
      }),
    );
  }

  for (const role of readiness.missingRecommendedRoles) {
    timelineEvents.push(
      createPlatformTimelineEvent({
        flowId: "fast_plan_draft",
        eventType: "member_selected",
        message: `권장 역할 미활성: ${role} (warning)`,
        at: nowIso,
      }),
    );
  }

  const memberRuns: PlatformMemberRun[] = [];
  const memberDrafts: PlatformMemberDraft[] = [];

  const flowBase = {
    flowId: "fast_plan_draft" as const,
    team,
    traceId,
    nowIso,
    collected,
    slotDefinitions: input.slotDefinitions,
    orchestration: input.orchestration,
  };

  const plannerResult = runForRole({
    ...flowBase,
    role: "planner",
    buildDraft: (runId) =>
      buildPlannerMemberDraft({ runId, collected, definitions: input.slotDefinitions }),
  });
  memberRuns.push(plannerResult.run);
  if (plannerResult.draft) memberDrafts.push(plannerResult.draft);

  const analystResult = runForRole({
    ...flowBase,
    role: "analyst",
    buildDraft: (runId) =>
      buildAnalystMemberDraft({
        runId,
        collected,
        definitions: input.slotDefinitions,
        orchestration: input.orchestration,
      }),
  });
  memberRuns.push(analystResult.run);
  if (analystResult.draft) memberDrafts.push(analystResult.draft);

  const architectResult = runForRole({
    ...flowBase,
    role: "architect",
    buildDraft: (runId) =>
      buildArchitectMemberDraft({
        runId,
        collected,
        definitions: input.slotDefinitions,
        orchestration: input.orchestration,
      }),
  });
  memberRuns.push(architectResult.run);
  if (architectResult.draft) memberDrafts.push(architectResult.draft);

  const designerResult = runForRole({
    ...flowBase,
    role: "designer",
    buildDraft: (runId) =>
      buildDesignerMemberDraft({
        runId,
        collected,
        definitions: input.slotDefinitions,
        orchestration: input.orchestration,
      }),
  });
  memberRuns.push(designerResult.run);
  if (designerResult.draft) memberDrafts.push(designerResult.draft);

  const plannerReady = hasRole(team, "planner");
  const nextActions = buildFastPlanDraftNextActions({ plannerReady });
  const userMessage = buildFastPlanDraftUserMessage({
    memberDrafts,
    assumptions: collected.assumptions,
  });

  const fastPlanDraftV1: FastPlanDraftStateV1 = {
    status: "proposed",
    generatedAt: nowIso,
    flowId: "fast_plan_draft",
    memberRuns,
    memberDrafts,
    assumptions: collected.assumptions,
    source: "current_conversation_and_slots",
  };

  return createPlatformRunResult({
    flowId: "fast_plan_draft",
    trigger: input.trigger,
    memberRuns,
    memberDrafts,
    statePatches: [
      {
        patchId: newPlatformOrchestrationId("patch"),
        kind: "fast_plan",
        summary: "fast_plan_draft proposed",
        payload: { fastPlanDraftV1 },
      },
    ],
    timelineEvents,
    nextActions,
    userMessage,
  });
}
