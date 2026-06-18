import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import {
  applyDataModelDraftSlots,
  applyDbIntegrationReviewSlots,
  applyMockImplementationModeSlots,
  buildImplementationDbTimelineEntry,
  DB_INTEGRATION_REVIEW_CHIP,
  DATA_MODEL_DRAFT_CHIP,
  MOCK_IMPLEMENTATION_CHIP,
  defaultImplementationDbStrategy,
  type ImplementationDbStrategyV1,
} from "@/lib/prototype/implementationDbStrategy";
import type { ImplementationSlotsV1 } from "@/lib/prototype/implementationSlots";
import { implementationTaskPlanConfirmedChips } from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

export type DbStrategyOrchestrationPatch = Readonly<{
  implementationSlotsV1: ImplementationSlotsV1;
  implementationDbStrategyV1: ImplementationDbStrategyV1;
  promptTimeline: readonly RequirementsPromptTimelineEntry[];
}>;

function mergeDbStrategy(
  prior: ImplementationDbStrategyV1 | null | undefined,
  patch: Partial<ImplementationDbStrategyV1>,
  nowIso: string,
): ImplementationDbStrategyV1 {
  const base = prior ?? defaultImplementationDbStrategy(nowIso);
  return { ...base, ...patch, updatedAt: nowIso };
}

function appendMessages(
  requirementsStateJson: unknown,
  message: RequirementsMessage,
): readonly RequirementsMessage[] {
  const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
  return [...(resolved.messages ?? []), message];
}

export function buildDbIntegrationReviewResult(input: {
  readonly requirementsStateJson: unknown;
  readonly implementationSlotsV1: ImplementationSlotsV1 | null | undefined;
  readonly implementationDbStrategyV1?: ImplementationDbStrategyV1 | null;
  readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{
      readonly kind: "applied";
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: DbStrategyOrchestrationPatch;
    }> {
  const now = input.nowIso ?? new Date().toISOString();
  if (!input.implementationSlotsV1) {
    return { kind: "blocked", message: "구현 작업안 확정이 필요합니다. 구현 작업안을 먼저 확정해 주세요." };
  }

  const slots = applyDbIntegrationReviewSlots(input.implementationSlotsV1, now);
  const dbStrategy = mergeDbStrategy(input.implementationDbStrategyV1, { dbDecisionRequested: true }, now);
  const def = getWorkspaceAiMember("prototype_build");
  const entities = slots.slots.find((s) => s.key === "data_entities")?.value;
  const entityPreview = Array.isArray(entities) ? entities.slice(0, 5).join(", ") : "";

  const summary = newRequirementsMessage({
    id: `impl-db-review-${now}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "DB 연동 필요성을 검토했습니다. PostgreSQL 샘플 DB + Platform Runtime API가 기본이며, 전환 조건·엔티티 후보를 정리했습니다.",
      "",
      `- 저장 방식: PostgreSQL sample DB (db_required=true)`,
      `- 저장 대상 후보: ${entityPreview || "—"}`,
      "",
      "DB 연동 판단서가 Artifact Hub 구현 산출물에 추가되었습니다. AI설계자 관점의 데이터 모델은 [데이터 모델 초안 생성]으로 보완할 수 있습니다.",
      "",
      "다음 작업을 선택해 주세요.",
    ].join("\n"),
    createdAt: now,
    meta: {
      serviceDesignStage: "implementation",
      interviewSuggestions: [...implementationTaskPlanConfirmedChips()],
      interviewAllowCustomInput: true,
    },
  });

  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildImplementationDbTimelineEntry({
      action: "implementation_db_decision_requested",
      slots,
      artifactTypes: ["db-integration-decision"],
      nowIso: now,
    }),
  );

  return {
    kind: "applied",
    messages: appendMessages(input.requirementsStateJson, summary),
    orchestrationPatch: {
      implementationSlotsV1: slots,
      implementationDbStrategyV1: dbStrategy,
      promptTimeline: timeline,
    },
  };
}

export function buildDataModelDraftResult(input: {
  readonly requirementsStateJson: unknown;
  readonly implementationSlotsV1: ImplementationSlotsV1 | null | undefined;
  readonly implementationDbStrategyV1?: ImplementationDbStrategyV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{
      readonly kind: "applied";
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: DbStrategyOrchestrationPatch;
    }> {
  const now = input.nowIso ?? new Date().toISOString();
  if (!input.implementationSlotsV1) {
    return { kind: "blocked", message: "구현 작업안 확정이 필요합니다. 구현 작업안을 먼저 확정해 주세요." };
  }

  const priorEntities = input.implementationSlotsV1.slots.find((s) => s.key === "data_entities")?.value;
  const entityList = Array.isArray(priorEntities) ? priorEntities.map(String) : [];
  const slots = applyDataModelDraftSlots(input.implementationSlotsV1, entityList, now);
  const dbStrategy = mergeDbStrategy(input.implementationDbStrategyV1, { dataModelDraftRequested: true }, now);
  const defDesigner = getWorkspaceAiMember("designer");
  const defDev = getWorkspaceAiMember("prototype_build");

  const summary = newRequirementsMessage({
    id: `impl-data-model-${now}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: defDev?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "데이터 모델 초안을 생성했습니다.",
      defDesigner?.title
        ? `(참조: ${defDesigner.title} 관점의 엔티티·관계 후보를 반영했습니다. 구현단계 기본 멤버에는 포함하지 않습니다.)`
        : "",
      "",
      `- 엔티티 후보: ${entityList.slice(0, 6).join(", ") || "task·산출물 기준"}`,
      "",
      "Artifact Hub에서 [데이터 모델 초안]을 확인할 수 있습니다.",
      "",
      "다음 작업을 선택해 주세요.",
    ]
      .filter(Boolean)
      .join("\n"),
    createdAt: now,
    meta: {
      serviceDesignStage: "implementation",
      interviewSuggestions: [...implementationTaskPlanConfirmedChips()],
      interviewAllowCustomInput: true,
    },
  });

  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildImplementationDbTimelineEntry({
      action: "implementation_data_model_draft_generated",
      slots,
      artifactTypes: ["data-model-draft"],
      nowIso: now,
    }),
  );

  return {
    kind: "applied",
    messages: appendMessages(input.requirementsStateJson, summary),
    orchestrationPatch: {
      implementationSlotsV1: slots,
      implementationDbStrategyV1: dbStrategy,
      promptTimeline: timeline,
    },
  };
}

