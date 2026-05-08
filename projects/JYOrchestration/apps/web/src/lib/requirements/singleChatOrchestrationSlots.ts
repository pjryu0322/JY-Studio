import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatDynamicSlotDefinitionV1,
  SingleChatDynamicSlotProposalWireV1,
  SingleChatDynamicSlotValidationRejectionV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotStatus,
  SingleChatOrchestrationSlotV1,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";

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
  if (s === "partial" || s === "candidate" || s === "confirmed" || s === "stale" || s === "blocked" || s === "conflicted") return s;
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
  return coreConfirmed >= 2 || filled >= 4;
}

/** 오케스트레이션 슬롯 요약 패널 섹션(역할 구역) */
export type OrchestrationSlotSummarySection = {
  readonly sectionTitle: string;
  readonly slots: readonly { readonly label: string; readonly level: "filled" | "partial" | "empty" }[];
};

export type SingleChatOrchestrationStatusCounts = Readonly<{
  confirmed: number;
  partial: number;
  candidate: number;
  stale: number;
  empty: number;
  total: number;
}>;

/** 진행률 UI: confirmed 만 분모 대비 반영 (empty/partial/candidate/stale 제외) */
export function singleChatOrchestrationConfirmedProgress(state: RequirementsSingleChatOrchestrationStateV1 | null | undefined): {
  confirmed: number;
  total: number;
  percent: number;
} {
  if (!state?.slots || typeof state.slots !== "object") {
    return { confirmed: 0, total: 0, percent: 0 };
  }
  const baseKeys =
    state.baseSlotKeys?.length ? new Set(state.baseSlotKeys.map((k) => String(k ?? "").trim()).filter(Boolean)) : null;
  const rows = Object.values(state.slots).filter((s) => (baseKeys ? baseKeys.has(String(s.slotKey ?? "")) : true));
  const total = rows.length;
  let confirmed = 0;
  for (const s of rows) {
    if (normalizeSlotStatus(String(s.status)) === "confirmed") confirmed += 1;
  }
  const percent = total > 0 ? Math.min(100, Math.round((100 * confirmed) / total)) : 0;
  return { confirmed, total, percent };
}

/** 진행률 UI 보조: 상태별 카운트(confirmed/partial/candidate/stale/empty) */
export function singleChatOrchestrationStatusCounts(
  state: RequirementsSingleChatOrchestrationStateV1 | null | undefined
): SingleChatOrchestrationStatusCounts {
  if (!state?.slots || typeof state.slots !== "object") {
    return { confirmed: 0, partial: 0, candidate: 0, stale: 0, empty: 0, total: 0 };
  }
  const baseKeys =
    state.baseSlotKeys?.length ? new Set(state.baseSlotKeys.map((k) => String(k ?? "").trim()).filter(Boolean)) : null;
  const rows = Object.values(state.slots).filter((s) => (baseKeys ? baseKeys.has(String(s.slotKey ?? "")) : true));
  const out = { confirmed: 0, partial: 0, candidate: 0, stale: 0, empty: 0, total: rows.length };
  for (const s of rows) {
    const st = normalizeSlotStatus(String(s.status));
    if (st === "confirmed") out.confirmed += 1;
    else if (st === "partial") out.partial += 1;
    else if (st === "candidate") out.candidate += 1;
    else if (st === "stale") out.stale += 1;
    else out.empty += 1;
  }
  return out;
}

function orchestrationSlotDisplayLevel(statusRaw: string): "filled" | "partial" | "empty" {
  const st = normalizeSlotStatus(statusRaw);
  if (st === "confirmed") return "filled";
  if (st === "partial" || st === "candidate") return "partial";
  return "empty";
}

