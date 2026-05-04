/**
 * 동적 기능정리 체크리스트 JSON 파싱 — 슬롯 아티팩트와 순환 참조 없음.
 */

import type {
  FeaturePlanningChecklistAreaV1,
  FeaturePlanningChecklistSlotV1,
  FeaturePlanningPlanningChecklistV1,
} from "@/lib/featurePlanning/featurePlanningPlanningChecklistTypes";

function normPriority(p: string): "HIGH" | "MEDIUM" | "LOW" {
  const u = p.trim().toUpperCase();
  if (u === "HIGH" || u === "MEDIUM" || u === "LOW") return u;
  return "MEDIUM";
}

function parseSlot(raw: unknown): FeaturePlanningChecklistSlotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const slotKey = typeof o.slotKey === "string" ? o.slotKey.trim().slice(0, 80) : "";
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 200) : "";
  const question = typeof o.question === "string" ? o.question.trim().slice(0, 500) : "";
  if (!slotKey || !label || !question) return null;
  const required = o.required === true;
  const priority = normPriority(typeof o.priority === "string" ? o.priority : "MEDIUM");
  const examples = Array.isArray(o.examples)
    ? o.examples.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 8)
    : undefined;
  return {
    slotKey,
    label,
    required,
    priority,
    question,
    ...(examples?.length ? { examples } : {}),
    completed: o.completed === true ? true : false,
    ...(typeof o.valueSummary === "string" && o.valueSummary.trim()
      ? { valueSummary: o.valueSummary.trim().slice(0, 800) }
      : {}),
  };
}

function parseArea(raw: unknown, maxSlots: number, minSlots: number): FeaturePlanningChecklistAreaV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const areaKey = typeof o.areaKey === "string" ? o.areaKey.trim().slice(0, 80) : "";
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : "";
  const purpose = typeof o.purpose === "string" ? o.purpose.trim().slice(0, 800) : "";
  if (!areaKey || !title) return null;
  const requiredScore =
    typeof o.requiredScore === "number" && Number.isFinite(o.requiredScore)
      ? Math.max(0, Math.min(100, Math.floor(o.requiredScore)))
      : 80;
  const slotsRaw = Array.isArray(o.slots) ? o.slots : [];
  const slots = slotsRaw.map(parseSlot).filter((x): x is FeaturePlanningChecklistSlotV1 => Boolean(x));
  if (slots.length < minSlots || slots.length > maxSlots) return null;
  return { areaKey, title, purpose: purpose || title, requiredScore, slots: slots.slice(0, maxSlots) };
}

/** LLM analyze 응답 — 영역당 2~10 슬롯, 1~16 영역 */
export function parsePlanningChecklistAnalyzeResponse(root: unknown): FeaturePlanningPlanningChecklistV1 | null {
  if (!root || typeof root !== "object") return null;
  const o = root as Record<string, unknown>;
  const areasRaw = Array.isArray(o.areas) ? o.areas : [];
  const areas = areasRaw
    .map((a) => parseArea(a, 10, 2))
    .filter((x): x is FeaturePlanningChecklistAreaV1 => Boolean(x));
  if (areas.length < 1 || areas.length > 16) return null;
  return normalizeActiveIndex({ version: 1, areas, activeAreaIndex: 0 });
}

/** 저장소 복원 — 영역당 1~12 슬롯(하위 호환) */
export function parsePlanningChecklistStored(raw: unknown): FeaturePlanningPlanningChecklistV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const areasRaw = Array.isArray(o.areas) ? o.areas : [];
  const areas = areasRaw
    .map((a) => parseArea(a, 12, 1))
    .filter((x): x is FeaturePlanningChecklistAreaV1 => Boolean(x));
  if (areas.length < 1 || areas.length > 24) return undefined;
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? Math.max(1, Math.floor(o.version)) : 1;
  const activeAreaIndex =
    typeof o.activeAreaIndex === "number" && Number.isFinite(o.activeAreaIndex) ? Math.floor(o.activeAreaIndex) : 0;
  return normalizeActiveIndex({ version, areas, activeAreaIndex });
}

function normalizeActiveIndex(cl: FeaturePlanningPlanningChecklistV1): FeaturePlanningPlanningChecklistV1 {
  const max = Math.max(0, cl.areas.length - 1);
  const ai = Math.max(0, Math.min(cl.activeAreaIndex, max));
  return { ...cl, activeAreaIndex: ai };
}

export function extractOpeningMessageFromAnalyzeRoot(root: unknown): string | null {
  if (!root || typeof root !== "object") return null;
  const o = root as Record<string, unknown>;
  const s = typeof o.openingMessage === "string" ? o.openingMessage.trim() : "";
  return s ? s.slice(0, 4000) : null;
}
