import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import { buildFastPlanGenerationContext, buildFastPlanMarkdown } from "@/lib/requirements/fastPlanGeneration";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  QUICK_DESIGN_AREA_ARTIFACT_TITLES,
  QUICK_DESIGN_IMPLEMENTATION_READY_CHIP_LABELS,
  IMPLEMENTATION_PREP_READY_HEADING,
} from "@/lib/requirements/implementationUxLabels";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { wireStageLabel } from "@/lib/requirements/projectArtifactTypes";
import { buildProjectArtifactContent } from "@/lib/requirements/projectArtifactGenerate";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import type { RequirementsOrchestrationStageV1 } from "@/lib/requirements/requirementsStateJson";

function newArtifactId(nowIso: string, suffix: string): string {
  return `artifact-qd-${suffix}-${nowIso.replace(/[^\d]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
}

function memberDraftBody(drafts: readonly PlatformMemberDraft[] | undefined, role: PlatformMemberRole): string {
  const row = (drafts ?? []).find((d) => d.role === role);
  const content = String(row?.content ?? "").trim();
  return content;
}

function areaMarkdown(input: {
  readonly title: string;
  readonly projectName: string;
  readonly roleSection: string;
  readonly supplemental?: string;
}): string {
  const lines = [`# ${input.title}`, "", `> 프로젝트: **${input.projectName}** · Quick Design 확정 기준`];
  if (input.roleSection) {
    lines.push("", "## AI팀 제안 요약", "", input.roleSection);
  }
  if (input.supplemental?.trim()) {
    lines.push("", "## 보조 자료", "", input.supplemental.trim());
  }
  if (!input.roleSection && !input.supplemental?.trim()) {
    lines.push("", "_Quick Design 초안에서 추출한 내용이 아직 없습니다. 추가 보완으로 보강할 수 있습니다._");
  }
  return lines.join("\n");
}

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
  readonly userFacingSummary: string;
}>;

export function generateQuickDesignConfirmArtifacts(
  input: QuickDesignConfirmArtifactsInput,
): QuickDesignConfirmArtifactsResult {
  const nowIso = input.nowIso;
  const projectName = String(input.projectName ?? "프로젝트").trim() || "프로젝트";
  const stage = wireStageLabel(input.sourceStage);
  const drafts = input.fastPlanDraftV1.memberDrafts;
  const context = buildFastPlanGenerationContext(input);
  const serviceDefinitionBody = areaMarkdown({
    title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.serviceDefinition,
    projectName,
    roleSection: memberDraftBody(drafts, "planner"),
    supplemental: buildFastPlanMarkdown({ projectName, context }),
  });

  const analysisSupplemental = buildProjectArtifactContent({
    artifactType: "service-flow-doc",
    projectName,
    projectDescription: input.projectDescription,
    sourceStage: stage,
    serviceFlow: input.serviceFlow,
  });

  const designSupplemental = buildProjectArtifactContent({
    artifactType: "feature-spec",
    projectName,
    projectDescription: input.projectDescription,
    sourceStage: stage,
    featurePlanning: input.featurePlanning,
  });

  const uiDesignSupplemental = buildProjectArtifactContent({
    artifactType: "screen-spec",
    projectName,
    projectDescription: input.projectDescription,
    sourceStage: stage,
    featurePlanning: input.featurePlanning,
  });

  const artifactSpecs: ReadonlyArray<{
    readonly suffix: string;
    readonly title: string;
    readonly type: ProjectArtifact["type"];
    readonly content: string;
  }> = [
    {
      suffix: "svc-def",
      title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.serviceDefinition,
      type: "summary",
      content: serviceDefinitionBody,
    },
    {
      suffix: "analysis",
      title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.analysis,
      type: "service-flow-doc",
      content: areaMarkdown({
        title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.analysis,
        projectName,
        roleSection: memberDraftBody(drafts, "analyst"),
        supplemental: analysisSupplemental,
      }),
    },
    {
      suffix: "design",
      title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.design,
      type: "feature-spec",
      content: areaMarkdown({
        title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.design,
        projectName,
        roleSection: memberDraftBody(drafts, "architect"),
        supplemental: designSupplemental,
      }),
    },
    {
      suffix: "ui",
      title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.uiDesign,
      type: "screen-spec",
      content: areaMarkdown({
        title: QUICK_DESIGN_AREA_ARTIFACT_TITLES.uiDesign,
        projectName,
        roleSection: memberDraftBody(drafts, "designer"),
        supplemental: uiDesignSupplemental,
      }),
    },
  ];

  const artifacts: ProjectArtifact[] = artifactSpecs.map((spec) => ({
    id: newArtifactId(nowIso, spec.suffix),
    type: spec.type,
    title: spec.title,
    createdAt: nowIso,
    createdBy: "ai" as const,
    sourceStage: stage,
    content: spec.content,
  }));

  const deliverables = artifacts.map((a) => projectArtifactToDeliverableAsset(a, input.projectId));
  const primaryArtifactId = artifacts[0]?.id ?? "";

  return {
    artifacts,
    deliverables,
    primaryArtifactId,
    artifactIds: artifacts.map((a) => a.id),
    userFacingSummary:
      "Quick Design을 확정하고 서비스 정의·분석·설계·디자인 산출물을 Artifact Hub에 저장했습니다.",
  };
}

export const QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE = "quick_design_implementation_ready" as const;

export function buildQuickDesignImplementationReadyChatMessage(input: {
  readonly artifactIds: readonly string[];
  readonly artifactTitles: readonly string[];
  readonly nowIso: string;
}): RequirementsMessage {
  const titles = input.artifactTitles.length
    ? input.artifactTitles.map((t) => `- ${t}`).join("\n")
    : "- 서비스 정의 산출물\n- 분석 산출물\n- 설계 산출물\n- 디자인 산출물";

  const content = [
    `**${IMPLEMENTATION_PREP_READY_HEADING}**`,
    "",
    "AI팀이 구현에 필요한 서비스 정의/분석/설계/디자인 산출물을 구성했습니다.",
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

/** 확정 직후 hub에 넣을 때 기존 동일 제목 Quick Design 산출물 제거 */
export function mergeQuickDesignArtifactsIntoState(input: {
  readonly priorArtifacts: readonly ProjectArtifact[] | null | undefined;
  readonly priorDeliverables: readonly IdeationDeliverableAsset[] | null | undefined;
  readonly newArtifacts: readonly ProjectArtifact[];
  readonly newDeliverables: readonly IdeationDeliverableAsset[];
}): Readonly<{
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
}> {
  const titles = new Set<string>(Object.values(QUICK_DESIGN_AREA_ARTIFACT_TITLES));
  const priorArtifacts = (input.priorArtifacts ?? []).filter((a) => !titles.has(String(a.title ?? "").trim()));
  const priorDeliverables = (input.priorDeliverables ?? []).filter((d) => !titles.has(String(d.title ?? "").trim()));
  return {
    projectArtifacts: [...priorArtifacts, ...input.newArtifacts],
    deliverableAssets: [...priorDeliverables, ...input.newDeliverables],
  };
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
