/**
 * SERVICE_FLOW → FEATURE_DETAIL 전이 시 최소 feature-planning artifact 시드.
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type {
  FeaturePlanningSlotsArtifactV1,
  FeaturePlanningSlotV1,
} from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

export function seedFeaturePlanningArtifactFromServiceFlow(
  flow: RequirementsServiceFlowV1,
  nowIso?: string,
): FeaturePlanningSlotsArtifactV1 {
  const now = nowIso ?? new Date().toISOString();
  const steps = [...(flow.steps ?? [])].sort((a, b) => a.order - b.order);
  const actorNames = (flow.actors ?? []).map((a) => a.name.trim()).filter(Boolean);

  const slots: FeaturePlanningSlotV1[] = steps.map((step) => ({
    slotId: `fp-flow-${step.id}`,
    slotKey: `flow.${step.id}`,
    slotName: step.title,
    slotDescription: `서비스 흐름 단계「${step.title}」에서 파생된 기능 정리 영역`,
    slotType: "FLOW",
    reason: "service-flow stage transition bootstrap",
    sourceRefs: [
      {
        sourceType: "ACTOR_FLOW",
        sourceId: step.id,
        summary: step.title,
      },
    ],
    items: [
      {
        id: `item-${step.id}-core`,
        name: step.title,
        description: String(step.purpose || step.title).trim().slice(0, 1200),
        roleTags: actorNames.slice(0, 4),
      },
    ],
  }));

  return {
    version: 1,
    slots,
    recommendedOrder: slots.map((s) => s.slotId),
    prototypeReadiness: {
      status: "NEEDS_REVIEW",
      missingItems: [],
      notes: "서비스 흐름 전이 후 자동 생성된 초기 기능 정리 골격입니다.",
    },
    updatedAt: now,
    generatedAt: now,
    priorStepActorRoles: actorNames,
  };
}