/** 슬롯 요약 패널 — 기획 / 분석 / 설계 역할 구역 */
export function buildOrchestrationSlotSummarySections(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  state: RequirementsSingleChatOrchestrationStateV1 | null | undefined
): readonly OrchestrationSlotSummarySection[] {
  if (!state?.slots) return [];
  const sectionOrder = ["기획", "분석", "설계"] as const;
  const ownerToSection = (owner: string): (typeof sectionOrder)[number] => {
    if (owner === PLANNER_AGENT) return "기획";
    if (owner === "service-designer" || owner === "domain-expert") return "분석";
    return "설계";
  };
  const buckets: Record<(typeof sectionOrder)[number], { label: string; level: "filled" | "partial" | "empty" }[]> = {
    기획: [],
    분석: [],
    설계: [],
  };
  for (const d of definitions) {
    const row = state.slots[d.slotKey];
    if (!row) continue;
    const sec = ownerToSection(d.ownerAgent);
    buckets[sec].push({
      label: d.label,
      level: orchestrationSlotDisplayLevel(String(row.status)),
    });
  }
  return sectionOrder.map((sectionTitle) => ({ sectionTitle, slots: buckets[sectionTitle] }));
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
  /** 프로젝트 멤버 > AI Agent > "서비스 기획" 절차에 참여하는 카탈로그 키(중복 제거된 집합). */
  readonly servicePlanningAgentCatalogKeys?: readonly WorkspaceAiMemberId[] | null;
  /** 검증 통과한 동적 슬롯 정의(단, base 슬롯 제거/키 변경은 금지) */
  readonly acceptedDynamicSlots?: readonly SingleChatDynamicSlotDefinitionV1[] | null;
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
    mvpScope: `${p}.planning.mvpScope`,
    outcome: `${p}.planning.expectedOutcome`,
    coreValue: `${p}.planning.coreValue`,
    resolvePriority: `${p}.planning.resolvePriority`,
    successCriteria: `${p}.planning.successCriteria`,
    actorTypes: `${p}.flow.actorTypes`,
    permissionRelations: `${p}.flow.permissionRelations`,
    serviceFlow: `${p}.flow.serviceFlow`,
    collaborationFlow: `${p}.flow.collaborationFlow`,
    externalIntegration: `${p}.flow.externalIntegration`,
    exceptionFlow: `${p}.flow.exceptionFlow`,
    operationsFlow: `${p}.flow.operationsFlow`,
    approvalFlow: `${p}.flow.approvalFlow`,
    userStateChange: `${p}.flow.userStateChange`,
    automationLevel: `${p}.architecture.automationLevel`,
    architecturePrototypeBoundary: `${p}.architecture.prototypeBoundary`,
    coreFeatures: `${p}.design.coreFeatures`,
    featurePriority: `${p}.design.featurePriority`,
    prototypeScope: `${p}.design.prototypeScope`,
    requiredScreens: `${p}.design.requiredScreens`,
    featureDependencies: `${p}.design.featureDependencies`,
    dataFlow: `${p}.design.dataFlow`,
    implRisk: `${p}.design.implementationRisk`,
    mvpExclusions: `${p}.design.mvpExclusions`,
  };

  const agentKeys = new Set<WorkspaceAiMemberId>(
    (input.servicePlanningAgentCatalogKeys ?? []).filter(Boolean) as WorkspaceAiMemberId[]
  );
  const hasSecurity = agentKeys.has("security_reviewer");
  const hasDesigner = agentKeys.has("designer");

  const defs: SingleChatOrchestrationSlotDefinition[] = [
    // —— AI 기획자 (planner) ——
    {
      slotKey: k.purpose,
      label: "서비스 목적",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: `${plannerBase}\n무엇을 위해 만드는 서비스인지 한 문장.`,
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
      slotKey: k.mvpScope,
      label: "MVP 범위",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [k.purpose, k.problem],
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
      slotKey: k.coreValue,
      label: "핵심 가치",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [k.purpose],
    },
    {
      slotKey: k.resolvePriority,
      label: "해결 우선순위",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [k.problem, k.coreUsers],
    },
    {
      slotKey: k.successCriteria,
      label: "성공 기준",
      ownerAgent: PLANNER_AGENT,
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: plannerBase,
      dependsOn: [k.outcome],
    },
    // —— AI 분석가 (service-designer / domain-expert) ——
    {
      slotKey: k.actorTypes,
      label: "액터 유형",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "사람/시스템 등 행위 주체 유형.",
      dependsOn: [k.purpose, k.problem, k.coreUsers],
    },
    {
      slotKey: k.permissionRelations,
      label: "권한 관계",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "역할 간 권한·제약.",
      dependsOn: [k.actorTypes],
    },
    {
      slotKey: k.serviceFlow,
      label: "서비스 흐름",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "핵심 단계·순서.",
      dependsOn: [k.actorTypes, k.purpose],
    },
    {
      slotKey: k.collaborationFlow,
      label: "협업·공동 편집",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "동시 편집·검토 요청·역할 분담 등 다인 협업 경계.",
      dependsOn: [k.purpose, k.serviceFlow],
    },
    {
      slotKey: k.externalIntegration,
      label: "외부 연동",
      ownerAgent: "service-designer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "외부 시스템·API 연계.",
      dependsOn: [k.serviceFlow],
    },
    {
      slotKey: k.exceptionFlow,
      label: "예외 흐름",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "취소/실패/재시도 등.",
      dependsOn: [k.serviceFlow, k.actorTypes],
    },
    {
      slotKey: k.operationsFlow,
      label: "운영 흐름",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "모니터링·백오피스·지원.",
      dependsOn: [k.serviceFlow],
    },
    {
      slotKey: k.approvalFlow,
      label: "승인 흐름",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "검토·승인 단계.",
      dependsOn: [k.permissionRelations, k.serviceFlow],
    },
    {
      slotKey: k.userStateChange,
      label: "사용자 상태 변화",
      ownerAgent: "domain-expert",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "계정/세션/단계 상태 전이.",
      dependsOn: [k.serviceFlow],
    },
    // —— 아키텍처 관점(오케스트레이션·자동화 경계) ——
    {
      slotKey: k.automationLevel,
      label: "자동화·AI 처리 수준",
      ownerAgent: "solution-architect",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "실시간 vs 배치, AI 검증·수정 허용 범위, 사람 개입 지점.",
      dependsOn: [k.purpose, k.serviceFlow],
    },
    {
      slotKey: k.architecturePrototypeBoundary,
      label: "초기 구현·프로토타입 경계",
      ownerAgent: "solution-architect",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "업로드·연동·품질 검증 한도 등 MVP 대비 기술 경계.",
      dependsOn: [k.mvpScope, k.automationLevel],
    },
    // —— AI 설계자 (solution-architect / task-reviewer) ——
    {
      slotKey: k.coreFeatures,
      label: "핵심 기능",
      ownerAgent: "solution-architect",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "필수 사용자 기능.",
      dependsOn: [k.serviceFlow, k.actorTypes, k.mvpScope],
    },
    {
      slotKey: k.featurePriority,
      label: "기능 우선순위",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "MVP 대비 순위.",
      dependsOn: [k.coreFeatures, k.mvpScope],
    },
    {
      slotKey: k.prototypeScope,
      label: "프로토타입 범위",
      ownerAgent: "solution-architect",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "시연·검증에 넣을 범위.",
      dependsOn: [k.featurePriority, k.coreFeatures],
    },
    {
      slotKey: k.requiredScreens,
      label: "필수 화면",
      ownerAgent: "solution-architect",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "반드시 필요한 화면 목록.",
      dependsOn: [k.coreFeatures, k.actorTypes],
    },
    {
      slotKey: k.featureDependencies,
      label: "기능 의존성",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "선행·후행 기능 관계.",
      dependsOn: [k.coreFeatures],
    },
    {
      slotKey: k.dataFlow,
      label: "데이터 흐름",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "입력·저장·노출 경로.",
      dependsOn: [k.coreFeatures],
    },
    {
      slotKey: k.implRisk,
      label: "구현 위험",
      ownerAgent: "solution-architect",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "기술·일정·품질 리스크.",
      dependsOn: [k.featureDependencies],
    },
    {
      slotKey: k.mvpExclusions,
      label: "MVP 제외 범위",
      ownerAgent: "task-reviewer",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: "이번 범위에서 제외할 것.",
      dependsOn: [k.prototypeScope],
    },
  ];

  if (hasDesigner) {
    defs.push(
      {
        slotKey: `${p}.design.userInteractionMode`,
        label: "사용자 상호작용 방식",
        ownerAgent: "ui-designer",
        stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
        hints: `${domainHint}\n즉시 피드백 vs 배치 안내·알림 등 상호작용 모드.`,
        dependsOn: [k.purpose],
      },
      {
        slotKey: `${p}.design.uiToneAndStyle`,
        label: "UI 톤 & 스타일",
        ownerAgent: "ui-designer",
        stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
        hints: `${domainHint}\nAI 디자이너 참여: 시각 톤/레이아웃 원칙을 짧게 정리.`,
        dependsOn: [k.requiredScreens],
      },
      {
        slotKey: `${p}.design.informationArchitecture`,
        label: "정보 구조(IA)",
        ownerAgent: "ui-designer",
        stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
        hints: `${domainHint}\nAI 디자이너 참여: 화면 간 정보 구조/내비게이션 초안.`,
        dependsOn: [k.requiredScreens, k.coreUsers],
      }
    );
  }

  if (hasSecurity) {
    defs.push(
      {
        slotKey: `${p}.security.dataSensitivity`,
        label: "민감 데이터/프라이버시",
        ownerAgent: "security-reviewer",
        stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
        hints: `${domainHint}\nAI 보안관 참여: 다루는 데이터의 민감도/보관/노출 리스크를 정리.`,
        dependsOn: [k.coreUsers, k.coreFeatures],
      },
      {
        slotKey: `${p}.security.authAndAuthorization`,
        label: "인증/권한 모델",
        ownerAgent: "security-reviewer",
        stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
        hints: `${domainHint}\nAI 보안관 참여: 인증 방식/권한 경계/역할 기반 접근을 초안으로.`,
        dependsOn: [k.permissionRelations, k.coreUsers],
      },
      {
        slotKey: `${p}.security.threatModelingNotes`,
        label: "위협 모델 메모",
        ownerAgent: "security-reviewer",
        stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
        hints: `${domainHint}\nAI 보안관 참여: 주요 위협(오용/남용)과 완화 방향을 짧게.`,
        dependsOn: [k.coreFeatures, k.externalIntegration],
      }
    );
  }

  // LLM 제안 → 검증 후 채택된 동적 슬롯을 base defs 뒤에 병합한다.
  for (const d of input.acceptedDynamicSlots ?? []) {
    const slotKey = String(d.slotKey ?? "").trim();
    if (!slotKey) continue;
    // 슬롯 오너는 런타임 오케스트레이션 역할(ownerAgent)로 정규화되어 저장되어야 한다.
    defs.push({
      slotKey,
      label: String(d.title ?? "").trim().slice(0, 80) || slotKey,
      ownerAgent: normalizeDynamicOwnerToInternalOwner(String(d.ownerAgent ?? "")),
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      hints: String(d.description ?? "").trim().slice(0, 400),
      dependsOn: [k.purpose, k.problem],
    });
  }

  return defs;
}

