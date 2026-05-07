import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotStatus,
  SingleChatOrchestrationSlotV1,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export const SINGLE_CHAT_SERVICE_PLANNING_GROUP = "service-planning" as const;

const PLANNER_AGENT = "planner";

function slugToken(s: string, max = 48): string {
  const t = String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, max);
  return t || "project";
}

export function normalizeSlotStatus(raw: string): SingleChatOrchestrationSlotStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "completed") return "confirmed";
  if (s === "partial" || s === "candidate" || s === "confirmed" || s === "stale") return s;
  return "empty";
}

/** planner 기준 슬롯이 어느 정도 채워졌는지 — 파생 슬롯 confirmed 허용 여부 */
export function isPlannerStableEnough(
  state: RequirementsSingleChatOrchestrationStateV1,
  definitions: readonly SingleChatOrchestrationSlotDefinition[]
): boolean {
  const plannerKeys = definitions.filter((d) => d.ownerAgent === PLANNER_AGENT).map((d) => d.slotKey);
  let filled = 0;
  let coreConfirmed = 0;
  for (const k of plannerKeys) {
    const row = state.slots[k];
    if (!row) continue;
    const v = String(row.value ?? "").trim();
    const st = normalizeSlotStatus(String(row.status));
    if (v.length >= 8 && (st === "partial" || st === "candidate" || st === "confirmed")) filled++;
    if (
      (k.includes(".planning.servicePurpose") || k.includes(".planning.problem")) &&
      st === "confirmed" &&
      v.length >= 8
    ) {
      coreConfirmed++;
    }
  }
  return coreConfirmed >= 2 || filled >= 3;
}

export function plannerSlotKeys(definitions: readonly SingleChatOrchestrationSlotDefinition[]): string[] {
  return definitions.filter((d) => d.ownerAgent === PLANNER_AGENT).map((d) => d.slotKey);
}

