import type {
  FeatureWorkspaceChatMessageV1,
  FeatureWorkspaceItemV1,
  FeatureWorkspaceStageV1,
  FeatureWorkspaceV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

export function newFeatureWorkspaceItemId(): string {
  try {
    return `f_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  } catch {
    return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

function chatId(): string {
  try {
    return `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  } catch {
    return `c_${Date.now().toString(36)}`;
  }
}

/** 승인된 서비스 흐름 단계만 순서대로 슬롯(스테이지)으로 변환합니다. */
export function buildFeatureStagesFromApprovedFlow(flow: RequirementsServiceFlowV1 | null): FeatureWorkspaceStageV1[] {
  if (!flow || !Array.isArray(flow.steps)) return [];
  const approved = flow.steps.filter((s) => s.approved).sort((a, b) => a.order - b.order);
  return approved.map((st) => ({
    stageKey: st.id,
    title: st.title,
    features: [] as readonly FeatureWorkspaceItemV1[],
  }));
}

/**
 * 자동 분석: 현재 승인 흐름으로 슬롯을 재구성하고, 동일 `stageKey`에 대해 기존 기능 항목은 유지합니다.
 * (승인 데이터 `serviceFlowV1`는 읽기만 하고 변경하지 않습니다.)
 */
export function mergeFeatureWorkspaceStagesWithFlow(
  prev: FeatureWorkspaceV1 | null,
  flow: RequirementsServiceFlowV1 | null
): FeatureWorkspaceV1 {
  const nextStages = buildFeatureStagesFromApprovedFlow(flow);
  const prevByKey = new Map((prev?.stages ?? []).map((s) => [s.stageKey, s] as const));
  const stages: FeatureWorkspaceStageV1[] = nextStages.map((slot) => {
    const old = prevByKey.get(slot.stageKey);
    const kept = (old?.features ?? []).map((f, i) => ({
      ...f,
      order: typeof f.order === "number" ? f.order : i,
    }));
    return {
      stageKey: slot.stageKey,
      title: slot.title,
      features: kept.length ? kept : ([] as readonly FeatureWorkspaceItemV1[]),
    };
  });
  const selected =
    prev?.selectedStageKey && stages.some((s) => s.stageKey === prev.selectedStageKey)
      ? prev.selectedStageKey
      : stages[0]?.stageKey ?? null;
  const intro: FeatureWorkspaceChatMessageV1 = {
    id: chatId(),
    role: "ai",
    text:
      stages.length === 0
        ? "승인된 서비스 흐름 단계가 없습니다. 액터 및 서비스 흐름 정의에서 단계를 승인한 뒤 다시 자동 분석을 실행해 주세요."
        : `서비스 흐름 ${stages.length}개 단계를 기능 슬롯으로 구성했습니다. 단계를 선택한 뒤 AI기획자와 질문·답변으로 기능을 채워 나가면 됩니다.`,
    at: isoNow(),
  };
  const baseChat = prev?.chat?.length ? [...prev.chat] : [];
  return {
    version: 1,
    updatedAt: isoNow(),
    chat: [...baseChat, intro],
    stages,
    selectedStageKey: selected,
    plannerHint:
      stages.length === 0
        ? "근거 데이터가 부족합니다."
        : `현재 선택: ${stages.find((s) => s.stageKey === selected)?.title ?? "없음"}. 단계별로 필요한 기능을 질문으로 좁혀 갑니다.`,
  };
}

export function appendUserChatMessage(
  workspace: FeatureWorkspaceV1,
  text: string
): { next: FeatureWorkspaceV1; message: FeatureWorkspaceChatMessageV1 } {
  const msg: FeatureWorkspaceChatMessageV1 = {
    id: chatId(),
    role: "user",
    text: text.trim().slice(0, 12000),
    at: isoNow(),
  };
  return {
    message: msg,
    next: {
      ...workspace,
      updatedAt: isoNow(),
      chat: [...workspace.chat, msg],
    },
  };
}

export function appendAiChatMessage(workspace: FeatureWorkspaceV1, text: string): FeatureWorkspaceV1 {
  const msg: FeatureWorkspaceChatMessageV1 = {
    id: chatId(),
    role: "ai",
    text: text.trim().slice(0, 12000),
    at: isoNow(),
  };
  return {
    ...workspace,
    updatedAt: isoNow(),
    chat: [...workspace.chat, msg],
  };
}

export function plannerQuestionForStage(stageTitle: string, actorsLine: string): string {
  return `「${stageTitle}」 단계에서 ${actorsLine ? `${actorsLine} 관점으로 ` : ""}필수 동작·예외 처리·권한 중 무엇을 먼저 정리할까요? 예: 실패 시 재시도, 진행률 표시, 역할별 제한 등을 구체화해 주세요.`;
}

export function suggestPlannerHintFromGaps(stages: readonly FeatureWorkspaceStageV1[]): string {
  const empty = stages.filter((s) => s.features.length === 0);
  if (!empty.length) return "모든 단계에 최소 한 개 이상의 기능이 있습니다. 우선순위를 조정하거나 세부 설명을 보강해 보세요.";
  return `기능이 비어 있는 단계: ${empty.map((s) => s.title).join(", ")}. 각 단계에서 사용자에게 보여줄 상태·입력·결과를 질문으로 채워 나갑니다.`;
}

/** 제안 영역에 적은 줄 단위 초안을 기능 제목 후보로 파싱합니다. */
export function parseFeatureTitlesFromDraft(text: string): string[] {
  return text
    .split(/\n/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 24);
}

/** 채팅에서 가장 최근 AI 메시지 본문(기능 반영 후보 파싱용). */
export function lastAiMessageText(chat: readonly FeatureWorkspaceChatMessageV1[]): string {
  for (let i = chat.length - 1; i >= 0; i--) {
    const row = chat[i];
    if (row && row.role === "ai") return row.text;
  }
  return "";
}

/** 기능을 넣을 단계 — 항목 수가 가장 적은 슬롯을 고릅니다(내부 균형). */
export function pickBalancedStageKey(stages: readonly FeatureWorkspaceStageV1[]): string | null {
  if (!stages.length) return null;
  let best = stages[0]!;
  for (const s of stages) {
    if (s.features.length < best.features.length) best = s;
  }
  return best.stageKey;
}
