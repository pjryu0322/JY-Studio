import {
  buildImplementationSeedCandidateSlotPatches,
  buildImplementationSeedFromPlanning,
  buildPlanningImplementationSeedCandidateTimelineEntry,
  buildPlanningImplementationSeedEvaluatedTimelineEntry,
  formatImplementationSeedReadinessMessage,
  evaluateImplementationSeedReadiness,
  type ImplementationSeedV1,
} from "@/lib/requirements/implementationSeed";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";

export const PLANNING_IMPLEMENTATION_SEED_NOTICE_INTERNAL_TYPE =
  "PLANNING_IMPLEMENTATION_SEED_NOTICE_V1";

export function buildPlanningImplementationSeedCheckResult(input: {
  readonly projectId: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): Readonly<{
  readonly message: RequirementsMessage;
  readonly seed: ImplementationSeedV1;
  readonly orchestrationPatch: {
    readonly implementationSeedV1: ImplementationSeedV1;
    readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
  };
}> {
  const now = input.nowIso ?? new Date().toISOString();
  const readiness = evaluateImplementationSeedReadiness({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  const seed = buildImplementationSeedFromPlanning({
    projectId: input.projectId,
    orchestration: input.orchestration,
    definitions: input.definitions,
    lifecycleStatus: readiness.ready ? "partial" : "candidate",
    nowIso: now,
  });
  const content = formatImplementationSeedReadinessMessage(readiness);
  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildPlanningImplementationSeedEvaluatedTimelineEntry({ projectId: input.projectId, readiness, seed, nowIso: now }),
  );

  return {
    message: newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "ai-planner",
      speakerName: "AI기획자",
      messageType: "NOTICE",
      content,
      createdAt: now,
      meta: {
        internalType: PLANNING_IMPLEMENTATION_SEED_NOTICE_INTERNAL_TYPE,
        interviewSuggestions: [
          "구현 준비도 점검",
          "부족한 기획정보 보완",
          "AI팀이 구현 Seed 후보 생성",
          "구현 단계로 이동",
        ],
        interviewAllowCustomInput: true,
      },
    }),
    seed,
    orchestrationPatch: {
      implementationSeedV1: seed,
      promptTimeline: timeline,
    },
  };
}

export function buildPlanningImplementationSeedSupplementResult(input: {
  readonly projectId: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): Readonly<{
  readonly message: RequirementsMessage;
  readonly orchestrationPatch: {
    readonly singleChatOrchestrationV1: RequirementsSingleChatOrchestrationStateV1;
    readonly implementationSeedV1: ImplementationSeedV1;
    readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
  };
}> {
  const now = input.nowIso ?? new Date().toISOString();
  const baseOrch =
    input.orchestration ?? initialOrchestrationStateFromDefinitions(input.definitions, now);
  const { slots, touchedGapKeys } = buildImplementationSeedCandidateSlotPatches({
    orchestration: baseOrch,
    definitions: input.definitions,
    nowIso: now,
  });
  const nextOrch: RequirementsSingleChatOrchestrationStateV1 = {
    ...baseOrch,
    slots,
    updatedAt: now,
  };
  const seed = buildImplementationSeedFromPlanning({
    projectId: input.projectId,
    orchestration: nextOrch,
    definitions: input.definitions,
    lifecycleStatus: "candidate",
    nowIso: now,
  });
  const labels = seed.gaps.filter((g) => g.severity === "blocking").map((g) => g.label);
  const content = [
    "구현 작업안 초안 생성을 위해 다음 기획 정보를 보완했습니다.",
    "",
    ...(labels.length ? labels.map((l) => `- ${l}`) : ["- (부족 항목 후보를 슬롯에 반영했습니다)"]),
    "",
    "후보는 candidate 상태입니다. SingleChat 슬롯에서 확인·수정 후 확정(confirmed)해 주세요.",
    "자동 확정되지 않았습니다.",
  ].join("\n");

  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildPlanningImplementationSeedCandidateTimelineEntry({
      projectId: input.projectId,
      touchedGapKeys,
      nowIso: now,
    }),
  );

  return {
    message: newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "ai-planner",
      speakerName: "AI기획자",
      messageType: "NOTICE",
      content,
      createdAt: now,
      meta: {
        internalType: PLANNING_IMPLEMENTATION_SEED_NOTICE_INTERNAL_TYPE,
        interviewSuggestions: [
          "구현 준비도 점검",
          "AI팀이 구현 Seed 후보 생성",
          "구현 단계로 이동",
        ],
        interviewAllowCustomInput: true,
      },
    }),
    orchestrationPatch: {
      singleChatOrchestrationV1: nextOrch,
      implementationSeedV1: seed,
      promptTimeline: timeline,
    },
  };
}

export function buildPlanningImplementationSeedGenerateCandidateResult(input: {
  readonly projectId: string;
  readonly projectName?: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): Readonly<{
  readonly message: RequirementsMessage;
  readonly orchestrationPatch: {
    readonly singleChatOrchestrationV1: RequirementsSingleChatOrchestrationStateV1;
    readonly implementationSeedV1: ImplementationSeedV1;
    readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
  };
}> {
  const now = input.nowIso ?? new Date().toISOString();
  const baseOrch =
    input.orchestration ?? initialOrchestrationStateFromDefinitions(input.definitions, now);
  const { slots, touchedGapKeys } = buildImplementationSeedCandidateSlotPatches({
    orchestration: baseOrch,
    definitions: input.definitions,
    projectName: input.projectName,
    nowIso: now,
  });
  const nextOrch: RequirementsSingleChatOrchestrationStateV1 = {
    ...baseOrch,
    slots,
    updatedAt: now,
  };
  const seed = buildImplementationSeedFromPlanning({
    projectId: input.projectId,
    orchestration: nextOrch,
    definitions: input.definitions,
    lifecycleStatus: "candidate",
    nowIso: now,
  });

  const content = [
    "현재 슬롯·산출물을 기반으로 Implementation Seed 후보를 생성했습니다.",
    "",
    `상태: ${seed.lifecycleStatus} (자동 confirmed 아님)`,
    `준비도: ${Math.round(seed.readiness.score * 100)}%`,
    `반영 슬롯: ${touchedGapKeys.length}개`,
    "",
    "슬롯에서 후보를 검토한 뒤 확정하면 구현 작업안 초안 생성에 사용할 수 있습니다.",
  ].join("\n");

  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildPlanningImplementationSeedCandidateTimelineEntry({
      projectId: input.projectId,
      touchedGapKeys,
      nowIso: now,
    }),
  );

  return {
    message: newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "solution-architect",
      speakerName: "AI설계자",
      messageType: "NOTICE",
      content,
      createdAt: now,
      meta: {
        internalType: PLANNING_IMPLEMENTATION_SEED_NOTICE_INTERNAL_TYPE,
        interviewSuggestions: ["구현 준비도 점검", "부족한 기획정보 보완", "구현 단계로 이동"],
        interviewAllowCustomInput: true,
      },
    }),
    orchestrationPatch: {
      singleChatOrchestrationV1: nextOrch,
      implementationSeedV1: { ...seed, lifecycleStatus: "candidate" },
      promptTimeline: timeline,
    },
  };
}