/** 직접 의존: B.dependsOn 에 A 가 있으면 A 변경 시 B 후보 무효화 */
export function collectDownstreamStaleKeys(params: {
  readonly changedKeys: ReadonlySet<string>;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): Set<string> {
  const stale = new Set<string>();
  const defByKey = new Map(params.definitions.map((d) => [d.slotKey, d]));
  let frontier = new Set(params.changedKeys);
  let guard = 0;
  while (frontier.size && guard++ < 64) {
    const next = new Set<string>();
    for (const def of params.definitions) {
      if (def.ownerAgent === PLANNER_AGENT) continue;
      const deps = def.dependsOn ?? [];
      if (!deps.some((d) => frontier.has(d))) continue;
      if (!stale.has(def.slotKey)) {
        stale.add(def.slotKey);
        next.add(def.slotKey);
      }
    }
    frontier = next;
  }
  return stale;
}

export function buildDynamicServicePlanningSlotDefinitions(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
}): readonly SingleChatOrchestrationSlotDefinition[] {
  const pSlug = slugToken(input.projectName || "idea", 32);
  const p = pSlug;
  const typeHint = String(input.projectType ?? "").trim();
  const descSnippet = String(input.projectDescription ?? "")
    .trim()
    .slice(0, 280)
    .replace(/\s+/g, " ");

  const domainHint = descSnippet ? `프로젝트 설명 발췌: ${descSnippet}` : "도메인은 대화에서 채웁니다.";
  const typeLine = typeHint ? `프로젝트 유형 힌트: ${typeHint}` : "";

  const plannerBase = [domainHint, typeLine].filter(Boolean).join("\n");

  const k = {
    purpose: `${p}.planning.servicePurpose`,
    problem: `${p}.planning.problem`,
    coreUsers: `${p}.planning.coreUsers`,
    outcome: `${p}.planning.expectedOutcome`,
    mvp: `${p}.planning.mvpGoal`,
    actors: `${p}.flow.actors`,
    journey: `${p}.flow.userJourney`,
    exceptions: `${p}.flow.exceptions`,
    scenario: `${p}.flow.scenario`,
    features: `${p}.design.featureList`,
    priority: `${p}.design.priority`,
    screens: `${p}.design.screens`,
    proto: `${p}.design.prototypeScope`,
  };

  return [
    {
      slotKey: k.purpose,
      label: "서비스 목적",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: `${plannerBase}\n무엇을 위해 만드는 서비스인지 한 문장 목적.`,
      dependsOn: [],
    },
    {
      slotKey: k.problem,
      label: "문제 정의",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [],
    },
    {
      slotKey: k.coreUsers,
      label: "핵심 사용자",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [k.purpose],
    },
    {
      slotKey: k.outcome,
      label: "기대 효과",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [k.problem],
    },
    {
      slotKey: k.mvp,
      label: "MVP 목표",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [k.purpose, k.problem],
    },
    {
      slotKey: k.actors,
      label: "액터·역할",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "관리자/일반 사용자 등 행위 주체와 역할 구분.",
      dependsOn: [k.purpose, k.problem, k.coreUsers],
    },
    {
      slotKey: k.journey,
      label: "사용자 흐름",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "주요 단계·순서.",
      dependsOn: [k.actors, k.purpose],
    },
    {
      slotKey: k.exceptions,
      label: "예외 흐름",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "취소/반려/재시도 등 예외.",
      dependsOn: [k.journey, k.actors],
    },
    {
      slotKey: k.scenario,
      label: "서비스 시나리오",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "대표 시나리오 한 줄 요약.",
      dependsOn: [k.journey, k.mvp],
    },
    {
      slotKey: k.features,
      label: "기능 목록",
      ownerAgent: "spec-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "필요 기능 불릿.",
      dependsOn: [k.journey, k.actors, k.mvp],
    },
    {
      slotKey: k.priority,
      label: "기능 우선순위",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "MVP 대비 우선순위.",
      dependsOn: [k.features, k.mvp],
    },
    {
      slotKey: k.screens,
      label: "화면 기능",
      ownerAgent: "spec-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "주요 화면별 기능.",
      dependsOn: [k.features, k.actors],
    },
    {
      slotKey: k.proto,
      label: "프로토타입 기능 범위",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "프로토타입에 넣을 기능 경계.",
      dependsOn: [k.priority, k.features],
    },
  ];
}

