import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  QUICK_DESIGN_IMPLEMENTATION_READY_WITH_ENV_HEADING,
  QUICK_DESIGN_IMPLEMENTATION_SEED_NEEDS_REVIEW_HEADING,
  QUICK_DESIGN_PLANNING_SEED_READY_HEADING,
} from "@/lib/requirements/implementationUxLabels";
import type { ImplementationSurfaceReadiness } from "@/lib/requirements/implementationReadinessGates";
import { formatImplementationTaskListSummarySection } from "@/lib/requirements/implementationTaskList";
import { resolveImplementationCandidateGapKeys } from "@/lib/requirements/implementationCandidateLabels";
import {
  formatQuickDesignImplementationPrepSummaryLines,
  type QuickDesignConfirmImplementationPrepResult,
} from "@/lib/requirements/quickDesignConfirmImplementationPrep";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
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
import { formatCodeTaskLlmRefinementUserSummaryLines } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";

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

export function resolveQuickDesignImplementationReadyCopy(input: {
  readonly state: ImplementationSurfaceReadiness;
  readonly autoConfirmedRequired: boolean;
}): Readonly<{ readonly heading: string; readonly intro: string; readonly prepInfoSectionLabel: string }> {
  if (!input.state.hasReferenceArtifacts || !input.state.designOk || !input.state.seedReady) {
    return {
      heading: QUICK_DESIGN_IMPLEMENTATION_SEED_NEEDS_REVIEW_HEADING,
      intro: [
        "AI팀이 Quick Design 기준으로 기획 산출물과 구현 Seed 후보를 생성했습니다.",
        "구현 작업목록 생성을 위해 일부 항목은 아직 확정이 필요합니다.",
        "",
        "필요한 항목을 확인하거나 AI팀에게 보완을 요청해 주세요.",
      ].join("\n"),
      prepInfoSectionLabel: "보완이 필요한 항목:",
    };
  }

  if (!input.state.envOk) {
    return {
      heading: QUICK_DESIGN_PLANNING_SEED_READY_HEADING,
      intro: input.autoConfirmedRequired
        ? [
            "AI팀이 기획 산출물과 구현 준비정보(Implementation Seed)를 자동 생성·확정했고,",
            "AI 개발자가 실행할 구현 작업목록도 준비했습니다.",
            "다만 코드 에이전트 WIP 작업 전 실행 환경 설정이 필요합니다.",
          ].join("\n")
        : [
            "AI팀이 기획 산출물과 구현 준비정보를 정리했고,",
            "AI 개발자가 실행할 구현 작업목록도 준비했습니다.",
            "코드 에이전트 WIP 작업 전 실행 환경 설정이 필요합니다.",
          ].join("\n"),
      prepInfoSectionLabel: "구현 준비정보:",
    };
  }

  return {
    heading: QUICK_DESIGN_IMPLEMENTATION_READY_WITH_ENV_HEADING,
    intro: input.autoConfirmedRequired
      ? [
          "AI팀이 기획 산출물과 구현 준비정보(Implementation Seed)를 자동 생성·확정했고,",
          "AI 개발자가 실행할 구현 작업목록도 준비했습니다.",
          "실행 환경도 준비되었습니다.",
          "",
          "구현단계로 이동해 준비된 작업목록을 기준으로 구현을 시작할 수 있습니다.",
        ].join("\n")
      : [
          "AI팀이 기획 산출물과 구현 준비정보를 정리했고,",
          "AI 개발자가 실행할 구현 작업목록도 준비했습니다.",
          "실행 환경도 준비되었습니다.",
          "",
          "구현단계로 이동해 준비된 작업목록을 기준으로 구현을 시작할 수 있습니다.",
        ].join("\n"),
    prepInfoSectionLabel: "구현 준비정보:",
  };
}

