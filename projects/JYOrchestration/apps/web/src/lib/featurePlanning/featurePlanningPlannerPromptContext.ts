import { buildOrderedSlotsVisible } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import {
  computeChecklistProgress,
  nextIncompleteChecklistSlot,
} from "@/lib/featurePlanning/featurePlanningDynamicChecklist";
import { defaultFeaturePlanningMemory } from "@/lib/featurePlanning/featurePlanningMemory";
import {
  formatPlannerQueueForPrompt,
  inferAnsweredPlannerFieldsFromUserMessage,
  nextUnansweredPlannerField,
  normalizePlannerQueueStepKey,
  resolvePlannerQuestionQueue,
} from "@/lib/featurePlanning/featurePlanningPlannerQuestionQueue";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FeaturePlanningWorkspaceChatMessageV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function normCompact(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** 단계 제목 ↔ 슬롯명 정렬(짧은 공통 부분·포함 관계) */
export function plannerScoreStepSlotOverlap(slotName: string, stepTitle: string): number {
  const A = normCompact(slotName);
  const B = normCompact(stepTitle);
  if (!A || !B) return 0;
  if (A.includes(B) || B.includes(A)) return Math.min(120, Math.max(A.length, B.length));
  let prefix = 0;
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    if (A[i] !== B[i]) break;
    prefix++;
  }
  if (prefix >= 4) return prefix;
  const wa = new Set(A.split(/\s+/).filter((w) => w.length > 1));
  let hit = 0;
  for (const w of B.split(/\s+/)) {
    if (w.length > 1 && wa.has(w)) hit += w.length;
  }
  return hit;
}

export type PlannerStepFocusV1 = {
  readonly currentStepTitle: string;
  readonly currentStepIndex: number;
  readonly focusSlotId: string;
  readonly focusSlotName: string;
  readonly approvedStepTitles: readonly string[];
  readonly remainingStepTitles: readonly string[];
  readonly definedFeaturesInFocus: readonly string[];
  readonly priorUserAnswers: readonly string[];
};

export function buildPlannerStepFocus(input: {
  readonly requirementsStateJson: unknown;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly workspaceMessages: readonly FeaturePlanningWorkspaceChatMessageV1[];
}): PlannerStepFocusV1 {
  const state = parseRequirementsStateJson(input.requirementsStateJson);
  const flow = state.serviceFlowV1;
  const approvedStepTitles = [...(flow?.steps ?? [])]
    .filter((s) => s.approved === true)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title.trim())
    .filter(Boolean);

  const visible = buildOrderedSlotsVisible(input.artifact);
  const slots = visible.length ? visible : input.artifact.slots;
  const cl = input.artifact.planningChecklistV1;
  let focusSlot = slots[0] ?? input.artifact.slots[0] ?? null;
  let focusSlotName = (focusSlot?.slotName ?? "").trim() || "(정리 영역 없음)";
  let focusSlotId = focusSlot?.slotId ?? "";

  let currentStepIndex = 0;
  if (cl?.areas?.length) {
    const ai = Math.min(Math.max(0, cl.activeAreaIndex), cl.areas.length - 1);
    const area = cl.areas[ai];
    const match = area ? slots.find((s) => s.slotKey === area.areaKey) : undefined;
    if (match && area) {
      focusSlot = match;
      focusSlotId = match.slotId;
      focusSlotName = (match.slotName ?? area.title).trim() || area.title;
      currentStepIndex = ai;
    }
  } else if (approvedStepTitles.length && focusSlot) {
    let best = 0;
    let bestIdx = 0;
    for (let i = 0; i < approvedStepTitles.length; i++) {
      const sc = plannerScoreStepSlotOverlap(focusSlot.slotName, approvedStepTitles[i]);
      if (sc > best) {
        best = sc;
        bestIdx = i;
      }
    }
    currentStepIndex = best >= 3 ? bestIdx : 0;
  }

  const currentStepTitle =
    cl?.areas[Math.min(Math.max(0, cl.activeAreaIndex), Math.max(0, cl.areas.length - 1))]?.title?.trim() ||
    approvedStepTitles[currentStepIndex] ||
    focusSlotName;
  const remainingStepTitles = approvedStepTitles.slice(currentStepIndex + 1);

  const focusForItems = slots.find((s) => s.slotId === focusSlotId) ?? focusSlot;
  const definedFeaturesInFocus =
    focusForItems?.items
      .map((it) => {
        const n = it.name.trim();
        if (!n) return "";
        const d = it.description.trim();
        return d ? `${n}: ${d.slice(0, 160)}` : n;
      })
      .filter(Boolean) ?? [];

  const priorRows = [...input.workspaceMessages];
  if (priorRows.length && priorRows[priorRows.length - 1]?.role === "user") {
    priorRows.pop();
  }
  const priorUserAnswers = priorRows
    .filter((m) => m.role === "user")
    .map((m) => m.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-5);

  return {
    currentStepTitle,
    currentStepIndex,
    focusSlotId,
    focusSlotName,
    approvedStepTitles,
    remainingStepTitles,
    definedFeaturesInFocus,
    priorUserAnswers,
  };
}