/** LLM 프롬프트에만 쓰는 6개 외부 역할. 런타임 슬롯 정의의 ownerAgent(내부)와 구분한다. */
export const LLM_EXTERNAL_ORCHESTRATION_ROLES = ["planner", "analyst", "architect", "designer", "reviewer", "security"] as const;
export type LlmExternalOrchestrationRole = (typeof LLM_EXTERNAL_ORCHESTRATION_ROLES)[number];

/** 내부 ownerAgent → LLM용 외부 역할 문자열 */
export function internalOwnerToLlmExternalRole(internalRaw: string): string {
  const o = String(internalRaw ?? "").trim().toLowerCase();
  if (o === "planner") return "planner";
  if (o === "service-designer" || o === "domain-expert") return "analyst";
  if (o === "solution-architect") return "architect";
  if (o === "ui-designer") return "designer";
  if (o === "task-reviewer") return "reviewer";
  if (o === "security-reviewer") return "security";
  if ((LLM_EXTERNAL_ORCHESTRATION_ROLES as readonly string[]).includes(o)) return o;
  return "planner";
}

/** Bootstrap LLM에만 넘기는 Phase1 슬롯 — planner / analyst / architect / (designer) 균형 */
const BOOTSTRAP_PHASE1_SLOT_SUFFIXES = [
  ".planning.servicePurpose",
  ".planning.coreValue",
  ".flow.collaborationFlow",
  ".flow.approvalFlow",
  ".architecture.automationLevel",
  ".architecture.prototypeBoundary",
  ".design.userInteractionMode",
] as const;

