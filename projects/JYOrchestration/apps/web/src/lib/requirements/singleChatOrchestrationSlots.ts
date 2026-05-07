import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotStatus,
  SingleChatOrchestrationSlotV1,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export const SINGLE_CHAT_SERVICE_PLANNING_GROUP = "service-planning" as const;

function slugToken(s: string, max = 48): string {
  const t = String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, max);
  return t || "project";
}

/** 프로젝트 메타 기반 동적 슬롯 키 접두사 — 하드코드 최소화, 템플릿·토큰 조합 */
export function buildDynamicServicePlanningSlotDefinitions(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
}): readonly SingleChatOrchestrationSlotDefinition[] {
  const pSlug = slugToken(input.projectName || "idea", 32);
  const typeHint = String(input.projectType ?? "").trim();
  const descSnippet = String(input.projectDescription ?? "")
    .trim()
    .slice(0, 280)
    .replace(/\s+/g, " ");

  const domainHint = descSnippet ? `프로젝트 설명 발췌: ${descSnippet}` : "도메인은 대화에서 채웁니다.";
  const typeLine = typeHint ? `프로젝트 유형 힌트: ${typeHint}` : "";

  const plannerBase = [domainHint, typeLine].filter(Boolean).join("\n");

  return [
    {
      slotKey: `${pSlug}.planning.servicePurpose`,
      label: "서비스 목적",
      ownerAgent: "planner",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: `${plannerBase}\n무엇을 위해 만드는 서비스인지 한 문장 목적.`,
    },
    {
      slotKey: `${pSlug}.planning.problem`,
      label: "문제 정의",
      ownerAgent: "planner",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
    },
    {
      slotKey: `${pSlug}.planning.coreUsers`,
      label: "핵심 사용자",
      ownerAgent: "planner",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
    },
    {
      slotKey: `${pSlug}.planning.expectedOutcome`,
      label: "기대 효과",
      ownerAgent: "planner",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
    },
    {
      slotKey: `${pSlug}.planning.mvpGoal`,
      label: "MVP 목표",
      ownerAgent: "planner",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
    },
    {
      slotKey: `${pSlug}.flow.actors`,
      label: "액터·역할",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "관리자/일반 사용자 등 행위 주체와 역할 구분.",
    },
    {
      slotKey: `${pSlug}.flow.userJourney`,
      label: "사용자 흐름",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "주요 단계·순서.",
    },
    {
      slotKey: `${pSlug}.flow.exceptions`,
      label: "예외 흐름",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "취소/반려/재시도 등 예외.",
    },
    {
      slotKey: `${pSlug}.flow.scenario`,
      label: "서비스 시나리오",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "대표 시나리오 한 줄 요약.",
    },
    {
      slotKey: `${pSlug}.design.featureList`,
      label: "기능 목록",
      ownerAgent: "spec-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "필요 기능 불릿.",
    },
    {
      slotKey: `${pSlug}.design.priority`,
      label: "기능 우선순위",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "MVP 대비 우선순위.",
    },
    {
      slotKey: `${pSlug}.design.screens`,
      label: "화면 기능",
      ownerAgent: "spec-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "주요 화면별 기능.",
    },
    {
      slotKey: `${pSlug}.design.prototypeScope`,
      label: "프로토타입 기능 범위",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "프로토타입에 넣을 기능 경계.",
    },
  ];
}

export function hashSlotDefinitions(defs: readonly SingleChatOrchestrationSlotDefinition[]): string {
  const payload = defs.map((d) => `${d.slotKey}|${d.ownerAgent}|${d.label}`).join("\n");
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function initialOrchestrationStateFromDefinitions(
  defs: readonly SingleChatOrchestrationSlotDefinition[],
  nowIso: string
): RequirementsSingleChatOrchestrationStateV1 {
  const slots: Record<string, SingleChatOrchestrationSlotV1> = {};
  for (const d of defs) {
    slots[d.slotKey] = {
      slotKey: d.slotKey,
      ownerAgent: d.ownerAgent,
      stageGroup: d.stageGroup,
      label: d.label,
      status: "empty",
      value: null,
      confidence: null,
      updatedAt: nowIso,
    };
  }
  return {
    version: 1,
    stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
    slotDefinitionsHash: hashSlotDefinitions(defs),
    slots,
    updatedAt: nowIso,
  };
}

function clampStatus(s: string): SingleChatOrchestrationSlotStatus {
  if (s === "partial" || s === "completed") return s;
  return "empty";
}

export function mergeOrchestrationSlotPatches(params: {
  readonly base: RequirementsSingleChatOrchestrationStateV1;
  readonly patches: readonly {
    readonly slotKey: string;
    readonly status?: string;
    readonly value?: string | null;
    readonly confidence?: number | null;
    readonly ownerAgent?: string;
  }[];
  readonly nowIso: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  const nextSlots = { ...params.base.slots };
  for (const p of params.patches) {
    const key = String(p.slotKey ?? "").trim();
    if (!key || !nextSlots[key]) continue;
    const prev = nextSlots[key];
    nextSlots[key] = {
      ...prev,
      status: p.status !== undefined ? clampStatus(String(p.status)) : prev.status,
      value: p.value !== undefined ? (p.value === null ? null : String(p.value).slice(0, 4000)) : prev.value,
      confidence:
        p.confidence !== undefined && p.confidence !== null && Number.isFinite(Number(p.confidence))
          ? Math.min(1, Math.max(0, Number(p.confidence)))
          : prev.confidence,
      ownerAgent: p.ownerAgent !== undefined ? String(p.ownerAgent).trim().slice(0, 64) || prev.ownerAgent : prev.ownerAgent,
      updatedAt: params.nowIso,
    };
  }
  return {
    ...params.base,
    slots: nextSlots,
    updatedAt: params.nowIso,
  };
}
