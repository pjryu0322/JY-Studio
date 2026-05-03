import { ensureFeaturePlanningQuestionSuffix } from "./featurePlanningInteractiveBubble";
import { buildOrderedSlotsVisible } from "./featurePlanningLegacyRoleSlots";
import type { FeaturePlanningSlotV1, FeaturePlanningSlotsArtifactV1 } from "./featurePlanningSlotsArtifact";
import { buildOrderedSlots } from "./featurePlanningSlotsArtifact";

export type FeaturePlanningSlotNavChipV1 = {
  readonly slotId: string;
  readonly label: string;
};

export type FeaturePlanningWorkspaceChatMessageV1 = {
  id: string;
  role: "user" | "ai";
  text: string;
  at: string;
  /** AI 턴 요약 카드(채팅 본문과 분리) */
  resultSummary?: { title: string; lines: readonly string[] };
  /** 첫 진입 등 — UI·분석용(선택) */
  plannerSurface?: "category_selection" | "initial_entry";
  /** 「이어지는 영역」— 대화창에서 영역 초안 펼치기 버튼(선택) */
  slotNavChips?: readonly FeaturePlanningSlotNavChipV1[];
};

/** 카테고리 확정용 첫 말풍선 — LLM이 [초안]/[질문]을 썼다면 그대로 두고, 질문만 보강 */
export function composePlannerCategoryIntroduction(
  firstMessage: string,
  _categories: readonly { name: string; reason?: string }[]
): string {
  return ensureFeaturePlanningQuestionSuffix(firstMessage.trim());
}

/** 슬롯 데이터가 없을 때 복구용 안내( AI 말풍선으로 쓰이지 않도록 짧은 시스템 안내 문구) */
export const FEATURE_PLANNING_CHAT_EMPTY_BOOTSTRAP_AI_MESSAGE =
  "기능 정리 슬롯이 아직 없습니다. 기능정리 초기화가 완료될 때까지 기다리거나, 페이지를 새로고침해 주세요.";

const MAX_ITEM_DESC_CHARS = 200;
const MAX_ITEMS_FIRST_SLOT = 24;

/** 채팅에 붙이는 정리 초안 범위 — 짧은 질문과 맞물리지 않게 전체를 한꺼번에 펼치지 않는다. */
export type FeaturePlanningChatDigestScope = "firstFullOnly" | "firstFullWithRestTitles" | "full";

function appendOneSlotFullLines(chunks: string[], slot: FeaturePlanningSlotV1, rank: number): void {
  chunks.push("");
  chunks.push(`■ ${rank}. ${slot.slotName}`);
  const area = (slot.slotDescription ?? slot.reason ?? "").trim().replace(/\s+/g, " ");
  if (area) {
    chunks.push(`  ${area.length > 280 ? `${area.slice(0, 280)}…` : area}`);
  }
  const items = slot.items ?? [];
  const slice = items.slice(0, MAX_ITEMS_FIRST_SLOT);
  for (const it of slice) {
    const d = (it.description ?? "").trim().replace(/\s+/g, " ");
    const dcl = d.length > MAX_ITEM_DESC_CHARS ? `${d.slice(0, MAX_ITEM_DESC_CHARS)}…` : d;
    const tags = it.roleTags?.length ? ` [${it.roleTags.join(", ")}]` : "";
    chunks.push(`  · ${it.name.trim()}${tags}${dcl ? ` — ${dcl}` : ""}`);
  }
  if (items.length > MAX_ITEMS_FIRST_SLOT) {
    chunks.push(`  · … 외 ${items.length - MAX_ITEMS_FIRST_SLOT}개 항목`);
  }
}

/**
 * 채팅에 붙이는 정리 초안 미리보기.
 * - firstFullOnly: **첫 영역만** 항목까지 (플래너 턴 — 질문이 특정 영역을 가리킬 때 전체 초안을 깔지 않음)
 * - firstFullWithRestTitles: 첫 영역 상세 + 나머지는 **제목만** 한 줄 (초기 로드·복구)
 * - full: 모든 영역 상세 (디버그·특수 용도, 기본 비사용)
 */