export function hashSlotDefinitions(defs: readonly SingleChatOrchestrationSlotDefinition[]): string {
  const payload = defs
    .map((d) => `${d.slotKey}|${d.ownerAgent}|${d.label}|${(d.dependsOn ?? []).join(",")}`)
    .join("\n");
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function defaultSlotFromDef(d: SingleChatOrchestrationSlotDefinition, nowIso: string): SingleChatOrchestrationSlotV1 {
  return {
    slotKey: d.slotKey,
    ownerAgent: d.ownerAgent,
    stageGroup: d.stageGroup,
    label: d.label,
    status: "empty",
    value: null,
    confidence: null,
    updatedAt: nowIso,
    dependsOn: d.dependsOn ?? [],
    derivedFrom: null,
    staleReason: null,
    revision: 0,
  };
}

export function initialOrchestrationStateFromDefinitions(
  defs: readonly SingleChatOrchestrationSlotDefinition[],
  nowIso: string
): RequirementsSingleChatOrchestrationStateV1 {
  const slots: Record<string, SingleChatOrchestrationSlotV1> = {};
  for (const d of defs) {
    slots[d.slotKey] = defaultSlotFromDef(d, nowIso);
  }
  return {
    version: 2,
    stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
    slotDefinitionsHash: hashSlotDefinitions(defs),
    slots,
    updatedAt: nowIso,
  };
}

export type SlotPatchInput = Readonly<{
  slotKey: string;
  status?: string;
  value?: string | null;
  confidence?: number | null;
  ownerAgent?: string;
  derivedFrom?: string | null;
  staleReason?: string | null;
  /** revision 강제(병합 단계) */
  revision?: number;
}>;

function nextRevision(prev: SingleChatOrchestrationSlotV1, newValue: string | null | undefined): number {
  const prevV = String(prev.value ?? "").trim();
  const nextV = newValue === undefined ? prevV : String(newValue ?? "").trim();
  if (prevV !== nextV) return (prev.revision ?? 0) + 1;
  return prev.revision ?? 0;
}

/** 패치 적용 + (옵션) planner 슬롯 값 변경 시 파생 슬롯 stale 전파 */
export function mergeOrchestrationSlotPatches(params: {
  readonly base: RequirementsSingleChatOrchestrationStateV1;
  readonly patches: readonly SlotPatchInput[];
  readonly nowIso: string;
  readonly definitions?: readonly SingleChatOrchestrationSlotDefinition[];
  /** planner 슬롯 값이 바뀐 경우 downstream stale */
  readonly propagateStaleFromPlanner?: boolean;
}): RequirementsSingleChatOrchestrationStateV1 {
  const nextSlots = { ...params.base.slots };
  const changedPlannerKeys = new Set<string>();

  for (const p of params.patches) {
    const key = String(p.slotKey ?? "").trim();
    if (!key || !nextSlots[key]) continue;
    const prev = nextSlots[key];
    const newStatus = p.status !== undefined ? normalizeSlotStatus(String(p.status)) : normalizeSlotStatus(String(prev.status));
    const newValue = p.value !== undefined ? (p.value === null ? null : String(p.value).slice(0, 4000)) : prev.value;
    const rev =
      p.revision !== undefined ? Math.max(0, Number(p.revision)) : nextRevision(prev, newValue === undefined ? undefined : newValue);

    if (
      params.propagateStaleFromPlanner &&
      prev.ownerAgent === PLANNER_AGENT &&
      String(prev.value ?? "").trim() !== String(newValue ?? "").trim()
    ) {
      changedPlannerKeys.add(key);
    }

    nextSlots[key] = {
      ...prev,
      status: newStatus,
      value: newValue ?? null,
      confidence:
        p.confidence !== undefined && p.confidence !== null && Number.isFinite(Number(p.confidence))
          ? Math.min(1, Math.max(0, Number(p.confidence)))
          : prev.confidence,
      ownerAgent: p.ownerAgent !== undefined ? String(p.ownerAgent).trim().slice(0, 64) || prev.ownerAgent : prev.ownerAgent,
      updatedAt: params.nowIso,
      derivedFrom: p.derivedFrom !== undefined ? p.derivedFrom : prev.derivedFrom,
      staleReason: p.staleReason !== undefined ? p.staleReason : prev.staleReason,
      revision: rev,
      dependsOn: prev.dependsOn ?? [],
    };
  }

  let slotsAfter = nextSlots;
  if (params.propagateStaleFromPlanner && changedPlannerKeys.size && params.definitions?.length) {
    const toStale = collectDownstreamStaleKeys({
      changedKeys: changedPlannerKeys,
      definitions: params.definitions,
    });
    const copy = { ...slotsAfter };
    for (const sk of toStale) {
      const row = copy[sk];
      if (!row || row.ownerAgent === PLANNER_AGENT) continue;
      const reasons = [...changedPlannerKeys].join(",");
      copy[sk] = {
        ...row,
        status: "stale",
        staleReason: `upstream planner/context 변경: ${reasons}`,
        updatedAt: params.nowIso,
        revision: (row.revision ?? 0) + 1,
      };
    }
    slotsAfter = copy;
  }

  return {
    ...params.base,
    version: 2,
    slots: slotsAfter,
    updatedAt: params.nowIso,
  };
}

export function slotBucketsByStatus(state: RequirementsSingleChatOrchestrationStateV1): {
  stale: string[];
  candidate: string[];
  confirmed: string[];
} {
  const stale: string[] = [];
  const candidate: string[] = [];
  const confirmed: string[] = [];
  for (const s of Object.values(state.slots)) {
    const st = normalizeSlotStatus(String(s.status));
    if (st === "stale") stale.push(s.slotKey);
    else if (st === "candidate") candidate.push(s.slotKey);
    else if (st === "confirmed") confirmed.push(s.slotKey);
  }
  return { stale, candidate, confirmed };
}