export function buildMockImplementationModeResult(input: {
  readonly requirementsStateJson: unknown;
  readonly implementationSlotsV1: ImplementationSlotsV1 | null | undefined;
  readonly implementationDbStrategyV1?: ImplementationDbStrategyV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}):
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{
      readonly kind: "applied";
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: DbStrategyOrchestrationPatch;
    }> {
  const now = input.nowIso ?? new Date().toISOString();
  if (!input.implementationSlotsV1) {
    return { kind: "blocked", message: "구현 작업안 확정이 필요합니다. 구현 작업안을 먼저 확정해 주세요." };
  }

  const slots = applyMockImplementationModeSlots(input.implementationSlotsV1, now);
  const dbStrategy = mergeDbStrategy(input.implementationDbStrategyV1, { mockModeConfirmed: true }, now);
  const def = getWorkspaceAiMember("prototype_build");

  const summary = newRequirementsMessage({
    id: `impl-mock-mode-${now}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: [
      "PostgreSQL 샘플 DB 구현 전략을 확정했습니다.",
      "",
      "- data_persistence_mode: db",
      "- db_required: true",
      "- storage_strategy: PostgreSQL sample DB + Platform Runtime API",
      "",
      "기획단계에서 PostgreSQL 설정과 연결 테스트를 완료한 뒤 Code Agent WIP·Cursor 실행을 진행해 주세요.",
      "",
      "다음 작업을 선택해 주세요.",
    ].join("\n"),
    createdAt: now,
    meta: {
      serviceDesignStage: "implementation",
      interviewSuggestions: [...implementationTaskPlanConfirmedChips()],
      interviewAllowCustomInput: true,
    },
  });

  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildImplementationDbTimelineEntry({
      action: "implementation_mock_mode_confirmed",
      slots,
      artifactTypes: ["storage-strategy"],
      nowIso: now,
    }),
  );

  return {
    kind: "applied",
    messages: appendMessages(input.requirementsStateJson, summary),
    orchestrationPatch: {
      implementationSlotsV1: slots,
      implementationDbStrategyV1: dbStrategy,
      promptTimeline: timeline,
    },
  };
}

export {
  DB_INTEGRATION_REVIEW_CHIP,
  DATA_MODEL_DRAFT_CHIP,
  MOCK_IMPLEMENTATION_CHIP,
};