export function isBootstrapPhase1CatalogSlotKey(slotKey: string): boolean {
  const k = String(slotKey ?? "").trim();
  return BOOTSTRAP_PHASE1_SLOT_SUFFIXES.some((s) => k.endsWith(s));
}

export type SlotExpansionPhase = 1 | 2 | 3;

function slotHasMeaningfulFill(
  state: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  slotKey: string
): boolean {
  if (!state?.slots) return false;
  const row = state.slots[slotKey];
  if (!row) return false;
  const v = String(row.value ?? "").trim();
  if (v.length < 4) return false;
  const st = normalizeSlotStatus(String(row.status));
  return st === "partial" || st === "candidate" || st === "confirmed";
}

/**
 * 오케스트레이션 진행에 따른 슬롯 확장 단계(메타·향후 프롬프트 확장용).
 * 1=기획 초기, 2=서비스 플로우 수렴, 3=기능/설계.
 */
export function computeSlotExpansionPhaseFromState(
  state: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  definitions: readonly SingleChatOrchestrationSlotDefinition[]
): SlotExpansionPhase {
  if (!state?.slots) return 1;
  const baseDefs = definitions.filter((d) => !String(d.slotKey).startsWith("dyn_"));
  const anyDesign = baseDefs.some((d) => d.slotKey.includes(".design.") && slotHasMeaningfulFill(state, d.slotKey));
  if (anyDesign) return 3;
  const anyFlow = baseDefs.some((d) => d.slotKey.includes(".flow.") && slotHasMeaningfulFill(state, d.slotKey));
  if (anyFlow || isPlannerStableEnough(state, definitions)) return 2;
  return 1;
}

