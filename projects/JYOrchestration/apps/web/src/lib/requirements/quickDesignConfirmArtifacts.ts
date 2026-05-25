import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  QUICK_DESIGN_IMPLEMENTATION_READY_CHIP_LABELS,
  IMPLEMENTATION_PREP_READY_HEADING,
} from "@/lib/requirements/implementationUxLabels";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { PROJECT_ARTIFACT_LABELS } from "@/lib/requirements/projectArtifactTypes";
import {
  generateArtifactsFromPlan,
  mergePlannedArtifactsIntoState,
  planProjectArtifactsFromOrchestrationContext,
  REQUIRED_IMPLEMENTATION_ARTIFACT_TYPES,
  type PlannedProjectArtifact,
} from "@/lib/requirements/projectArtifactPlan";
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
  readonly userFacingSummary: string;
}>;

export function generateQuickDesignConfirmArtifacts(
  input: QuickDesignConfirmArtifactsInput,
): QuickDesignConfirmArtifactsResult {
  const plan = planProjectArtifactsFromOrchestrationContext({
    orchestration: input.orchestration!,
    definitions: input.slotDefinitions,
    serviceFlow: input.serviceFlow,
    featurePlanning: input.featurePlanning,
    memberDrafts: input.fastPlanDraftV1.memberDrafts,
  });

  const requiredForConfirm: PlannedProjectArtifact[] = [...plan.planned.filter((p) => p.priority === "required")];
  for (const artifactType of REQUIRED_IMPLEMENTATION_ARTIFACT_TYPES) {
    if (requiredForConfirm.some((p) => p.artifactType === artifactType)) continue;
    requiredForConfirm.push({
      artifactType,
      title: PROJECT_ARTIFACT_LABELS[artifactType] ?? artifactType,
      priority: "required",
      reason: "구현 준비 필수 표준 산출물",
    });
  }

  const artifacts = generateArtifactsFromPlan({
    plan: requiredForConfirm,
    onlyRequired: false,
    memberDrafts: input.fastPlanDraftV1.memberDrafts,
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

  const titles = artifacts.map((a) => PROJECT_ARTIFACT_LABELS[a.type] ?? a.title).join(", ");

  return {
    artifacts,
    deliverables,
    primaryArtifactId,
    artifactIds: artifacts.map((a) => a.id),
    planned: plan.planned,
    userFacingSummary: `Quick Design을 확정하고 표준 산출물(${titles})을 Artifact Hub에 저장했습니다.`,
  };
}

export function mergeQuickDesignArtifactsIntoState(input: {
  readonly priorArtifacts: readonly ProjectArtifact[] | null | undefined;
  readonly priorDeliverables: readonly IdeationDeliverableAsset[] | null | undefined;
  readonly newArtifacts: readonly ProjectArtifact[];
  readonly projectId: string;
}): ReturnType<typeof mergePlannedArtifactsIntoState> {
  return mergePlannedArtifactsIntoState({
    priorArtifacts: input.priorArtifacts,
    priorDeliverables: input.priorDeliverables,
    newArtifacts: input.newArtifacts,
    projectId: input.projectId,
    replacedTypes: [
      "summary",
      "service-flow-doc",
      "feature-spec",
      "screen-spec",
      "api-spec",
      "fast_prototype_plan",
    ],
  });
}

export const QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE = "quick_design_implementation_ready" as const;

export function buildQuickDesignImplementationReadyChatMessage(input: {
  readonly artifactIds: readonly string[];
  readonly artifactTitles: readonly string[];
  readonly nowIso: string;
}): RequirementsMessage {
  const titles = input.artifactTitles.length
    ? input.artifactTitles.map((t) => `- ${t}`).join("\n")
    : "- 프로젝트 요약서\n- 서비스 흐름 문서\n- 기능 정의서";

  const content = [
    `**${IMPLEMENTATION_PREP_READY_HEADING}**`,
    "",
    "확정된 슬롯을 바탕으로 AI팀이 업무 목적 표준 산출물을 생성해 Artifact Hub에 저장했습니다.",
    "Artifact Hub에서 결과를 확인하거나 바로 구현을 시작할 수 있습니다.",
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
