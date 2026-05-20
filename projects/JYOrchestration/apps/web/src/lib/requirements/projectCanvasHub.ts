/**
 * Canvas Hub — project orchestration state 기반 상태 Viewer 카탈로그 (not messageId).
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { projectFeatureDetailMetrics } from "@/lib/requirements/featureDetailSlots";
import type { RequirementsServiceFlowV1, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

export type CanvasArtifactType =
  | "service-flow"
  | "alternative-flow"
  | "baseline-flow"
  | "feature-definition"
  | "feature-detail"
  | "screen-definition"
  | "api-definition"
  | "review"
  | "security-review";

export type CanvasArtifactStatus = "draft" | "candidate" | "confirmed" | "obsolete";

export type ProjectCanvasArtifact = Readonly<{
  readonly id: string;
  readonly type: CanvasArtifactType;
  readonly title: string;
  readonly sourceStage: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: CanvasArtifactStatus;
}>;

export function buildProjectCanvasHubCatalog(input: {
  readonly state: RequirementsStateJson;
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
}): readonly ProjectCanvasArtifact[] {
  const sourceStage = resolveAuthoritativeOrchestrationStage(input.state);
  const now = new Date().toISOString();
  const out: ProjectCanvasArtifact[] = [];

  const flow = input.serviceFlow ?? input.state.serviceFlowV1 ?? null;
  if (flow) {
    const hydrated = hydrateServiceFlowStepsFromAlternativePayload(flow);
    const updatedAt = String(hydrated.updatedAt ?? now);
    const confirmed = Boolean(hydrated.flowApproved || hydrated.conversationState === "APPROVED");
    out.push({
      id: "canvas-service-flow-current",
      type: "service-flow",
      title: "현재 서비스 흐름",
      sourceStage,
      version: 1,
      createdAt: String(hydrated.createdAt ?? updatedAt),
      updatedAt,
      status: confirmed ? "confirmed" : "candidate",
    });

    const alt = hydrated.alternativeProposalPayload;
    if (alt) {
      out.push({
        id: `canvas-alternative-${alt.proposalId}`,
        type: "alternative-flow",
        title: alt.directionLabel?.trim() || "후보 서비스 흐름",
        sourceStage,
        version: 1,
        createdAt: updatedAt,
        updatedAt,
        status: "candidate",
      });
      if (alt.baselineFlow) {
        out.push({
          id: `canvas-baseline-${alt.proposalId}`,
          type: "baseline-flow",
          title: "기존안 (비교 기준)",
          sourceStage,
          version: 1,
          createdAt: String(alt.baselineFlow.createdAt ?? updatedAt),
          updatedAt: String(alt.baselineFlow.updatedAt ?? updatedAt),
          status: "confirmed",
        });
      }
    }
  }

  const fd = input.state.featureDetailSlotsV1;
  if (fd?.slots?.length) {
    const metrics = projectFeatureDetailMetrics(fd);
    const updatedAt = String(fd.updatedAt ?? now);
    const status: CanvasArtifactStatus =
      metrics.confirmedFeatureCount > 0 ?
        metrics.featureCoverage >= 0.7 ?
          "confirmed"
        : "partial"
      : "candidate";
    out.push({
      id: "canvas-feature-detail",
      type: "feature-detail",
      title: `세부 기능 (후보 ${metrics.candidateFeatureCount} · 부분 ${metrics.partialFeatureCount} · 확정 ${metrics.confirmedFeatureCount}/${metrics.featureCount})`,
      sourceStage,
      version: fd.version ?? 1,
      createdAt: updatedAt,
      updatedAt,
      status,
    });
  }

  const fp = input.state.featurePlanningSlotsV1;
  if (fp?.slots?.length) {
    const updatedAt = String(fp.updatedAt ?? now);
    out.push({
      id: "canvas-feature-planning",
      type: "feature-definition",
      title: "기능 정의",
      sourceStage,
      version: fp.version ?? 1,
      createdAt: String(fp.generatedAt ?? updatedAt),
      updatedAt,
      status: "draft",
    });
  }

  return out;
}

/** 기능 정의 Artifact Hub 미리보기용 (Canvas는 FeatureDefinitionCanvasOverlay 사용) */
export function featurePlanningToDeliverablePreview(
  artifact: FeaturePlanningSlotsArtifactV1,
  projectId: string,
): import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset {
  const lines = ["# 기능 정의", ""];
  for (const slot of artifact.slots.filter((s) => !s.legacy)) {
    lines.push(`## ${slot.slotName}`, "", slot.slotDescription ?? slot.reason ?? "", "");
  }
  const now = artifact.updatedAt ?? new Date().toISOString();
  return {
    id: "canvas-feature-planning-preview",
    projectId,
    type: "full_plan",
    title: "기능 정의",
    version: artifact.version ?? 1,
    content: lines.join("\n").trim(),
    createdAt: now,
  };
}
