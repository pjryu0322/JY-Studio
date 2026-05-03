import type { FeaturePlanningSlotV1, FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { buildOrderedSlots } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

/** 이전 단계(액터·서비스 흐름)에서 다룬 역할을 기능정리 최상위 슬롯으로 두지 않는다. */
export function isLegacyRolePlanningSlotByName(slotName: string): boolean {
  const n = slotName.trim().replace(/\s+/g, " ");
  if (!n) return false;
  const compact = n.replace(/\s/g, "");
  if (compact === "사용자역할" || compact === "역할정의" || compact === "사용자구분") return true;
  if (compact === "액터" || compact === "액터정의") return true;
  return false;
}

export function isLegacyRolePlanningSlot(slot: FeaturePlanningSlotV1): boolean {
  if (slot.legacy === true) return true;
  return isLegacyRolePlanningSlotByName(slot.slotName);
}

/** LLM·UI용 — 레거시 역할 슬롯 제외한 아티팩트 뷰 */
export function artifactForFeaturePlanningLlmPrompt(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningSlotsArtifactV1 {
  const slots = artifact.slots.filter((s) => !isLegacyRolePlanningSlot(s));
  const allowed = new Set(slots.map((s) => s.slotId));
  const recommendedOrder = artifact.recommendedOrder.filter((id) => allowed.has(id));
  for (const s of slots) {
    if (!recommendedOrder.includes(s.slotId)) recommendedOrder.push(s.slotId);
  }
  return { ...artifact, slots, recommendedOrder };
}

function dedupRoleNames(names: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const n = raw.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * 저장된 프로젝트 로드 시 — 역할형 슬롯은 raw 유지하되 legacy 표시 + priorStepActorRoles에 이름 누적.
 * (원본 슬롯 배열은 삭제하지 않음)
 */
export function softMigrateLegacyRoleSlotsArtifact(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningSlotsArtifactV1 {
  const extraNames: string[] = [];
  const slots = artifact.slots.map((s) => {
    if (!isLegacyRolePlanningSlotByName(s.slotName) && !s.legacy) return s;
    for (const it of s.items) {
      const nm = it.name.trim();
      if (nm) extraNames.push(nm);
    }
    return { ...s, legacy: true as const };
  });
  const merged = dedupRoleNames([...(artifact.priorStepActorRoles ?? []), ...extraNames]);
  return {
    ...artifact,
    slots,
    ...(merged.length ? { priorStepActorRoles: merged } : {}),
  };
}

/**
 * 초기 생성 LLM 응답 직후 — 역할형 최상위 슬롯은 제거하고 항목 이름만 priorStepActorRoles로 옮긴다.
 */
export function stripLegacyRoleSlotsFromNewInitializeArtifact(
  artifact: FeaturePlanningSlotsArtifactV1,
  seedActorRoleNames: readonly string[]
): FeaturePlanningSlotsArtifactV1 {
  const fromStrip: string[] = [...seedActorRoleNames];
  const kept: FeaturePlanningSlotV1[] = [];
  for (const s of artifact.slots) {
    if (isLegacyRolePlanningSlotByName(s.slotName)) {
      for (const it of s.items) {
        const nm = it.name.trim();
        if (nm) fromStrip.push(nm);
      }
      continue;
    }
    kept.push(s);
  }
  const allowed = new Set(kept.map((s) => s.slotId));
  const recommendedOrder = artifact.recommendedOrder.filter((id) => allowed.has(id));
  for (const s of kept) {
    if (!recommendedOrder.includes(s.slotId)) recommendedOrder.push(s.slotId);
  }
  const priorStepActorRoles = dedupRoleNames([...(artifact.priorStepActorRoles ?? []), ...fromStrip]);
  return {
    ...artifact,
    slots: kept,
    recommendedOrder,
    ...(priorStepActorRoles.length ? { priorStepActorRoles } : {}),
  };
}

export function buildOrderedSlotsVisible(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningSlotV1[] {
  return buildOrderedSlots(artifact).filter((s) => !isLegacyRolePlanningSlot(s));
}

/** UI·워크스페이스 활성 슬롯 — 가시 영역이 없을 때만 전체 순서로 폴백 */
export function orderedSlotsForFeaturePlanningUi(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningSlotV1[] {
  const v = buildOrderedSlotsVisible(artifact);
  return v.length ? v : buildOrderedSlots(artifact);
}

/** 플래너 턴 결과에 이전 아티팩트의 레거시 역할 슬롯을 다시 합친다(LLM 프롬프트에서 제외했을 때 소실 방지). */
export function mergePlannerArtifactPreservingLegacySlots(
  previous: FeaturePlanningSlotsArtifactV1,
  plannerOut: FeaturePlanningSlotsArtifactV1
): FeaturePlanningSlotsArtifactV1 {
  const legacyPrev = previous.slots.filter(isLegacyRolePlanningSlot);
  if (!legacyPrev.length) return plannerOut;
  const outIds = new Set(plannerOut.slots.map((s) => s.slotId));
  const append = legacyPrev.filter((s) => !outIds.has(s.slotId));
  if (!append.length) return plannerOut;
  const mergedSlots = [...plannerOut.slots, ...append];
  const ro = [...plannerOut.recommendedOrder];
  for (const s of append) {
    if (!ro.includes(s.slotId)) ro.push(s.slotId);
  }
  const prior = dedupRoleNames([...(previous.priorStepActorRoles ?? []), ...(plannerOut.priorStepActorRoles ?? [])]);
  return {
    ...plannerOut,
    slots: mergedSlots,
    recommendedOrder: ro,
    ...(prior.length ? { priorStepActorRoles: prior } : {}),
    planningTopic: (plannerOut.planningTopic ?? previous.planningTopic ?? "FEATURES") as FeaturePlanningTopicV1,
  };
}