export function buildFeaturePlanningChatSlotPreviewAppendix(
  artifact: FeaturePlanningSlotsArtifactV1,
  scope: FeaturePlanningChatDigestScope = "firstFullWithRestTitles",
  options?: { readonly includeFooter?: boolean; readonly omitRestTitlesParagraph?: boolean }
): string {
  const includeFooter = options?.includeFooter !== false;
  const visible = buildOrderedSlotsVisible(artifact);
  const ordered = visible.length ? visible : buildOrderedSlots(artifact);
  if (!ordered.length) return "";

  const chunks: string[] = [];
  const head =
    scope === "firstFullOnly"
      ? "【정리 초안 · 첫 번째 영역】아래는 지금 순서상 **맨 앞** 정리 영역만 펼칩니다."
      : scope === "firstFullWithRestTitles"
        ? "【정리 초안】첫 번째 영역만 항목까지 보여 드리고, 나머지는 이름만 안내합니다."
        : "【정리 초안】전체 영역을 펼칩니다.";

  chunks.push("", "──────────", head);

  const first = ordered[0];
  appendOneSlotFullLines(chunks, first, 1);

  if (scope === "firstFullWithRestTitles" && ordered.length > 1 && !options?.omitRestTitlesParagraph) {
    const titles = ordered.slice(1).map((x) => `「${x.slotName}」`).join(" ");
    chunks.push("");
    chunks.push(`이어지는 영역: ${titles}`);
    chunks.push("(나머지 영역은 대화 아래 버튼으로 펼치거나, 보고 싶은 영역 이름을 말씀해 주세요.)");
  }

  if (scope === "full") {
    for (let idx = 1; idx < ordered.length; idx++) {
      appendOneSlotFullLines(chunks, ordered[idx], idx + 1);
    }
  }

  if (includeFooter) {
    chunks.push("");
    chunks.push("맞다고 생각되면 그대로 두셔도 되고, 빠지거나 바꿀 내용이 있으면 말로 짚어 주세요.");
  }
  return chunks.join("\n");
}

/** `firstFullWithRestTitles` 부록 기준 — 첫 영역을 제외한 영역 버튼용 */
export function buildRestSlotNavChipsFromArtifact(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningSlotNavChipV1[] {
  const visible = buildOrderedSlotsVisible(artifact);
  const ordered = visible.length ? visible : buildOrderedSlots(artifact);
  return ordered
    .slice(1)
    .map((s) => ({ slotId: s.slotId, label: s.slotName.trim() }))
    .filter((c) => c.slotId && c.label);
}

/** 저장된 AI 말풍선 텍스트에서 「이어지는 영역」이름 추출 → slotId 매칭 */
export function inferRestSlotNavChipsFromMessageText(
  text: string,
  artifact: FeaturePlanningSlotsArtifactV1
): FeaturePlanningSlotNavChipV1[] {
  const idx = text.indexOf("이어지는 영역:");
  if (idx < 0) return [];
  const head = text.slice(idx);
  const firstLine = (head.split("\n").find((l) => l.includes("이어지는 영역:")) ?? "").trim();
  const labels: string[] = [];
  const re = /「([^」]+)」/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(firstLine)) !== null) {
    const lab = m[1].trim();
    if (lab) labels.push(lab);
  }
  const visible = buildOrderedSlotsVisible(artifact);
  const ordered = visible.length ? visible : buildOrderedSlots(artifact);
  const byName = new Map(ordered.map((s) => [s.slotName.trim(), s.slotId]));
  const chips: FeaturePlanningSlotNavChipV1[] = [];
  for (const label of labels) {
    const slotId = byName.get(label);
    if (slotId) chips.push({ slotId, label });
  }
  return chips;
}

/** 대화창에 붙일 단일 영역 초안(【정리 초안 · 이름】 + 항목) */
export function buildSingleSlotDigestForChat(artifact: FeaturePlanningSlotsArtifactV1, slotId: string): string {
  const visible = buildOrderedSlotsVisible(artifact);
  const ordered = visible.length ? visible : buildOrderedSlots(artifact);
  const slot = ordered.find((s) => s.slotId === slotId) ?? artifact.slots.find((s) => s.slotId === slotId);
  if (!slot) return "";
  const chunks: string[] = ["", "──────────", `【정리 초안 · ${slot.slotName.trim()}】`];
  appendOneSlotFullLines(chunks, slot, 1);
  chunks.push("");
  chunks.push("수정이 필요하면 말로 짚어 주세요. 다른 영역은 아래 버튼으로 펼칠 수 있습니다.");
  return chunks.join("\n");
}

/** 칩이 있을 때 본문에서 이어지는 영역 안내 블록 제거(버튼으로 대체) */
export function stripRestTitlesParagraphForDisplay(text: string): string {
  if (!text.includes("이어지는 영역:")) return text;
  return text
    .replace(
      /\n\n이어지는 영역:[^\n]+\n\(나머지 영역의 항목은 여기서 한꺼번에 펼치지 않습니다\. 상단 진행도로 정리 현황을 열거나, 보고 싶은 영역 이름을 말씀해 주세요\.\)\s*/g,
      "\n\n"
    )
    .replace(
      /\n\n이어지는 영역:[^\n]+\n\(나머지 영역은 대화 아래 버튼으로 펼치거나, 보고 싶은 영역 이름을 말씀해 주세요\.\)\s*/g,
      "\n\n"
    )
    .replace(/\n\n이어지는 영역:[^\n]+\s*/g, "\n\n");
}