/**
 * planner-route LLM용: expansion phase에 맞춰 **표시할** 슬롯 정의만 줄인다(파싱·패치는 전체 defs 유지).
 * 1=`.planning.*`, 2=`planning+flow`, 3=비-dyn 전부(+dyn은 호출부 definitions에 있으면 포함).
 */
export function filterSlotDefinitionsForPlannerCatalog(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  phase: SlotExpansionPhase
): SingleChatOrchestrationSlotDefinition[] {
  const nonDyn = definitions.filter((d) => !String(d.slotKey).startsWith("dyn_"));
  if (phase >= 3) return [...definitions];
  if (phase === 2) return nonDyn.filter((d) => d.slotKey.includes(".planning.") || d.slotKey.includes(".flow."));
  return nonDyn.filter((d) => d.slotKey.includes(".planning."));
}

export function formatSlotDefinitionRowForOrchestrationLlm(
  d: SingleChatOrchestrationSlotDefinition,
  opts: { readonly includeDependsOn: boolean }
): { slotKey: string; label: string; ownerAgent: string; dependsOn?: readonly string[] } {
  const base = { slotKey: d.slotKey, label: d.label, ownerAgent: d.ownerAgent };
  if (opts.includeDependsOn && (d.dependsOn?.length ?? 0) > 0) {
    return { ...base, dependsOn: [...(d.dependsOn ?? [])] };
  }
  return base;
}

/** planner-route `[슬롯 정의]` JSON — phase&lt;3 이면 dependsOn 생략로 토큰 절약 */
export function stringifyPlannerRouteSlotCatalogForLlm(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  phase: SlotExpansionPhase
): string {
  const subset = filterSlotDefinitionsForPlannerCatalog(definitions, phase);
  const includeDepends = phase >= 3;
  const rows = subset.map((d) => formatSlotDefinitionRowForOrchestrationLlm(d, { includeDependsOn: includeDepends }));
  return JSON.stringify(rows, null, 0).slice(0, 20_000);
}

export type CompactBootstrapSlotCatalogRow = {
  /** 짧은 id (예: planning.servicePurpose). 프로젝트 slug 접두 전체 키는 넣지 않는다. */
  readonly slotId: string;
  readonly label: string;
  readonly ownerAgent: string;
  readonly group: "planning" | "flow" | "architecture" | "design";
};

export function slotKeyToCompactSlotId(slotKey: string): string {
  const parts = String(slotKey ?? "").trim().split(".").filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  return parts.join(".") || "slot";
}

export function buildCompactBootstrapSlotCatalogForLlm(
  definitions: readonly SingleChatOrchestrationSlotDefinition[]
): readonly CompactBootstrapSlotCatalogRow[] {
  return definitions
    .filter((d) => !String(d.slotKey).startsWith("dyn_"))
    .filter((d) => isBootstrapPhase1CatalogSlotKey(d.slotKey))
    .map((d) => ({
      slotId: slotKeyToCompactSlotId(d.slotKey),
      label: d.label,
      ownerAgent: internalOwnerToLlmExternalRole(d.ownerAgent),
      group: d.slotKey.includes(".architecture.")
        ? ("architecture" as const)
        : d.slotKey.includes(".flow.")
          ? ("flow" as const)
          : d.slotKey.includes(".design.")
            ? ("design" as const)
            : ("planning" as const),
    }));
}

