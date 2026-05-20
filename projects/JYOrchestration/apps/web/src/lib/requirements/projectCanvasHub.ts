/**
 * Canvas Hub — project orchestration state 기반 viewer catalog (not messageId).
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { PROJECT_ARTIFACT_LABELS, type ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsServiceFlowV1, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

export type CanvasArtifactType =
  | "service-flow"
  | "alternative-flow"
  | "service-flow-baseline"
  | "feature-definition"
  | "screen-definition"
  | "api-definition"
  | "deliverable"
  | "markdown-export"
  | "pdf-export";

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
  readonly openTarget:
    | Readonly<{ readonly kind: "alternative-canvas" }>
    | Readonly<{ readonly kind: "deliverable"; readonly assetId: string }>;
}>;

function artifactTypeToCanvasType(type: ProjectArtifactType): CanvasArtifactType {
  if (type === "screen-spec") return "screen-definition";
  if (type === "api-spec") return "api-definition";
  if (type === "feature-spec") return "feature-definition";
  if (type === "service-flow-doc") return "service-flow";
  if (type === "markdown-export") return "markdown-export";
  if (type === "pdf-export") return "pdf-export";
  return "deliverable";
}

export function buildProjectCanvasHubCatalog(input: {
  readonly state: RequirementsStateJson;
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
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
      openTarget: { kind: "alternative-canvas" },
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
        openTarget: { kind: "alternative-canvas" },
      });
      if (alt.baselineFlow) {
        out.push({
          id: `canvas-baseline-${alt.proposalId}`,
          type: "service-flow-baseline",
          title: "기존안 (비교 기준)",
          sourceStage,
          version: 1,
          createdAt: String(alt.baselineFlow.createdAt ?? updatedAt),
          updatedAt: String(alt.baselineFlow.updatedAt ?? updatedAt),
          status: "confirmed",
          openTarget: { kind: "alternative-canvas" },
        });
      }
    }
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
      openTarget: { kind: "deliverable", assetId: "canvas-feature-planning-preview" },
    });
  }

  for (const asset of input.deliverableAssets ?? []) {
    out.push({
      id: `canvas-deliverable-${asset.id}`,
      type: "deliverable",
      title: asset.title,
      sourceStage: "IDEATION",
      version: asset.version ?? 1,
      createdAt: asset.createdAt,
      updatedAt: asset.createdAt,
      status: asset.confirmedAt ? "confirmed" : "draft",
      openTarget: { kind: "deliverable", assetId: asset.id },
    });
  }

  for (const art of input.projectArtifacts ?? []) {
    out.push({
      id: `canvas-artifact-${art.id}`,
      type: artifactTypeToCanvasType(art.type),
      title: PROJECT_ARTIFACT_LABELS[art.type] ?? art.title,
      sourceStage: art.sourceStage,
      version: 1,
      createdAt: art.createdAt,
      updatedAt: art.createdAt,
      status: "draft",
      openTarget: { kind: "deliverable", assetId: art.id },
    });
  }

  return out;
}

/** Feature-planning canvas preview용 deliverable-shaped content */
export function featurePlanningToDeliverablePreview(
  artifact: FeaturePlanningSlotsArtifactV1,
  projectId: string,
): IdeationDeliverableAsset {
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