function clamp(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function formatChecklistPlannerBlock(
  cl: NonNullable<FeaturePlanningSlotsArtifactV1["planningChecklistV1"]>
): string {
  const prog = computeChecklistProgress(cl);
  const pct = Math.min(100, Math.round((100 * prog.completed) / prog.total));
  const next = nextIncompleteChecklistSlot(cl);
  const lines: string[] = [
    `[CHECKLIST_PLANNER_INPUT]`,
    `전체 진행률(슬롯): ${pct}% (${prog.completed}/${prog.total})`,
    `현재 영역: ${prog.currentAreaTitle || "(없음)"} — 이 영역 내 진행 ${prog.areaCompleted}/${prog.areaTotal}`,
  ];
  if (next) {
    lines.push(
      `[이번에 질문해야 할 슬롯]`,
      `areaKey: ${next.area.areaKey}`,
      `areaTitle: ${next.area.title}`,
      `slotKey: ${next.slot.slotKey}`,
      `required: ${String(next.slot.required)}`,
      `priority: ${next.slot.priority}`,
      `question: ${next.slot.question}`
    );
  } else {
    lines.push("(모든 체크리스트 슬롯이 채워진 상태 — 짧은 마무리·검토만)");
  }
  const pending: string[] = [];
  for (const a of cl.areas) {
    for (const s of a.slots) {
      if (!s.completed) pending.push(`- [${a.title}] ${s.slotKey} · ${s.priority} · ${s.question}`);
    }
  }
  if (pending.length) {
    lines.push("미완료 슬롯(참고, 우선순위 HIGH→MEDIUM→LOW):");
    lines.push(...pending.slice(0, 14));
  }
  lines.push(
    "[답변 UX] 다음 message·question에는 반드시 번호 선택지 2~4개, AI 추천 한 가지, 번호·추천·한 줄 수정 중 선택 요청을 포함할 것. 개방형 질문만 금지."
  );
  return lines.join("\n");
}

/**
 * planner-turn 사용자 프롬프트에 붙는 블록 — 현재 서비스 단계·슬롯·직전 답변을 명시한다.
 */
export function buildPlannerFocusUserBlock(input: {
  readonly projectTitle: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly workspaceMessages: readonly FeaturePlanningWorkspaceChatMessageV1[];
  /** 직전 사용자 한 턴(질문 큐 추론·프롬프트용) */
  readonly userLatestTurn?: string;
}): string {
  const f = buildPlannerStepFocus({
    requirementsStateJson: input.requirementsStateJson,
    artifact: input.artifact,
    workspaceMessages: input.workspaceMessages,
  });
  const desc = clamp(input.projectDescription.replace(/\s+/g, " "), 320);
  const stepsLine = f.approvedStepTitles.length ? f.approvedStepTitles.join(" → ") : "(승인된 서비스 단계 없음)";
  const remaining = f.remainingStepTitles.length ? f.remainingStepTitles.join(" → ") : "(없음 — 마지막 단계로 간주)";
  const defined =
    f.definedFeaturesInFocus.length > 0
      ? f.definedFeaturesInFocus.map((x) => `- ${x}`).join("\n")
      : "- (아직 이 영역에 잡힌 기능이 없습니다)";
  const prior =
    f.priorUserAnswers.length > 0
      ? f.priorUserAnswers.map((x, i) => `${i + 1}. ${clamp(x, 220)}`).join("\n")
      : "(직전 사용자 답변 없음 — 첫 응답이면 단계 소개부터)";

  const checklistBlock = input.artifact.planningChecklistV1
    ? formatChecklistPlannerBlock(input.artifact.planningChecklistV1)
    : null;

  const mem = input.artifact.planningMemoryV1 ?? defaultFeaturePlanningMemory();
  const stepKey = normalizePlannerQueueStepKey(f.currentStepTitle);
  const prevKey = (mem.plannerQueueStepKey ?? "").trim();
  const storedAnswered = prevKey === stepKey ? [...(mem.answeredPlannerFieldIds ?? [])] : [];
  const queue = resolvePlannerQuestionQueue(f.currentStepTitle);
  const nextField = nextUnansweredPlannerField(queue, storedAnswered);
  const userTurn = (input.userLatestTurn ?? "").trim();
  const inferred = userTurn
    ? inferAnsweredPlannerFieldsFromUserMessage(userTurn, nextField, queue, storedAnswered)
    : [];
  const effectiveAnswered = [...new Set([...storedAnswered, ...inferred])];
  const queueBlock = formatPlannerQueueForPrompt({
    stepTitle: f.currentStepTitle,
    stepKey,
    queue,
    answeredFieldIds: effectiveAnswered,
    nextField: nextUnansweredPlannerField(queue, effectiveAnswered),
  });

  const body = [
    `[PLANNER_INPUT / 서비스 단계 집중]`,
    `projectTitle: ${clamp(input.projectTitle || "(제목 없음)", 200)}`,
    `projectDescription(발췌): ${desc}`,
    ``,
    `currentServiceStep(지금 이 턴만 다룸): "${f.currentStepTitle}"`,
    `primarySlotId: ${f.focusSlotId || "(없음)"}`,
    `primarySlotName(정리 영역): "${f.focusSlotName}"`,
    `— 위 currentServiceStep·primarySlot과 직접 관련 없는 다른 단계 기능은 후보·추천·질문에 넣지 마세요.`,
    ``,
    `approvedServiceFlow(전체 순서, 참고만): ${stepsLine}`,
    `remainingServiceSteps(지금 다루지 말 것): ${remaining}`,
    ``,
    `alreadyDefinedFeatures(primarySlot):`,
    defined,
    ``,
    `priorUserAnswers:`,
    prior,
    ``,
    checklistBlock ?? queueBlock,
  ].join("\n");

  return clamp(body, 1680);
}