/** Bootstrap LLM용: dependsOn·전체 키 계층 없이 compact JSON 한 덩어리. */
export function stringifyCompactBootstrapSlotCatalogForLlm(
  definitions: readonly SingleChatOrchestrationSlotDefinition[]
): string {
  const slots = buildCompactBootstrapSlotCatalogForLlm(definitions);
  return JSON.stringify({ mode: "bootstrap_phase1_compact", slots }, null, 0);
}

const ALLOWED_DYNAMIC_OWNER = new Set(["planner", "analyst", "architect", "designer", "reviewer", "security"]);
const RESERVED_PREFIXES = ["planning.", "flow.", "design.", "security."] as const;

export function normalizeDynamicOwnerToInternalOwner(ownerRaw: string): string {
  const o = String(ownerRaw ?? "").trim().toLowerCase();
  // Hybrid: 외부 ownerAgent(UX) → 내부 오케스트레이션 역할 문자열로 매핑.
  if (o === "planner") return "planner";
  if (o === "analyst") return "service-designer";
  if (o === "architect") return "solution-architect";
  if (o === "designer") return "ui-designer";
  if (o === "reviewer") return "task-reviewer";
  if (o === "security") return "security-reviewer";
  return o;
}

/** planner-route 등에서 받은 제안을 검증 입력용으로 한 번만 정규화·복사한다. */
export function cloneDynamicSlotProposalsFromPlannerRoute(
  slots: readonly SingleChatDynamicSlotProposalWireV1[] | null | undefined
): SingleChatDynamicSlotProposalWireV1[] {
  if (!slots?.length) return [];
  return slots.map((s) => ({
    slotKey: String(s.slotKey ?? "").trim(),
    title: String(s.title ?? "").trim(),
    description: String(s.description ?? "").trim(),
    ownerAgent: String(s.ownerAgent ?? "").trim().toLowerCase(),
    reason: typeof s.reason === "string" ? s.reason.slice(0, 200) : s.reason === null ? null : null,
    priority: s.priority ?? null,
    proposalConfidence:
      s.proposalConfidence !== null && s.proposalConfidence !== undefined && Number.isFinite(Number(s.proposalConfidence))
        ? Math.min(1, Math.max(0, Number(s.proposalConfidence)))
        : null,
  }));
}

export type ValidateDynamicProposedSlotsResult = Readonly<{
  accepted: SingleChatDynamicSlotDefinitionV1[];
  rejected: SingleChatDynamicSlotValidationRejectionV1[];
}>;

