import {
  FEATURE_PLANNING_DEFAULT_CATEGORY_NAMES,
  type FeaturePlanningFirstMessageLlmOutputV1,
  type FeaturePlanningRecommendedCategoryV1,
} from "@/lib/featurePlanning/buildFeaturePlanningFirstMessagePrompt";
import { orderedSlotsForFeaturePlanningUi } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

/** LLM 실패 시 — 맥락 없이 슬롯 이름만으로 최소 안내 (클라이언트에서도 사용 가능) */
export function buildFallbackCategoryFirstMessage(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningFirstMessageLlmOutputV1 {
  const ordered = orderedSlotsForFeaturePlanningUi(artifact);
  const core =
    ordered.find((s) => s.slotType === "CORE" || /핵심\s*기능/.test(s.slotName)) ?? ordered[0];
  const names = (core?.items ?? []).map((it) => it.name.trim()).filter(Boolean).slice(0, 7);
  const draftLines =
    names.length > 0
      ? names.map((n, i) => `${i + 1}. ${n}`).join("\n")
      : "1. 주요 기능 A\n2. 주요 기능 B\n3. 주요 기능 C";
  const stepLabel = (core?.slotName ?? ordered[0]?.slotName ?? "선택한 정리 영역").trim();
  const firstMessage = `[초안]\n${draftLines}\n\n[질문]\n「${stepLabel}」에서 첫 버전(MVP)에 반드시 포함할 기능만 골라 주세요. 이번 릴리스에서 빼거나 나중으로 미룰 항목이 있으면 각각 한 줄로 적어 주세요.`;
  const fromSlots = ordered.map((s) => ({
    name: s.slotName.trim(),
    reason: (s.slotDescription ?? s.reason ?? "").trim().replace(/\s+/g, " ").slice(0, 200) || "초안에 포함된 정리 영역입니다.",
  }));
  const recommendedCategories: FeaturePlanningRecommendedCategoryV1[] =
    fromSlots.length >= 3
      ? fromSlots
      : FEATURE_PLANNING_DEFAULT_CATEGORY_NAMES.map((name) => ({ name, reason: "일반적인 SaaS·웹 서비스에서 자주 쓰이는 구분입니다." }));
  return { firstMessage, recommendedCategories, nextFocus: "CATEGORY_SELECTION" };
}
