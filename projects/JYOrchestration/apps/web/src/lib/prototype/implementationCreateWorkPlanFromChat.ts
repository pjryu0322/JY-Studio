import type { PrototypeExecutionOperationalSendResult } from "@/lib/prototype/prototypeExecutionOperationalSendResult";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildImplementationRouterAssistantReply } from "@/lib/prototype/implementationRouterMessages";
import {
  hasImplementationWorkPlanDraftMessage,
  hasImplementationWorkPlanDraftReady,
  type ImplementationWorkPlanDraftV1,
} from "@/lib/prototype/implementationWorkPlanDraft";
import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type CreateWorkPlanFromChatInput = Readonly<{
  userMsg: RequirementsMessage;
  requirementsStateJson: unknown;
  projectId: string;
  projectArtifacts: readonly ProjectArtifact[];
  orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  implementationSeedV1?: ImplementationSeedV1 | null;
  implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  envOk: boolean;
  designOk: boolean;
  promptTimeline?: readonly RequirementsPromptTimelineEntry[];
}>;

/** 구현 작업안 초안 생성(칩과 동일) 또는 이후 프로토타입 작업계획 생성으로 분기. */
export function buildCreateWorkPlanFromChatOperationalResult(
  input: CreateWorkPlanFromChatInput,
): PrototypeExecutionOperationalSendResult {
  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const prior = resolved.messages ?? [];
  const needsDraft =
    !hasImplementationWorkPlanDraftReady(input.implementationWorkPlanDraftV1) &&
    !hasImplementationWorkPlanDraftMessage(prior);

  if (needsDraft) {
    const result = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson: input.requirementsStateJson,
      projectId: input.projectId,
      projectArtifacts: input.projectArtifacts,
      orchestration: input.orchestration,
      slotDefinitions: input.slotDefinitions,
      implementationSeedV1: input.implementationSeedV1,
      envOk: input.envOk,
      designOk: input.designOk,
      promptTimeline: input.promptTimeline,
    });

    if (result.kind === "blocked") {
      return {
        kind: "assistant_reply",
        aiMessage: buildImplementationRouterAssistantReply({ content: result.message }),
      };
    }

    if (result.kind === "already_exists") {
      return {
        kind: "assistant_reply",
        aiMessage: buildImplementationRouterAssistantReply({
          content: "이미 구현 작업안 초안이 생성되어 있습니다. 아래 초안을 확인한 뒤 「구현 작업안 확정」으로 진행해 주세요.",
        }),
      };
    }

    const draftMsg = result.messages[result.messages.length - 1];
    const messages = [...prior, input.userMsg, draftMsg];
    const orchestration: PrototypeExecutionOrchestrationPersistInput = result.orchestrationPatch;

    return {
      kind: "apply_conversation",
      messages,
      orchestration,
    };
  }

  return {
    kind: "assistant_reply",
    aiMessage: buildImplementationRouterAssistantReply({
      content: "요청을 확인했습니다. 프로토타입 작업계획(Work Unit) 생성을 시작합니다.",
    }),
    afterPersist: "start_prototype_work_plan",
  };
}