export function buildQuickDesignImplementationReadyChatMessage(input: {
  readonly artifactIds: readonly string[];
  readonly artifactTitles: readonly string[];
  readonly planningSummary?: string;
  readonly nowIso: string;
  readonly prep: QuickDesignConfirmImplementationPrepResult;
  readonly definitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): RequirementsMessage {
  const titles = input.artifactTitles.length
    ? input.artifactTitles.map((t) => `- ${t}`).join("\n")
    : "- 프로젝트 요약서";

  const copy = resolveQuickDesignImplementationReadyCopy({
    state: input.prep.postConfirmState,
    autoConfirmedRequired: input.prep.autoConfirmedRequired,
  });

  const prepSummaryLines = formatQuickDesignImplementationPrepSummaryLines({
    prepComplete: input.prep.postConfirmState.seedReady,
    readiness: input.prep.readiness,
    autoCandidateGenerated: input.prep.autoCandidateGenerated,
    touchedGapKeys: input.prep.touchedGapKeys,
    orchestration: input.prep.orchestration,
    definitions: input.definitions,
  });

  const qualityWarningCount =
    input.prep.implementationCodeTaskQualityGateV1?.status === "warning"
      ? input.prep.implementationCodeTaskQualityGateV1.warningCount
      : 0;
  const hasQualityWarnings = qualityWarningCount > 0;
  const executionReady =
    Boolean(input.prep.implementationTaskListV1?.tasks?.length) &&
    Boolean(input.prep.implementationCodeTaskPlanV1?.tasks?.length) &&
    Boolean(input.prep.cursorWorkItemsV1?.length) &&
    input.prep.implementationWorkItemPreflightSummaryV1?.status !== "failed" &&
    input.prep.implementationCodeTaskQualityGateV1 != null &&
    input.prep.implementationCodeTaskQualityGateV1.status !== "failed";

  const readinessSummaryLines = executionReady
    ? [
        "구현 준비가 완료되었습니다.",
        ...(hasQualityWarnings
          ? [`주의 항목 ${qualityWarningCount}개가 있지만 구현단계 진행은 가능합니다.`]
          : []),
        "상세 내용은 로그 탭의 실행 로그에서 확인할 수 있습니다.",
      ]
    : [
        "구현 준비 보완이 필요합니다.",
        "일부 구현 준비 산출물에 보완이 필요하여 구현단계 자동실행을 바로 시작할 수 없습니다.",
        "상세 내용은 로그 탭의 실행 로그에서 확인할 수 있습니다.",
      ];

  const implementationCandidateGapKeys = resolveImplementationCandidateGapKeys({
    touchedGapKeys: input.prep.touchedGapKeys,
    autoCandidateGenerated: input.prep.autoCandidateGenerated,
    orchestration: input.prep.orchestration,
    definitions: input.definitions,
  });

  const contentParts = [
    `**${copy.heading}**`,
    "",
    ...readinessSummaryLines,
    "",
    copy.intro,
    "",
    "생성된 산출물:",
    titles,
    "",
    copy.prepInfoSectionLabel,
    ...prepSummaryLines,
  ];

  const llmRefinementLines = formatCodeTaskLlmRefinementUserSummaryLines(
    input.prep.implementationCodeTaskPlanV1,
  );
  if (llmRefinementLines.length) {
    contentParts.push("", ...llmRefinementLines);
  }

  contentParts.push(...formatImplementationTaskListSummarySection(input.prep.implementationTaskListV1));

  if (!input.prep.postConfirmState.seedReady && input.planningSummary?.trim()) {
    contentParts.push("", input.planningSummary.trim());
  }

  contentParts.push("", "다음 작업을 선택해 주세요.");

  const content = contentParts.join("\n");

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
      interviewSuggestions: [...input.prep.chipLabels],
      interviewAllowCustomInput: true,
      ...(implementationCandidateGapKeys.length
        ? { implementationCandidateGapKeys: [...implementationCandidateGapKeys] }
        : {}),
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