/** 기존 저장본 + 빈 채팅 복구 시 — 채팅 안에서 첫 영역부터 초안을 볼 수 있게 */
export function buildFeaturePlanningSlotCentricBootstrapMessage(artifact: FeaturePlanningSlotsArtifactV1 | null): string {
  if (!artifact?.slots?.length) return FEATURE_PLANNING_CHAT_EMPTY_BOOTSTRAP_AI_MESSAGE;
  const visible = buildOrderedSlotsVisible(artifact);
  const ordered = visible.length ? visible : buildOrderedSlots(artifact);
  const first = ordered[0];
  if (!first) return FEATURE_PLANNING_CHAT_EMPTY_BOOTSTRAP_AI_MESSAGE;
  const firstTitle = first.slotName.trim();
  const hasMoreAreas = ordered.length > 1;
  const intro =
    `아래【정리 초안】에는 순서상 **맨 앞** 영역인 **「${firstTitle}」**만 항목까지 펼쳐 두었습니다.\n\n` +
    `**①** **「${firstTitle}」** 초안이 서비스에 맞는지, 빠지거나 바꿀 항목이 있으면 말로 짚어 주세요.\n\n` +
    (hasMoreAreas
      ? `**②** **「${firstTitle}」** 대신 다른 영역부터 보고 싶다면, 아래 초안에 이어지는 영역 **이름을 그대로** 한 줄로 보내 주세요.\n\n`
      : "") +
    "답을 주시면 이 대화에 반영해 초안을 다듬겠습니다.";
  const appendix = buildFeaturePlanningChatSlotPreviewAppendix(artifact, "firstFullWithRestTitles", {
    includeFooter: false,
    omitRestTitlesParagraph: true,
  });
  return `${intro}${appendix}`;
}

export type FeaturePlanningWorkspaceChatV1 = {
  messages: FeaturePlanningWorkspaceChatMessageV1[];
};

export function parseFeaturePlanningWorkspaceChatV1(raw: unknown): FeaturePlanningWorkspaceChatV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const arr = Array.isArray(o.messages) ? o.messages : null;
  if (!arr) return null;
  const messages: FeaturePlanningWorkspaceChatMessageV1[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const role = r.role === "user" || r.role === "ai" ? r.role : null;
    const text = typeof r.text === "string" ? r.text.trim() : "";
    const at = typeof r.at === "string" ? r.at.trim() : "";
    if (!id || !role || !at) continue;
    const rsRaw = r.resultSummary;
    let resultSummary: { title: string; lines: readonly string[] } | undefined;
    if (rsRaw && typeof rsRaw === "object" && !Array.isArray(rsRaw)) {
      const rs = rsRaw as Record<string, unknown>;
      const title = typeof rs.title === "string" ? rs.title.trim() : "";
      const linesArr = Array.isArray(rs.lines) ? rs.lines : null;
      const lines = linesArr
        ? linesArr.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24)
        : [];
      if (title && lines.length) {
        resultSummary = { title: title.slice(0, 200), lines };
      }
    }
    if (!text && !resultSummary) continue;
    const ps =
      r.plannerSurface === "category_selection"
        ? "category_selection"
        : r.plannerSurface === "initial_entry"
          ? "initial_entry"
          : undefined;
    const chipsRaw = r.slotNavChips;
    let slotNavChips: FeaturePlanningSlotNavChipV1[] | undefined;
    if (Array.isArray(chipsRaw)) {
      const tmp: FeaturePlanningSlotNavChipV1[] = [];
      for (const c of chipsRaw) {
        if (!c || typeof c !== "object") continue;
        const o = c as Record<string, unknown>;
        const sid = typeof o.slotId === "string" ? o.slotId.trim() : "";
        const lab = typeof o.label === "string" ? o.label.trim() : "";
        if (sid && lab) tmp.push({ slotId: sid.slice(0, 128), label: lab.slice(0, 200) });
      }
      if (tmp.length) slotNavChips = tmp;
    }
    messages.push({
      id: id.slice(0, 128),
      role,
      text: text.slice(0, 32000) || " ",
      at: at.slice(0, 64),
      ...(resultSummary ? { resultSummary } : {}),
      ...(ps ? { plannerSurface: ps } : {}),
      ...(slotNavChips ? { slotNavChips } : {}),
    });
  }
  return messages.length ? { messages: messages.slice(-200) } : { messages: [] };
}

export function buildFeaturePlanningChatTranscript(messages: readonly FeaturePlanningWorkspaceChatMessageV1[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "사용자" : "AI"} (${m.at}): ${m.text}`)
    .join("\n\n")
    .slice(0, 24000);
}

export function newFeaturePlanningMessageId(): string {
  try {
    return `fp_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  } catch {
    return `fp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
