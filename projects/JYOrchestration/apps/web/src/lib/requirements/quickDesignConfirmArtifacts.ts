import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  QUICK_DESIGN_IMPLEMENTATION_READY_CHIP_LABELS,
  IMPLEMENTATION_PREP_READY_HEADING,
} from "@/lib/requirements/implementationUxLabels";
import {
  newRequirementsMessage,
  type RequirementsMessage,
} from "@/lib/requirements/requirementsMessage";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { PROJECT_ARTIFACT_LABELS } from "@/lib/requirements/projectArtifactTypes";
import {
  generateArtifactsFromPlan,
  mergePlannedArtifactsIntoState,
  planProjectArtifactsFromOrchestrationContext,
  type PlannedProjectArtifact,
} from "@/lib/requirements/projectArtifactPlan";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { RequirementsOrchestrationStageV1 } from "@/lib/requirements/requirementsStateJson";

export type QuickDesignConfirmArtifactsInput = Readonly<
  Omit<FastPlanGenerationInput, "nowIso"> & {
    readonly nowIso: string;
    readonly fastPlanDraftV1: FastPlanDraftStateV1;
  }
>;

export type QuickDesignConfirmArtifactsResult = Readonly<{
  readonly artifacts: readonly ProjectArtifact[];
  readonly deliverables: readonly IdeationDeliverableAsset[];
  readonly primaryArtifactId: string;
  readonly artifactIds: readonly string[];
  readonly planned: readonly PlannedProjectArtifact[];
  readonly artifactOrchestrationV1: ArtifactOrchestrationStateV1;
  readonly userFacingSummary: string;
}>;

export function generateQuickDesignConfirmArtifacts(
  input: QuickDesignConfirmArtifactsInput,
): QuickDesignConfirmArtifactsResult {
  const conversationMessages = input.conversationMessages as readonly RequirementsMessage[];

  const plan = planProjectArtifactsFromOrchestrationContext({
    orchestration: input.orchestration!,
    definitions: input.slotDefinitions,
    serviceFlow: input.serviceFlow,
    featurePlanning: input.featurePlanning,
    memberDrafts: input.fastPlanDraftV1.memberDrafts,
    conversationMessages,
    nowIso: input.nowIso,
  });

  const toGenerate = plan.planned.filter((p) => p.priority === "required");

  const artifacts = generateArtifactsFromPlan({
    plan: toGenerate,
    orchestration: plan.orchestration,
    onlyRequired: false,
    memberDrafts: input.fastPlanDraftV1.memberDrafts,
    conversationMessages,
    base: {
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      sourceStage: input.sourceStage,
      serviceFlow: input.serviceFlow,
      featurePlanning: input.featurePlanning,
      nowIso: input.nowIso,
      createdBy: "ai",
      fastPlanContext: {
        projectId: input.projectId,
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        conversationMessages: input.conversationMessages,
        serviceFlow: input.serviceFlow,
        orchestration: input.orchestration,
        slotDefinitions: input.slotDefinitions,
        featurePlanning: input.featurePlanning,
        problemInterview: input.problemInterview,
        sourceStage: input.sourceStage,
      },
    },
  });

  const deliverables = artifacts.map((a) => ({
    id: a.id,
    projectId: input.projectId,
    type: "full_plan" as const,
    title: a.title,
    version: 1,
    content: a.content,
    createdAt: a.createdAt,
  }));

  const prototype =
    artifacts.find((a) => a.type === "fast_prototype_plan") ??
    artifacts.find((a) => a.type === "summary") ??
    artifacts[0];
  const primaryArtifactId = prototype?.id ?? "";

  return {
    artifacts,
    deliverables,
    primaryArtifactId,
    artifactIds: artifacts.map((a) => a.id),
    planned: plan.planned,
    artifactOrchestrationV1: plan.orchestrationState,
    userFacingSummary: plan.orchestration.planningSummary,
  };
}

export function mergeQuickDesignArtifactsIntoState(input: {
  readonly priorArtifacts: readonly ProjectArtifact[] | null | undefined;
  readonly priorDeliverables: readonly IdeationDeliverableAsset[] | null | undefined;
  readonly newArtifacts: readonly ProjectArtifact[];
  readonly projectId: string;
  readonly replacedTypes?: readonly import("@/lib/requirements/projectArtifactTypes").ProjectArtifactType[];
}): ReturnType<typeof mergePlannedArtifactsIntoState> {
  const types =
    input.replacedTypes ??
    ([...new Set(input.newArtifacts.map((a) => a.type))] as import("@/lib/requirements/projectArtifactTypes").ProjectArtifactType[]);
  return mergePlannedArtifactsIntoState({
    priorArtifacts: input.priorArtifacts,
    priorDeliverables: input.priorDeliverables,
    newArtifacts: input.newArtifacts,
    projectId: input.projectId,
    replacedTypes: types,
  });
}

export const QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE = "quick_design_implementation_ready" as const;

export function buildQuickDesignImplementationReadyChatMessage(input: {
  readonly artifactIds: readonly string[];
  readonly artifactTitles: readonly string[];
  readonly planningSummary?: string;
  readonly nowIso: string;
}): RequirementsMessage {
  const titles = input.artifactTitles.length
    ? input.artifactTitles.map((t) => `- ${t}`).join("\n")
    : "- 프로젝트 요약서";

  const content = [
    `**${IMPLEMENTATION_PREP_READY_HEADING}**`,
    "",
    input.planningSummary ??
      "AI팀이 현재 프로젝트 기준으로 필요한 산출물을 구성했습니다. Artifact Hub에서 결과를 확인할 수 있습니다.",
    "",
    "생성된 산출물:",
    titles,
    "",
    "아래 버튼에서 다음 동작을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "NOTICE",
    content,
    createdAt: input.nowIso,
    meta: {
      stage: "REQUIREMENTS",
      internalType: QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE,
      fastPlanArtifactId: input.artifactIds[0] ?? null,
      quickDesignArtifactIds: [...input.artifactIds],
      interviewSuggestions: [...QUICK_DESIGN_IMPLEMENTATION_READY_CHIP_LABELS],
      interviewAllowCustomInput: true,
    },
  });
}

function mergeOrchestrationStagePatch(input: {
  readonly existing: RequirementsOrchestrationStageV1 | null | undefined;
  readonly nowIso: string;
  readonly activePhase: string;
}): RequirementsOrchestrationStageV1 {
  const existing = input.existing;
  return {
    currentStage: existing?.currentStage ?? "IDEATION",
    completedStages: [...(existing?.completedStages ?? [])],
    activePhase: input.activePhase,
    updatedAt: input.nowIso,
  };
}

export function patchRequirementsStageForImplementationPrep(input: {
  readonly existing: RequirementsOrchestrationStageV1 | null | undefined;
  readonly nowIso: string;
}): RequirementsOrchestrationStageV1 {
  return mergeOrchestrationStagePatch({
    existing: input.existing,
    nowIso: input.nowIso,
    activePhase: "READY_FOR_IMPLEMENTATION",
  });
}

export function patchRequirementsStageForImplementationStart(input: {
  readonly existing: RequirementsOrchestrationStageV1 | null | undefined;
  readonly nowIso: string;
}): RequirementsOrchestrationStageV1 {
  return mergeOrchestrationStagePatch({
    existing: input.existing,
    nowIso: input.nowIso,
    activePhase: "IMPLEMENTATION_RUNNING",
  });
}
