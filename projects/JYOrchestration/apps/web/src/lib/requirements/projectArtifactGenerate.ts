/**
 * Deterministic artifact body builders — slot/context section generation.
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import { buildFastPlanGenerationContext, buildFastPlanMarkdown } from "@/lib/requirements/fastPlanGeneration";
import {
  buildRichArtifactContent,
  type ArtifactSlotContext,
} from "@/lib/requirements/artifactContentGeneration";
import type { PlatformMemberDraft } from "@/lib/platform-orchestration/types";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  PROJECT_ARTIFACT_LABELS,
  type ProjectArtifact,
  type ProjectArtifactType,
  wireStageLabel,
} from "@/lib/requirements/projectArtifactTypes";

export type ProjectArtifactGenerateInput = Readonly<{
  readonly artifactType: ProjectArtifactType;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly sourceStage?: string | null;
  readonly serviceFlow?: RequirementsServiceFlowV1 | null;
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
  readonly nowIso?: string;
  readonly createdBy?: "ai" | "user";
  readonly titleOverride?: string;
  readonly contentOverride?: string;
  readonly fastPlanContext?: Omit<FastPlanGenerationInput, "nowIso">;
  /** 슬롯·대화·인터뷰 통합 — fastPlanContext와 동일 구조 */
  readonly slotContext?: ArtifactSlotContext | null;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
}>;

function newArtifactId(nowIso: string): string {
  return `artifact-${nowIso.replace(/[^\d]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveSlotContext(input: ProjectArtifactGenerateInput): ArtifactSlotContext | null {
  return input.slotContext ?? input.fastPlanContext ?? null;
}

export function buildProjectArtifactContent(input: ProjectArtifactGenerateInput): string {
  const projectName = String(input.projectName ?? "프로젝트").trim() || "프로젝트";
  const stage = wireStageLabel(input.sourceStage);
  const slotContext = resolveSlotContext(input);

  if (input.artifactType === "fast_prototype_plan" && slotContext) {
    const ctx = buildFastPlanGenerationContext({
      ...slotContext,
      nowIso: input.nowIso ?? new Date().toISOString(),
      projectName: input.projectName ?? slotContext.projectName,
      projectDescription: input.projectDescription ?? slotContext.projectDescription,
      serviceFlow: input.serviceFlow ?? slotContext.serviceFlow,
      featurePlanning: input.featurePlanning ?? slotContext.featurePlanning,
    });
    return buildFastPlanMarkdown({ projectName, context: ctx });
  }

  return buildRichArtifactContent({
    artifactType: input.artifactType,
    projectName,
    projectDescription: String(
      input.projectDescription ?? slotContext?.projectDescription ?? "",
    ).trim(),
    sourceStage: stage,
    serviceFlow: input.serviceFlow ?? slotContext?.serviceFlow ?? null,
    featurePlanning: input.featurePlanning ?? slotContext?.featurePlanning ?? null,
    slotContext,
    memberDrafts: input.memberDrafts,
  });
}

export function generateProjectArtifact(input: ProjectArtifactGenerateInput): ProjectArtifact {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const content = String(input.contentOverride ?? "").trim() || buildProjectArtifactContent(input);
  const title =
    String(input.titleOverride ?? "").trim() || PROJECT_ARTIFACT_LABELS[input.artifactType] || input.artifactType;
  return {
    id: newArtifactId(nowIso),
    type: input.artifactType,
    title,
    createdAt: nowIso,
    createdBy: input.createdBy ?? "ai",
    sourceStage: wireStageLabel(input.sourceStage),
    content,
  };
}
