import type {
  FeatureWorkspaceChatMessageV1,
  FeatureWorkspaceItemV1,
  FeatureWorkspaceItemStatusV1,
  FeatureWorkspaceStageV1,
  FeatureWorkspaceV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import type { FeatureAnalyzeStageWire } from "@/lib/features/featureWorkspaceOpenAI";

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

export function priorityWireToNumber(p: string | undefined): number {
  const u = String(p ?? "").toUpperCase();
  if (u.includes("HIGH") || u === "1") return 1;
  if (u.includes("LOW") || u === "3") return 3;
  return 2;
}

function normTitle(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function findWireStageForStep(
  step: { id: string; title: string },
  wires: readonly FeatureAnalyzeStageWire[],
  index: number,
): FeatureAnalyzeStageWire | null {
  const byId = wires.find((w) => w.stageKey === step.id);
  if (byId) return byId;
  const nt = normTitle(step.title);
  const byTitle = wires.find((w) => normTitle(w.title) === nt || nt.includes(normTitle(w.title)) || normTitle(w.title).includes(nt));
  if (byTitle) return byTitle;
  if (index < wires.length) return wires[index] ?? null;
  return null;
}

function existingTitlesOnStage(features: readonly FeatureWorkspaceItemV1[]): Set<string> {
  return new Set(features.map((f) => normTitle(f.title)));
}

/**
 * LLM 분석 결과를 승인된 서비스 흐름 슬롯에 병합합니다(서비스 흐름 본문은 변경하지 않음).
 * 동일 제목 기능은 중복 추가하지 않습니다.
 */
export function applyFeatureAnalyzeResultToWorkspace(
  prev: FeatureWorkspaceV1 | null,
  flow: RequirementsServiceFlowV1 | null,
  wires: readonly FeatureAnalyzeStageWire[],
): FeatureWorkspaceV1 {
  const base = mergeFeatureWorkspaceStagesWithFlow(prev, flow, { appendIntroChat: false });
  if (!flow?.steps?.length || !wires.length) return base;

  const approved = flow.steps.filter((s) => s.approved).sort((a, b) => a.order - b.order);
  const nextStages = base.stages.map((slot, idx) => {
    const step = approved.find((s) => s.id === slot.stageKey);
    if (!step) return slot;
    const wireIdx = approved.findIndex((s) => s.id === step.id);
    const wire = findWireStageForStep(step, wires, wireIdx >= 0 ? wireIdx : idx);
    const titles = existingTitlesOnStage(slot.features);
    const additions: FeatureWorkspaceItemV1[] = [];
    let orderBase = slot.features.length ? Math.max(...slot.features.map((f) => f.order)) + 1 : 0;
    for (const sf of wire?.suggestedFeatures ?? []) {
      const t = String(sf.title ?? "").trim();
      if (!t || titles.has(normTitle(t))) continue;
      titles.add(normTitle(t));
      const item: FeatureWorkspaceItemV1 = {
        id: newFeatureWorkspaceItemId(),
        title: t.slice(0, 500),
        detail: sf.detail?.trim().slice(0, 8000) || undefined,
        priority: priorityWireToNumber(sf.priority),
        order: orderBase++,
        status: "DRAFT" as FeatureWorkspaceItemStatusV1,
        reason: sf.reason?.trim().slice(0, 2000) || undefined,
        sourceStepId: step.id,
      };
      additions.push(item);
    }
    const plannerQuestions = wire?.questions?.length
      ? [...wire.questions.map((q) => q.trim()).filter(Boolean).slice(0, 24)]
      : slot.plannerQuestions;
    const actorMappings = wire?.actorMappings?.length
      ? [...wire.actorMappings.map((a) => a.trim()).filter(Boolean).slice(0, 48)]
      : slot.actorMappings;
    return {
      ...slot,
      features: [...slot.features, ...additions],
      ...(plannerQuestions?.length ? { plannerQuestions } : {}),
      ...(actorMappings?.length ? { actorMappings } : {}),
    };
  });

  return {
    ...base,
    updatedAt: isoNow(),
    stages: nextStages,
  };
}

/**
 * 자동 분석: 현재 승인 흐름으로 슬롯을 재구성하고, 동일 `stageKey`에 대해 기존 기능 항목은 유지합니다.
 * (승인 데이터 `serviceFlowV1`는 읽기만 하고 변경하지 않습니다.)
 */
export function mergeFeatureWorkspaceStagesWithFlow(
  prev: FeatureWorkspaceV1 | null,
  flow: RequirementsServiceFlowV1 | null,
  options?: { appendIntroChat?: boolean },
): FeatureWorkspaceV1 {
  const appendIntroChat = options?.appendIntroChat ?? false;
  const nextStages = buildFeatureStagesFromApprovedFlow(flow);
  const prevByKey = new Map((prev?.stages ?? []).map((s) => [s.stageKey, s] as const));
  const stages: FeatureWorkspaceStageV1[] = nextStages.map((slot) => {
    const old = prevByKey.get(slot.stageKey);
    const kept = (old?.features ?? []).map((f, i) => ({
      ...f,
      order: typeof f.order === "number" ? f.order : i,
    }));
    const plannerQuestions = old?.plannerQuestions?.length ? [...old.plannerQuestions] : undefined;
    const actorMappings = old?.actorMappings?.length ? [...old.actorMappings] : undefined;
    return {
      stageKey: slot.stageKey,
      title: slot.title,
      features: kept.length ? kept : ([] as readonly FeatureWorkspaceItemV1[]),
      ...(plannerQuestions?.length ? { plannerQuestions } : {}),
      ...(actorMappings?.length ? { actorMappings } : {}),
    };
  });
  const selected =
    prev?.selectedStageKey && stages.some((s) => s.stageKey === prev.selectedStageKey)
      ? prev.selectedStageKey
      : stages[0]?.stageKey ?? null;
  const baseChat = prev?.chat?.length ? [...prev.chat] : [];
  const intro: FeatureWorkspaceChatMessageV1 = {
    id: chatId(),
    role: "ai",
    text:
      stages.length === 0
        ? "승인된 서비스 흐름 단계가 없습니다. 이전 단계에서 단계를 승인한 뒤 자동 분석을 실행해 주세요."
        : `${stages.length}개 단계 슬롯을 준비했습니다. 자동 분석으로 기능 후보를 채우거나 AI 질문으로 합의를 진행하세요.`,
    at: isoNow(),
  };
  return {
    version: 1,
    updatedAt: isoNow(),
    chat: appendIntroChat ? [...baseChat, intro] : baseChat,
    stages,
    selectedStageKey: selected,
    plannerHint:
      stages.length === 0
        ? "근거 부족"
        : `${stages.find((s) => s.stageKey === selected)?.title ?? "단계"} · 합의 진행`,
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

export function summarizeFeatureWorkspaceForAnalyze(w: FeatureWorkspaceV1 | null): string {
  if (!w?.stages?.length) return "";
  const lines = w.stages.map((s) => {
    const fs = s.features.map((f) => `${f.title}${f.status ? `(${f.status})` : ""}`).join(", ");
    return `${s.title}: ${fs || "(기능 없음)"}`;
  });
  return lines.join("\n").slice(0, 6000);
}

export function patchFeatureItemInWorkspace(
  w: FeatureWorkspaceV1,
  stageKey: string,
  itemId: string,
  patch: Partial<Pick<FeatureWorkspaceItemV1, "title" | "detail" | "priority" | "status" | "reason">>,
): FeatureWorkspaceV1 {
  return {
    ...w,
    updatedAt: isoNow(),
    stages: w.stages.map((s) => {
      if (s.stageKey !== stageKey) return s;
      return {
        ...s,
        features: s.features.map((f) => (f.id === itemId ? { ...f, ...patch } : f)),
      };
    }),
  };
}

export function removeFeatureItemFromWorkspace(w: FeatureWorkspaceV1, stageKey: string, itemId: string): FeatureWorkspaceV1 {
  return {
    ...w,
    updatedAt: isoNow(),
    stages: w.stages.map((s) => (s.stageKey !== stageKey ? s : { ...s, features: s.features.filter((f) => f.id !== itemId) })),
  };
}

export function addDraftFeatureToStage(w: FeatureWorkspaceV1, stageKey: string, title: string): FeatureWorkspaceV1 {
  const stage = w.stages.find((s) => s.stageKey === stageKey);
  const nextOrder = stage?.features.length ? Math.max(...stage.features.map((f) => f.order)) + 1 : 0;
  const item: FeatureWorkspaceItemV1 = {
    id: newFeatureWorkspaceItemId(),
    title: title.trim().slice(0, 500) || "새 기능",
    priority: 2,
    order: nextOrder,
    status: "DRAFT",
  };
  return {
    ...w,
    updatedAt: isoNow(),
    stages: w.stages.map((s) => (s.stageKey !== stageKey ? s : { ...s, features: [...s.features, item] })),
  };
}

const STATUS_ORDER: FeatureWorkspaceItemStatusV1[] = ["DRAFT", "REVIEWING", "APPROVED"];

export function cycleFeatureItemStatus(w: FeatureWorkspaceV1, stageKey: string, itemId: string): FeatureWorkspaceV1 {
  const stage = w.stages.find((s) => s.stageKey === stageKey);
  const f = stage?.features.find((x) => x.id === itemId);
  const cur = (f?.status ?? "DRAFT") as FeatureWorkspaceItemStatusV1;
  const idx = STATUS_ORDER.indexOf(cur);
  const next = STATUS_ORDER[(idx < 0 ? 0 : (idx + 1) % STATUS_ORDER.length)]!;
  return patchFeatureItemInWorkspace(w, stageKey, itemId, { status: next });
}

export function cycleFeatureItemPriority(w: FeatureWorkspaceV1, stageKey: string, itemId: string): FeatureWorkspaceV1 {
  const stage = w.stages.find((s) => s.stageKey === stageKey);
  const f = stage?.features.find((x) => x.id === itemId);
  const p = typeof f?.priority === "number" ? f.priority : 2;
  const next = p <= 1 ? 2 : p === 2 ? 3 : 1;
  return patchFeatureItemInWorkspace(w, stageKey, itemId, { priority: next });
}

/** 단계에 남아 있는 첫 확인 질문을 꺼내 AI 메시지로 쓰고 큐에서 제거합니다. */
export function popStagePlannerQuestion(w: FeatureWorkspaceV1, stageKey: string): { next: FeatureWorkspaceV1; question: string | null } {
  const stage = w.stages.find((s) => s.stageKey === stageKey);
  const q0 = stage?.plannerQuestions?.[0]?.trim() ?? "";
  if (!q0) return { next: w, question: null };
  const rest = (stage?.plannerQuestions ?? []).slice(1);
  const next: FeatureWorkspaceV1 = {
    ...w,
    updatedAt: isoNow(),
    stages: w.stages.map((s) => {
      if (s.stageKey !== stageKey) return s;
      if (!rest.length) {
        return {
          stageKey: s.stageKey,
          title: s.title,
          features: s.features,
          ...(s.actorMappings?.length ? { actorMappings: s.actorMappings } : {}),
        };
      }
      return { ...s, plannerQuestions: rest };
    }),
  };
  return { next, question: q0 };
}
