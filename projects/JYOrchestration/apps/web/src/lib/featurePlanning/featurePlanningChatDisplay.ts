import type { WorkspaceChatMessage } from "@/components/workspace/WorkspaceChatPanel";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  buildRestSlotNavChipsFromArtifact,
  inferRestSlotNavChipsFromMessageText,
  stripRestTitlesParagraphForDisplay,
} from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { buildOrderedSlotsVisible } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import { sanitizeFeaturePlanningUserVisibleKorean } from "@/lib/featurePlanning/featurePlanningUserVisibleSanitize";

function isSingleSlotDigestBubble(text: string): boolean {
  return text.includes("【정리 초안 ·") || text.includes("【정리 초안·");
}

/** 기능 정리 채팅 — 이어지는 영역을 칩으로 바꿔 보이기 */
export function enrichFeaturePlanningDisplayMessages(
  messages: readonly WorkspaceChatMessage[],
  artifact: FeaturePlanningSlotsArtifactV1 | null
): WorkspaceChatMessage[] {
  const sanitized = messages.map((m) =>
    m.role === "ai" ? { ...m, text: sanitizeFeaturePlanningUserVisibleKorean(m.text) } : m
  );
  if (!artifact?.slots?.length) return sanitized;
  const visible = buildOrderedSlotsVisible(artifact);
  if (visible.length < 2) return sanitized;

  return sanitized.map((m) => {
    if (m.role !== "ai") return m;
    if (m.slotNavChips?.length) {
      return { ...m, text: stripRestTitlesParagraphForDisplay(m.text) };
    }
    if (isSingleSlotDigestBubble(m.text)) return m;
    const hasDigest = m.text.includes("【정리 초안】");
    if (!hasDigest) return m;
    const fromLine = inferRestSlotNavChipsFromMessageText(m.text, artifact);
    const chips = fromLine.length ? fromLine : buildRestSlotNavChipsFromArtifact(artifact);
    if (!chips.length) return m;
    const text = m.text.includes("이어지는 영역:") ? stripRestTitlesParagraphForDisplay(m.text) : m.text;
    return { ...m, text, slotNavChips: chips };
  });
}