/** 채택된 동적 슬롯마다 `state.slots`에 empty 행을 보장한다(merge 패치는 기존 키만 갱신). */
export function ensureDynamicSlotRowsInState(params: {
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly accepted: readonly SingleChatDynamicSlotDefinitionV1[];
  readonly nowIso: string;
  readonly stageGroup: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  if (!params.accepted.length) return params.state;
  const nextSlots = { ...params.state.slots };
  let changed = false;
  for (const d of params.accepted) {
    const key = String(d.slotKey ?? "").trim();
    if (!key || nextSlots[key]) continue;
    nextSlots[key] = {
      slotKey: key,
      ownerAgent: String(d.ownerAgent ?? "").trim(),
      stageGroup: params.stageGroup,
      label: String(d.title ?? "").trim().slice(0, 80) || key,
      status: "empty",
      value: "",
      confidence: 0,
      updatedAt: params.nowIso,
      dependsOn: [],
      derivedFrom: "dynamic-proposal-orchestration",
      staleReason: null,
      revision: 0,
    };
    changed = true;
  }
  if (!changed) return params.state;
  return { ...params.state, slots: nextSlots, updatedAt: params.nowIso };
}

export function validateDynamicProposedSlots(input: {
  readonly nowIso: string;
  readonly baseDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly existingDynamicSlots: Record<string, SingleChatDynamicSlotDefinitionV1> | null | undefined;
  readonly suggestedSlots: readonly SingleChatDynamicSlotProposalWireV1[];
}): ValidateDynamicProposedSlotsResult {
  const baseKeys = new Set(input.baseDefinitions.map((d) => d.slotKey));
  const existingKeys = new Set(Object.keys(input.existingDynamicSlots ?? {}));
  const accepted: SingleChatDynamicSlotDefinitionV1[] = [];
  const rejected: SingleChatDynamicSlotValidationRejectionV1[] = [];
  const maxAccept = 8;

  function reject(slotKey: string, reason: string) {
    rejected.push({ slotKey: slotKey || "(empty)", reason, rejectedAt: input.nowIso });
  }

  for (const s of input.suggestedSlots ?? []) {
    if (accepted.length >= maxAccept) break;
    const rawKey = String(s.slotKey ?? "").trim();
    const slotKey = rawKey.startsWith("dyn_") ? rawKey : rawKey ? `dyn_${rawKey}` : "";
    if (!slotKey) {
      reject("", "slotKey_empty");
      continue;
    }
    if (!/^dyn_[a-zA-Z0-9][a-zA-Z0-9_]{2,63}$/.test(slotKey)) {
      reject(slotKey, "slotKey_invalid_format");
      continue;
    }
    const lowered = slotKey.toLowerCase();
    if (RESERVED_PREFIXES.some((p) => lowered.includes(p))) {
      reject(slotKey, "slotKey_reserved_namespace");
      continue;
    }
    if (baseKeys.has(slotKey)) {
      reject(slotKey, "slotKey_collides_with_base");
      continue;
    }
    if (existingKeys.has(slotKey) || accepted.some((a) => a.slotKey === slotKey)) {
      reject(slotKey, "slotKey_duplicate");
      continue;
    }
    const title = String(s.title ?? "").trim();
    const description = String(s.description ?? "").trim();
    const ownerAgent = String(s.ownerAgent ?? "").trim().toLowerCase();
    if (!title || title.length > 80) {
      reject(slotKey, "title_invalid");
      continue;
    }
    if (!description || description.length > 280) {
      reject(slotKey, "description_invalid");
      continue;
    }
    if (!ALLOWED_DYNAMIC_OWNER.has(ownerAgent)) {
      reject(slotKey, "ownerAgent_not_allowed");
      continue;
    }
    const internalOwner = normalizeDynamicOwnerToInternalOwner(ownerAgent);
    accepted.push({
      slotKey,
      title,
      description,
      ownerAgent: internalOwner,
      externalProposedOwner: ownerAgent,
      reason: typeof s.reason === "string" ? s.reason.slice(0, 200) : null,
      priority: s.priority ?? null,
      proposalConfidence:
        s.proposalConfidence !== null && s.proposalConfidence !== undefined && Number.isFinite(Number(s.proposalConfidence))
          ? Math.min(1, Math.max(0, Number(s.proposalConfidence)))
          : null,
      proposedAt: input.nowIso,
    });
  }
  return { accepted, rejected };
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
    baseSlotKeys: defs.filter((d) => !String(d.slotKey).startsWith("dyn_")).map((d) => d.slotKey),
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

export function extendOrchestrationStateWithDynamicSlots(params: {
  readonly base: RequirementsSingleChatOrchestrationStateV1;
  readonly accepted: readonly SingleChatDynamicSlotDefinitionV1[];
  readonly nowIso: string;
  readonly stageGroup: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  if (!params.accepted.length) return params.base;
  const nextSlots = { ...params.base.slots };
  for (const d of params.accepted) {
    const key = String(d.slotKey ?? "").trim();
    if (!key || nextSlots[key]) continue;
    nextSlots[key] = {
      slotKey: key,
      ownerAgent: normalizeDynamicOwnerToInternalOwner(d.ownerAgent),
      stageGroup: params.stageGroup,
      label: String(d.title ?? "").trim().slice(0, 80) || key,
      status: "empty",
      value: null,
      confidence: null,
      updatedAt: params.nowIso,
      dependsOn: [],
      derivedFrom: "dynamic-proposal-bootstrap",
      staleReason: null,
      revision: 0,
    };
  }
  return { ...params.base, slots: nextSlots, updatedAt: params.nowIso };
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
