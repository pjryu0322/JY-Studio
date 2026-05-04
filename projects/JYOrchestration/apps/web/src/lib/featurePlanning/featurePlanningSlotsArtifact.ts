/**
 * 기능 정리(프로토타입 전) — LLM 동적 planning artifact (내부 slot 모델).
 * `Project.requirementsStateJson.featurePlanningSlotsV1`에 저장.
 */

import type { FeaturePlanningMemoryV1 } from "@/lib/featurePlanning/featurePlanningMemory";
import { parseStoredPlanningMemoryV1 } from "@/lib/featurePlanning/featurePlanningMemory";
import type { FeaturePlanningPlanningChecklistV1 } from "@/lib/featurePlanning/featurePlanningPlanningChecklistTypes";
import { parsePlanningChecklistStored } from "@/lib/featurePlanning/featurePlanningPlanningChecklistParse";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { parsePlanningTopic } from "@/lib/featurePlanning/featurePlanningTopic";

export const FEATURE_PLANNING_SLOT_TYPES = [
  "CORE",
  "DOMAIN",
  "UI",
  "FLOW",
  "DATA",
  "AUTH",
  "TASK",
  "MENU",
  "SCREEN",
  "CUSTOM",
] as const;
export type FeaturePlanningSlotType = (typeof FEATURE_PLANNING_SLOT_TYPES)[number];

const SLOT_TYPE_SET = new Set<string>(FEATURE_PLANNING_SLOT_TYPES);

export type FeaturePlanningSourceRef = {
  sourceType: "IDEATION" | "ACTOR_FLOW" | "PROJECT_CONTEXT" | "USER_MESSAGE";
  sourceId: string;
  summary: string;
};

export type FeaturePlanningSlotItemV1 = {
  id: string;
  name: string;
  description: string;
  /** 이전 단계 액터·역할 라벨(기능/화면 항목에 태그) */
  roleTags?: readonly string[];
  metadata?: Record<string, unknown>;
};

export type FeaturePlanningSlotV1 = {
  slotId: string;
  slotKey: string;
  slotName: string;
  /** 영역 단위 설명(프로토타입 범위) — 내부 필드 slotDescription */
  slotDescription?: string;
  slotType: FeaturePlanningSlotType;
  reason: string;
  sourceRefs: FeaturePlanningSourceRef[];
  items: FeaturePlanningSlotItemV1[];
  /** true: 이전 단계 역할 슬롯 등 — UI·플래너 프롬프트에서 최상위로 숨김 */
  legacy?: boolean;
};

export type FeaturePlanningPrototypeReadinessV1 = {
  status: "READY" | "NEEDS_REVIEW" | "INSUFFICIENT";
  missingItems: string[];
  notes: string;
};

export type FeaturePlanningSlotsArtifactV1 = {
  version: number;
  slots: FeaturePlanningSlotV1[];
  recommendedOrder: string[];
  prototypeReadiness: FeaturePlanningPrototypeReadinessV1;
  /** 마지막 갱신 시각 */
  updatedAt: string;
  /** 최초 생성 시각(하위 호환) */
  generatedAt?: string;
  /** 사용자가 패널에서 영역·항목을 직접 수정한 경우 자동 재생성 금지 */
  userEdited?: boolean;
  /** 액터·서비스 흐름 단계에서 확정된 역할 이름(참조 전용) */
  priorStepActorRoles?: readonly string[];
  /** 대화 진행 주제(단계별 집중) */
  planningTopic?: FeaturePlanningTopicV1;
  /** 대화 맥락 요약(압축 메모리) */
  planningMemoryV1?: FeaturePlanningMemoryV1;
  /** LLM analyze가 생성한 동적 체크리스트(영역·슬롯·질문) */
  planningChecklistV1?: FeaturePlanningPlanningChecklistV1;
};

export function normalizeFeaturePlanningSlotType(raw: unknown): FeaturePlanningSlotType {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "CUSTOM";
  const first = s.split(/[\s|,/]+/).map((x) => x.trim()).filter(Boolean)[0] ?? "";
  const u = first.toUpperCase();
  return SLOT_TYPE_SET.has(u) ? (u as FeaturePlanningSlotType) : "CUSTOM";
}

function parseSourceRef(raw: unknown): FeaturePlanningSourceRef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const st = String(o.sourceType ?? "").trim();
  const sourceType =
    st === "IDEATION" || st === "ACTOR_FLOW" || st === "PROJECT_CONTEXT" || st === "USER_MESSAGE" ? st : null;
  if (!sourceType) return null;
  const sourceId = typeof o.sourceId === "string" ? o.sourceId.trim() : "";
  const summaryRaw = typeof o.summary === "string" ? o.summary.trim() : "";
  const summary =
    summaryRaw ||
    (sourceType === "USER_MESSAGE" ? "(사용자 발화)" : "(요약 없음)");
  return { sourceType, sourceId: sourceId || "—", summary: summary.slice(0, 2000) };
}

function parseMetadata(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

function parseRoleTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const tags = raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 12);
  return tags.length ? tags : undefined;
}

function parseSlotItem(raw: unknown, idx: number): FeaturePlanningSlotItemV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : String(o.description ?? "").trim();
  const meta = parseMetadata(o.metadata);
  const roleTags = parseRoleTags(o.roleTags);
  if (!name) return null;
  return {
    id: id || `item-${idx}`,
    name: name.slice(0, 500),
    description: description.slice(0, 8000),
    ...(roleTags?.length ? { roleTags } : {}),
    ...(meta && Object.keys(meta).length ? { metadata: meta } : {}),
  };
}

