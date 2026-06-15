/**
 * 기능정리 — LLM이 생성하는 동적 체크리스트(영역·슬롯).
 * `featurePlanningSlotsV1.planningChecklistV1`에 저장.
 */

import { randomUUID } from "node:crypto";
import type {
  FeaturePlanningChecklistAreaV1,
  FeaturePlanningChecklistSlotV1,
  FeaturePlanningPlanningChecklistV1,
} from "@/lib/featurePlanning/featurePlanningPlanningChecklistTypes";
export type {
  FeaturePlanningChecklistAreaV1,
  FeaturePlanningChecklistSlotV1,
  FeaturePlanningPlanningChecklistV1,
} from "@/lib/featurePlanning/featurePlanningPlanningChecklistTypes";
export {
  parsePlanningChecklistAnalyzeResponse,
  parsePlanningChecklistStored,
  extractOpeningMessageFromAnalyzeRoot,
} from "@/lib/featurePlanning/featurePlanningPlanningChecklistParse";
import type { FeaturePlanningSlotItemV1, FeaturePlanningSlotV1, FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { normalizeFeaturePlanningSlotType } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { buildSampleDataPlanningChecklistArea } from "@/lib/featurePlanning/featurePlanningSampleDataSync";

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function newItemId(): string {
  return `fpi_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** 체크리스트 → 기존 슬롯 패널용 `slots`(영역당 1슬롯, 항목=체크 슬롯) */
export function checklistToFeatureSlots(checklist: FeaturePlanningPlanningChecklistV1): FeaturePlanningSlotV1[] {
  return checklist.areas.map((area, idx) => {
    const slotId = `fp_area_${area.areaKey.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40)}_${idx}`;
    const items: FeaturePlanningSlotItemV1[] = area.slots.map((s) => ({
      id: newItemId(),
      name: s.label.slice(0, 200),
      description: [s.question, s.examples?.length ? `예: ${s.examples.join(", ")}` : ""].filter(Boolean).join("\n"),
      metadata: {
        checklistSlotKey: s.slotKey,
        checklistAreaKey: area.areaKey,
        checklistPriority: s.priority,
        checklistRequired: s.required,
        checklistCompleted: Boolean(s.completed),
        ...(s.valueSummary ? { checklistValueSummary: s.valueSummary } : {}),
      },
    }));
    return {
      slotId,
      slotKey: area.areaKey.slice(0, 120),
      slotName: area.title.slice(0, 200),
      slotDescription: area.purpose.slice(0, 2000),
      slotType: normalizeFeaturePlanningSlotType("DOMAIN"),
      reason: `기능정리 체크리스트 영역 · ${area.areaKey}`,
      sourceRefs: [{ sourceType: "ACTOR_FLOW" as const, sourceId: area.areaKey, summary: area.purpose.slice(0, 400) }],
      items,
    };
  });
}

/** 폴백: LLM 실패 시 첫 서비스 단계명 기반 최소 3슬롯 */
export function buildFallbackPlanningChecklist(input: {
  readonly stepTitle: string;
  readonly actorNames: readonly string[];
}): FeaturePlanningPlanningChecklistV1 {
  const title = input.stepTitle.trim().slice(0, 120) || "서비스 단계";
  const actors = input.actorNames.filter(Boolean).slice(0, 4).join(", ");
  const areaKey = "fallback_primary";
  return {
    version: 1,
    activeAreaIndex: 0,
    areas: [
      {
        areaKey,
        title,
        purpose: actors
          ? `이 단계에서 관련 액터: ${actors}. 사용자에게 보이는 기능만 정리합니다.`
          : "이 서비스 단계에서 사용자에게 보이는 기능만 정리합니다.",
        requiredScore: 70,
        slots: [
          {
            slotKey: "fallback_scope",
            label: "이 단계의 목적·범위",
            required: true,
            priority: "HIGH",
            question: `「${title}」에서 사용자가 꼭 할 수 있어야 하는 일은 무엇인가요? 한두 문장으로 적어 주세요.`,
          },
          {
            slotKey: "fallback_happy_path",
            label: "정상 흐름",
            required: true,
            priority: "HIGH",
            question: "문제 없이 진행될 때 화면에 어떤 안내·결과가 보이면 좋을까요?",
          },
          {
            slotKey: "fallback_edge",
            label: "예외·막힘",
            required: true,
            priority: "MEDIUM",
            question: "실패·취소·중단처럼 막히는 경우 사용자에게 어떤 선택이나 안내가 필요할까요?",
          },
        ],
      },
      buildSampleDataPlanningChecklistArea(),
    ],
  };
}

export function openingMessageFromChecklist(checklist: FeaturePlanningPlanningChecklistV1): string {
  const area = checklist.areas[0];
  const slot = area?.slots[0];
  if (!area || !slot) return "서비스 흐름을 바탕으로 기능 정리를 시작하겠습니다.";
  return [
    "서비스 흐름을 분석해 정리 영역과 확인 항목을 잡았습니다.",
    "",
    `먼저 「${area.title}」부터 정리하겠습니다.`,
    "",
    slot.question,
  ].join("\n");
}

/** 대화만 비웠을 때 첫 질문 재개 */
export function resumeOpeningFromChecklist(checklist: FeaturePlanningPlanningChecklistV1): string {
  const next = nextIncompleteChecklistSlot(checklist);
  if (!next) {
    return "체크리스트의 확인 항목이 모두 채워진 상태입니다. 우측 정리 영역에서 내용을 검토해 주세요.";
  }
  return [
    "서비스 흐름을 바탕으로 이어서 기능 정리를 하겠습니다.",
    "",
    `「${next.area.title}」 영역입니다.`,
    "",
    next.slot.question,
  ].join("\n");
}

export function mergeChecklistSlotCompletions(
  checklist: FeaturePlanningPlanningChecklistV1,
  completedKeys: readonly string[],
  captures?: Readonly<Record<string, string>>
): FeaturePlanningPlanningChecklistV1 {
  const done = new Set(completedKeys.map((k) => k.trim()).filter(Boolean));
  if (!done.size) return checklist;
  const cap = captures ?? {};
  const areas = checklist.areas.map((a) => ({
    ...a,
    slots: a.slots.map((s) =>
      done.has(s.slotKey)
        ? {
            ...s,
            completed: true,
            valueSummary: (cap[s.slotKey] ?? s.valueSummary ?? "").trim().slice(0, 800) || s.valueSummary,
          }
        : { ...s }
    ),
  }));
  return { ...checklist, areas };
}

/** 현재 활성 영역의 슬롯이 모두 완료되면 다음 미완료 영역으로 이동 */
export function advancePlanningChecklistActiveArea(checklist: FeaturePlanningPlanningChecklistV1): FeaturePlanningPlanningChecklistV1 {
  const ai = Math.max(0, Math.min(checklist.activeAreaIndex, checklist.areas.length - 1));
  const cur = checklist.areas[ai];
  if (!cur) return checklist;
  const allDone = cur.slots.every((s) => s.completed);
  if (!allDone) return checklist;
  for (let j = ai + 1; j < checklist.areas.length; j++) {
    if (checklist.areas[j].slots.some((s) => !s.completed)) {
      return { ...checklist, activeAreaIndex: j };
    }
  }
  for (let j = 0; j < ai; j++) {
    if (checklist.areas[j].slots.some((s) => !s.completed)) {
      return { ...checklist, activeAreaIndex: j };
    }
  }
  return checklist;
}

/** 다음 미완료 슬롯(HIGH→MEDIUM→LOW, 활성 영역 우선) */
export function nextIncompleteChecklistSlot(checklist: FeaturePlanningPlanningChecklistV1): {
  areaIndex: number;
  area: FeaturePlanningChecklistAreaV1;
  slot: FeaturePlanningChecklistSlotV1;
} | null {
  for (let ai = checklist.activeAreaIndex; ai < checklist.areas.length; ai++) {
    const area = checklist.areas[ai];
    const pending = area.slots.filter((s) => !s.completed);
    if (!pending.length) continue;
    pending.sort(
      (a, b) =>
        (PRIORITY_ORDER[String(a.priority).toUpperCase()] ?? 9) -
        (PRIORITY_ORDER[String(b.priority).toUpperCase()] ?? 9)
    );
    return { areaIndex: ai, area, slot: pending[0]! };
  }
  for (let ai = 0; ai < checklist.activeAreaIndex; ai++) {
    const area = checklist.areas[ai];
    const pending = area.slots.filter((s) => !s.completed);
    if (!pending.length) continue;
    pending.sort(
      (a, b) =>
        (PRIORITY_ORDER[String(a.priority).toUpperCase()] ?? 9) -
        (PRIORITY_ORDER[String(b.priority).toUpperCase()] ?? 9)
    );
    return { areaIndex: ai, area, slot: pending[0]! };
  }
  return null;
}

export function computeChecklistProgress(checklist: FeaturePlanningPlanningChecklistV1): {
  completed: number;
  total: number;
  areaCompleted: number;
  areaTotal: number;
  currentAreaTitle: string;
} {
  let completed = 0;
  let total = 0;
  for (const a of checklist.areas) {
    for (const s of a.slots) {
      total++;
      if (s.completed) completed++;
    }
  }
  const ai = Math.min(checklist.activeAreaIndex, Math.max(0, checklist.areas.length - 1));
  const cur = checklist.areas[ai];
  let areaCompleted = 0;
  let areaTotal = 0;
  if (cur) {
    for (const s of cur.slots) {
      areaTotal++;
      if (s.completed) areaCompleted++;
    }
  }
  return {
    completed,
    total: Math.max(1, total),
    areaCompleted,
    areaTotal: Math.max(1, areaTotal),
    currentAreaTitle: cur?.title ?? "",
  };
}

/** 체크리스트 완료 상태를 artifact.slots 항목 metadata에 반영 */
export function syncSlotsFromChecklist(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningSlotsArtifactV1 {
  const cl = artifact.planningChecklistV1;
  if (!cl) return artifact;
  const byArea = new Map(cl.areas.map((a) => [a.areaKey, a]));
  const slots = artifact.slots.map((slot) => {
    const area =
      byArea.get(slot.slotKey) ?? cl.areas.find((a) => a.title === slot.slotName || a.areaKey === slot.slotKey);
    if (!area) return slot;
    const byKey = new Map(area.slots.map((s) => [s.slotKey, s]));
    const items = slot.items.map((it) => {
      const key = typeof it.metadata?.checklistSlotKey === "string" ? String(it.metadata.checklistSlotKey) : "";
      const cs = key ? byKey.get(key) : undefined;
      if (!cs) return it;
      return {
        ...it,
        metadata: {
          ...(it.metadata ?? {}),
          checklistCompleted: Boolean(cs.completed),
          ...(cs.valueSummary ? { checklistValueSummary: cs.valueSummary } : {}),
        },
      };
    });
    return { ...slot, items };
  });
  return { ...artifact, slots };
}