function parseSlot(raw: unknown, idx: number): FeaturePlanningSlotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const slotId = typeof o.slotId === "string" ? o.slotId.trim() : "";
  const slotKey = typeof o.slotKey === "string" ? o.slotKey.trim() : "";
  const slotName = typeof o.slotName === "string" ? o.slotName.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim() : "";
  const slotDesc =
    typeof o.description === "string"
      ? o.description.trim()
      : typeof (o as { slotDescription?: unknown }).slotDescription === "string"
        ? String((o as { slotDescription?: string }).slotDescription).trim()
        : "";
  const slotType = normalizeFeaturePlanningSlotType(o.slotType);
  if (!slotName) return null;
  const sourceRefsRaw = Array.isArray(o.sourceRefs) ? o.sourceRefs : [];
  const sourceRefs = sourceRefsRaw.map(parseSourceRef).filter((x): x is FeaturePlanningSourceRef => Boolean(x));
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items = itemsRaw.map(parseSlotItem).filter((x): x is FeaturePlanningSlotItemV1 => Boolean(x));
  const legacy = o.legacy === true ? true : undefined;
  const base: FeaturePlanningSlotV1 = {
    slotId: slotId || `SLOT-${String(idx + 1).padStart(3, "0")}`,
    slotKey: slotKey || `slot_${idx}`,
    slotName: slotName.slice(0, 200),
    slotType,
    reason: reason.slice(0, 4000),
    sourceRefs: sourceRefs.slice(0, 24),
    items: items.slice(0, 200),
    ...(legacy ? { legacy: true } : {}),
  };
  return slotDesc ? { ...base, slotDescription: slotDesc.slice(0, 4000) } : base;
}

function parsePrototypeReadiness(raw: unknown): FeaturePlanningPrototypeReadinessV1 {
  const d: FeaturePlanningPrototypeReadinessV1 = {
    status: "INSUFFICIENT",
    missingItems: [],
    notes: "",
  };
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const st = String(o.status ?? "").trim().toUpperCase();
  if (st === "READY" || st === "NEEDS_REVIEW" || st === "INSUFFICIENT") {
    d.status = st;
  }
  d.missingItems = Array.isArray(o.missingItems)
    ? o.missingItems.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 48)
    : [];
  d.notes = typeof o.notes === "string" ? o.notes.trim().slice(0, 4000) : "";
  return d;
}

/** LLM/저장 JSON에서 아티팩트 복원(관대, 하위 호환). */
export function parseFeaturePlanningSlotsArtifactV1(raw: unknown): FeaturePlanningSlotsArtifactV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const slotsRaw = Array.isArray(o.slots)
    ? o.slots
    : Array.isArray((o as { updatedSlots?: unknown }).updatedSlots)
      ? ((o as { updatedSlots: unknown[] }).updatedSlots)
      : null;
  if (!slotsRaw) return null;
  const slots = slotsRaw.map(parseSlot).filter((x): x is FeaturePlanningSlotV1 => Boolean(x));
  if (slots.length === 0) return null;
  const idSet = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    let id = slots[i].slotId;
    if (idSet.has(id)) {
      id = `${id}-${i}`;
      slots[i] = { ...slots[i], slotId: id };
    }
    idSet.add(id);
  }
  let recommendedOrder = Array.isArray(o.recommendedOrder)
    ? o.recommendedOrder.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  recommendedOrder = recommendedOrder.filter((id) => idSet.has(id));
  const slotIds = slots.map((s) => s.slotId);
  for (const id of slotIds) {
    if (!recommendedOrder.includes(id)) recommendedOrder.push(id);
  }
  const prototypeReadiness = parsePrototypeReadiness(o.prototypeReadiness);
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? Math.max(1, Math.floor(o.version)) : 1;
  const updatedAtRaw =
    typeof o.updatedAt === "string" && o.updatedAt.trim()
      ? o.updatedAt.trim()
      : typeof o.generatedAt === "string" && o.generatedAt.trim()
        ? o.generatedAt.trim()
        : new Date().toISOString();
  const generatedAt =
    typeof o.generatedAt === "string" && o.generatedAt.trim() ? o.generatedAt.trim() : updatedAtRaw;
  const userEdited = o.userEdited === true ? true : undefined;
  const priorRaw = o.priorStepActorRoles;
  const priorStepActorRoles = Array.isArray(priorRaw)
    ? priorRaw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 48)
    : [];
  const planningTopic = parsePlanningTopic(o.planningTopic);
  const memRaw = (o as { planningMemoryV1?: unknown }).planningMemoryV1 ?? (o as { planningMemory?: unknown }).planningMemory;
  const planningMemoryV1 = parseStoredPlanningMemoryV1(memRaw);
  const planningChecklistV1 = parsePlanningChecklistStored((o as { planningChecklistV1?: unknown }).planningChecklistV1);
  return {
    version,
    slots,
    recommendedOrder,
    prototypeReadiness,
    updatedAt: updatedAtRaw,
    generatedAt,
    ...(userEdited ? { userEdited: true } : {}),
    ...(priorStepActorRoles.length ? { priorStepActorRoles } : {}),
    ...(planningTopic ? { planningTopic } : {}),
    ...(planningMemoryV1 ? { planningMemoryV1 } : {}),
    ...(planningChecklistV1 ? { planningChecklistV1 } : {}),
  };
}

export function buildOrderedSlots(artifact: FeaturePlanningSlotsArtifactV1): FeaturePlanningSlotV1[] {
  const byId = new Map(artifact.slots.map((s) => [s.slotId, s]));
  const out: FeaturePlanningSlotV1[] = [];
  for (const id of artifact.recommendedOrder) {
    const s = byId.get(id);
    if (s) out.push(s);
  }
  for (const s of artifact.slots) {
    if (!out.some((x) => x.slotId === s.slotId)) out.push(s);
  }
  return out;
}

export function stripJsonMarkdownFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return s.trim();
}
