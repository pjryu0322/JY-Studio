import { stripJsonMarkdownFences } from "@/lib/requirements/ideationDeliverables";
import { IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";

export type ProblemInterviewSlot =
  | "coreUser"
  | "painPoint"
  | "currentMethod"
  | "needForImprovement"
  | "coreFeatures"
  | "featurePriority"
  | "mvpScope"
  | "kpiSuccess"
  | "constraints"
  | "operations";

export type ProblemInterviewNotes = Record<string, string>;

export type ProblemInterviewState = {
  coreUser: boolean;
  painPoint: boolean;
  currentMethod: boolean;
  needForImprovement: boolean;
  coreFeatures: boolean;
  featurePriority: boolean;
  mvpScope: boolean;
  kpiSuccess: boolean;
  constraints: boolean;
  operations: boolean;
  notes: ProblemInterviewNotes;
  /**
   * 부분 확보 표시용(예: painPoint는 힌트만 있는 경우).
   * - true면 UI에서 "부분"으로 표시하고 진행률 계산에 포함합니다.
   */
  partial?: Partial<Record<ProblemInterviewSlot, boolean>>;
  /**
   * 이미 확보된 슬롯은 다시 묻지 않기 위한 힌트(문자열 비교가 아니라 slot intent 기반)
   */
  askedSlots?: ProblemInterviewSlot[];
  active?: boolean;
  updatedAt?: string;
};

export const PROBLEM_INTERVIEW_SLOTS: ProblemInterviewSlot[] = [
  "coreUser",
  "painPoint",
  "currentMethod",
  "needForImprovement",
  "coreFeatures",
  "featurePriority",
  "mvpScope",
  "kpiSuccess",
  "constraints",
  "operations",
];

/** 기획안 인터뷰 전체 슬롯 수(진행률 표시용) */
export const PROBLEM_INTERVIEW_SLOT_TOTAL = PROBLEM_INTERVIEW_SLOTS.length;

export function emptyProblemInterviewState(nowIso: string): ProblemInterviewState {
  return {
    coreUser: false,
    painPoint: false,
    currentMethod: false,
    needForImprovement: false,
    coreFeatures: false,
    featurePriority: false,
    mvpScope: false,
    kpiSuccess: false,
    constraints: false,
    operations: false,
    notes: {},
    partial: {},
    askedSlots: [],
    active: true,
    updatedAt: nowIso,
  };
}

export function problemInterviewSlotLabelKr(slot: ProblemInterviewSlot): string {
  if (slot === "coreUser") return "핵심 사용자";
  if (slot === "painPoint") return "현재 문제점";
  if (slot === "currentMethod") return "기존 해결 방식";
  if (slot === "needForImprovement") return "개선 필요성";
  if (slot === "coreFeatures") return "핵심 기능";
  if (slot === "featurePriority") return "기능 우선순위";
  if (slot === "mvpScope") return "MVP 범위";
  if (slot === "kpiSuccess") return "KPI·성공기준";
  if (slot === "constraints") return "제약사항";
  return "운영 조건";
}

export function problemInterviewCoveredCount(state: ProblemInterviewState | null | undefined): number {
  if (!state) return 0;
  let n = 0;
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    if (problemInterviewIsCovered(state, slot)) n += 1;
  }
  return n;
}

/** filled 또는 partial 포함 슬롯 수(기획안 준비도 분모와 동일 기준) */
export function proposalInterviewFilledCount(state: ProblemInterviewState | null | undefined): number {
  return problemInterviewCoveredCount(state);
}

export function problemInterviewIsCovered(state: ProblemInterviewState, slot: ProblemInterviewSlot): boolean {
  const partial = state.partial ?? {};
  return Boolean((state as any)[slot]) || Boolean((partial as any)[slot]);
}

function addNote(notes: ProblemInterviewNotes, key: string, value: string) {
  const v = value.trim();
  if (!v) return;
  notes[key] = notes[key] ? `${notes[key]}\n${v}`.trim() : v;
}

/**
 * 비상 폴백 전용: 키워드/정규식 휴리스틱으로 슬롯을 채운다.
 * 정상 경로는 `/api/requirements/interview-analyze` LLM 분석기이며, 이 함수는 API 불가 시에만 사용한다.
 */
export function emergencyFallbackProblemInterviewFromUserMessageRegex(
  prev: ProblemInterviewState | null | undefined,
  userText: string,
  nowIso: string
): ProblemInterviewState {
  const base = prev ? { ...prev } : emptyProblemInterviewState(nowIso);
  const t = String(userText ?? "").trim();
  if (!t) return { ...base, updatedAt: nowIso };
  const notes: ProblemInterviewNotes = { ...(base.notes ?? {}) };
  const partial = { ...(base.partial ?? {}) };

  // currentMethod (기존 해결 방식)
  const methodHit =
    /(지금은|현재는|기존에는|기존엔|요즘은|보통|대부분|주로).*(하고|합니다|해요|사용|작성|관리)/.test(t) ||
    /(엑셀|스프레드시트|구글\s*시트|노션|카톡|슬랙|이메일|메신저|수기|문서|워드|ppt|스프레드|CRM|티켓|게시판|녹취|녹음|회의록)/i.test(t) ||
    /(다시\s*듣고|재청취|정리함|정리해요|정리합니다)/.test(t);
  if (methodHit) {
    base.currentMethod = true;
    addNote(notes, "currentMethod", t);
  }

  // painPoint (현재 문제점)
  const painStrong =
    /(불편|문제|어렵|힘들|번거|귀찮|시간.*(많|오래)|자주.*(누락|실수)|정확|일관).*(없|안|어렵)/.test(t) ||
    /(오류|중복|누락|헷갈|비효율|비효율적|정리.*(힘|어렵))/i.test(t);
  const painHint =
    /(다시\s*듣고|여러\s*번|반복|손이\s*많|수동|수기|시간|오래)/.test(t) || /(힘들|불편)/.test(t);
  if (painStrong) {
    base.painPoint = true;
    addNote(notes, "painPoint", t);
  } else if (!base.painPoint && painHint) {
    partial.painPoint = true;
    addNote(notes, "painPointHint", t);
  }

  // coreUser (핵심 사용자)
  const coreUserHit =
    /(사용자|고객|회원|관리자|운영자|담당자|팀장|직원|강사|학생|병원|환자|의사|상담사|매니저)/.test(t) &&
    /(누구|대상|주로|가장|자주|주체|하는\s*사람|겪는)/.test(t);
  if (coreUserHit) {
    base.coreUser = true;
    addNote(notes, "coreUser", t);
  } else if (!base.coreUser && /(관리자|운영자|담당자|사용자|고객|회원)/.test(t)) {
    // 단독 언급은 힌트로만 저장
    partial.coreUser = true;
    addNote(notes, "coreUserHint", t);
  }

  // needForImprovement (개선 필요성)
  const needStrong =
    /(개선|필요|원해|바꾸|자동|효율|줄이|단축|정확|품질|신뢰|한번에|통합|표준화)/.test(t) &&
    /(하고\s*싶|되면|되었으면|싶어요|원합니다|필요합니다|중요)/.test(t);
  const needHint = /(자동|효율|줄이|단축|편하게|개선)/.test(t);
  if (needStrong) {
    base.needForImprovement = true;
    addNote(notes, "needForImprovement", t);
  } else if (!base.needForImprovement && needHint) {
    partial.needForImprovement = true;
    addNote(notes, "needForImprovementHint", t);
  }

  // coreFeatures
  if (/(기능|화면|대시보드|알림|검색|업로드|다운로드|승인\s*흐름)/.test(t) && /(필요|구현|만들|추가|포함)/.test(t)) {
    base.coreFeatures = true;
    addNote(notes, "coreFeatures", t);
  } else if (!base.coreFeatures && /(기능|화면|대시보드)/.test(t)) {
    partial.coreFeatures = true;
    addNote(notes, "coreFeaturesHint", t);
  }

  // featurePriority (기능·요구 우선순위)
  if (/(우선\s*순위|먼저|나중에|MoSCoW|Must|Should|Could|급한|중요도)/i.test(t) && /(기능|요구|화면|작업)/i.test(t)) {
    base.featurePriority = true;
    addNote(notes, "featurePriority", t);
  } else if (!base.featurePriority && /(우선|순위|먼저|나중)/.test(t)) {
    partial.featurePriority = true;
    addNote(notes, "featurePriorityHint", t);
  }

  // mvpScope (MVP 포함/제외 범위)
  if (/(MVP|최소|1차\s*출시|첫\s*버전|포함\s*범위|제외|후순위)/i.test(t)) {
    base.mvpScope = true;
    addNote(notes, "mvpScope", t);
  } else if (!base.mvpScope && /(포함|빼|일단|범위)/.test(t)) {
    partial.mvpScope = true;
    addNote(notes, "mvpScopeHint", t);
  }

  // kpiSuccess
  if (/(KPI|지표|성공\s*기준|측정|목표|감소|절감|%)/i.test(t)) {
    base.kpiSuccess = true;
    addNote(notes, "kpiSuccess", t);
  } else if (!base.kpiSuccess && /(줄이|개선|효과)/.test(t)) {
    partial.kpiSuccess = true;
    addNote(notes, "kpiSuccessHint", t);
  }

  // constraints
  if (/(예산|일정|보안|법|규정|개인정보|GDPR|SLA|연동|레거시|제약)/i.test(t)) {
    base.constraints = true;
    addNote(notes, "constraints", t);
  } else if (!base.constraints && /(안\s*되|불가|못\s*함)/.test(t)) {
    partial.constraints = true;
    addNote(notes, "constraintsHint", t);
  }

  // operations
  if (/(운영|담당|승인|배포|장애|지원|주간|월간|근무)/.test(t)) {
    base.operations = true;
    addNote(notes, "operations", t);
  } else if (!base.operations && /(팀|조직|부서)/.test(t)) {
    partial.operations = true;
    addNote(notes, "operationsHint", t);
  }

  return { ...base, notes, partial, updatedAt: nowIso, active: base.active !== false };
}

/** 레거시 비-LLM 경로(플래너 외부에서만 참조 시 사용). */
export function chooseNextProblemInterviewSlot(state: ProblemInterviewState): ProblemInterviewSlot | null {
  // Priority: painPoint -> coreUser -> needForImprovement -> refinement(currentMethod if missing)
  const priority: ProblemInterviewSlot[] = [
    "painPoint",
    "coreUser",
    "needForImprovement",
    "currentMethod",
    "coreFeatures",
    "featurePriority",
    "mvpScope",
    "kpiSuccess",
    "constraints",
    "operations",
  ];
  for (const slot of priority) {
    if (!problemInterviewIsCovered(state, slot)) return slot;
  }
  return null;
}

export function withAskedSlot(state: ProblemInterviewState, slot: ProblemInterviewSlot, nowIso: string): ProblemInterviewState {
  const asked = Array.isArray(state.askedSlots) ? [...state.askedSlots] : [];
  asked.push(slot);
  return { ...state, askedSlots: asked.slice(-16), updatedAt: nowIso };
}

/**
 * 인터뷰 첫 질문(bootstrap) 등 자유 질문이 어떤 슬롯을 겨냥했는지 휴리스틱으로 추정한다.
 * bootstrap은 `askedSlots`에 남지 않아, 답변 직후 플래너가 같은 슬롯을 다시 고르는 것을 막기 위해 사용한다.
 */
export function inferInterviewSlotsLikelyAddressedByPlannerQuestionBody(body: string): ProblemInterviewSlot[] {
  const t = String(body ?? "").trim();
  if (!t) return [];
  const seen = new Set<ProblemInterviewSlot>();
  const ordered: ProblemInterviewSlot[] = [];
  const push = (s: ProblemInterviewSlot) => {
    if (seen.has(s)) return;
    seen.add(s);
    ordered.push(s);
  };

  if (
    /(회의록|녹취|문서화|작성\s*방식|절차|프로세스|운영\s*방식|관리\s*방식|어떻게\s*이루어|지금은\s*어떻게|현재는\s*어떻게|공유\s*방식|메일|이메일|열람|접근\s*권한|권한\s*관리)/.test(
      t
    )
  ) {
    push("currentMethod");
  }
  if (/(누구|어떤\s*사람|주요\s*사용자|핵심\s*사용자|사용자\s*층|대상(?:은|이)?|역할|담당)/.test(t)) {
    push("coreUser");
  }
  if (/(문제점|문제(?:은|가)?|불편|어렵|힘들|비효율|오류|누락|리스크)/.test(t)) {
    push("painPoint");
  }
  if (/(개선|필요성|기대|자동화|효율(?:을|화)?|원하(?:는|시))/.test(t)) {
    push("needForImprovement");
  }
  if (/(기능|화면|요구\s*사항|필요\s*기능)/.test(t)) {
    push("coreFeatures");
  }
  if (/(우선\s*순위|MoSCoW|먼저\s*만들|중요도|급한)/.test(t)) {
    push("featurePriority");
  }
  if (/(MVP|1차|첫\s*출시|필수\s*포함|제외|후순위|범위)/.test(t)) {
    push("mvpScope");
  }
  if (/(KPI|지표|성공\s*기준|측정|목표\s*수치)/.test(t)) {
    push("kpiSuccess");
  }
  if (/(제약|보안|법|규정|예산|일정|SLA|연동)/.test(t)) {
    push("constraints");
  }
  if (/(운영|담당|승인|배포|장애|지원|주간|월간)/.test(t)) {
    push("operations");
  }

  return ordered;
}

/**
 * 사용자가 방금 답한 직전 AI가 bootstrap이면, 그 질문이 이미 다룬 슬롯을 `askedSlots`에 합쳐
 * `pickNextAskableInterviewSlot`이 동일 주제·동일 슬롯을 연속으로 고르지 않게 한다.
 */
export function mergeImplicitAskedFromLastBootstrapQuestion(
  messages: readonly { role: string; content?: string; meta?: { internalType?: string } }[],
  merged: ProblemInterviewState
): ProblemInterviewState {
  if (!messages.length) return merged;
  const last = messages[messages.length - 1]!;
  if (last.role !== "user") return merged;
  let lastAiIdx = -1;
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i]!.role === "ai") {
      lastAiIdx = i;
      break;
    }
  }
  if (lastAiIdx < 0) return merged;
  const lastAi = messages[lastAiIdx]!;
  const it = typeof lastAi.meta?.internalType === "string" ? String(lastAi.meta.internalType) : "";
  if (it !== IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE) return merged;
  const inferred = inferInterviewSlotsLikelyAddressedByPlannerQuestionBody(String(lastAi.content ?? ""));
  if (!inferred.length) return merged;
  const asked = [...(merged.askedSlots ?? [])];
  let changed = false;
  for (const s of inferred) {
    if (!asked.includes(s)) {
      asked.push(s);
      changed = true;
    }
  }
  if (!changed) return merged;
  return { ...merged, askedSlots: asked.slice(-16), updatedAt: merged.updatedAt };
}

// ---------------------------------------------------------------------------
// LLM 인터뷰 분석기 + 플랫폼 질문 작성(규칙 기반 슬롯 채우기 대체)
// ---------------------------------------------------------------------------

export type InterviewSlotLevel = "empty" | "partial" | "filled";

export type InterviewIntent = "answer" | "delegate_to_ai" | "skip" | "unclear";

export type InterviewAnalyzerPayload = {
  summary: string;
  intent: InterviewIntent;
  delegatedSlot: ProblemInterviewSlot | null;
  delegatedDefault: string;
  /** 사용자가 "추가 질문 없이 진행"을 명시적으로 위임했는지 */
  globalDelegation: boolean;
  /** 모델 출력 키 `slots`(구 `filledSlots` 호환). */
  slots: Record<ProblemInterviewSlot, InterviewSlotLevel>;
  notes: Partial<Record<ProblemInterviewSlot, string[]>>;
  nextBestSlot: ProblemInterviewSlot | null;
  confidence: number;
};

/** 인터뷰 완료 시 채팅에 한 번 보여줄 고정 안내(플랫폼 문구). */
export const INTERVIEW_COMPLETION_NOTICE_KR =
  "기획안 작성에 필요한 핵심 정보가 모두 확보되었습니다.\n정리 요청으로 프로젝트 기획안을 생성할 수 있습니다.";

/** 질문 후보 우선순위(플랫폼). 분석기 힌트는 이 순서 안에서만 조정한다. */
export const PROBLEM_INTERVIEW_QUESTION_PRIORITY: readonly ProblemInterviewSlot[] = [
  "painPoint",
  "coreUser",
  "needForImprovement",
  "currentMethod",
  "coreFeatures",
  "featurePriority",
  "mvpScope",
  "kpiSuccess",
  "constraints",
  "operations",
] as const;

export const INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD = 0.55;

export const INTERVIEW_CLARIFICATION_QUESTION_KR =
  "말씀하신 내용을 이해했습니다.\n현재 방식에서 가장 큰 불편 요소가 무엇인지 한 가지만 알려주실 수 있을까요?";

function isProblemInterviewSlot(s: string): s is ProblemInterviewSlot {
  return (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(s);
}

/** API·저장소 레거시 `mvpPriority` 문자열을 신규 슬롯으로 매핑 */
function normalizeLegacyInterviewSlotId(s: string): ProblemInterviewSlot | null {
  const t = String(s ?? "").trim();
  if (t === "mvpPriority") return "featurePriority";
  if (isProblemInterviewSlot(t)) return t;
  return null;
}

function normalizeUserTextForSimilarity(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u200b]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDelegationIntentUserReply(raw: string): boolean {
  const t = normalizeUserTextForSimilarity(raw);
  if (!t) return false;
  // “AI가 판단해줘 / 알아서 해줘 / 추천해줘 / 네가 정해줘 …” 류
  return (
    /(ai|너|네가|니가|네|너가).*(판단|결정|정해|골라|선택|추천|제안)/.test(t) ||
    /(알아서|알아|임의로).*(해줘|정해|결정|추천)/.test(t) ||
    /(추천해줘|정해줘|판단해줘|결정해줘|골라줘|선택해줘)/.test(t)
  );
}

function roughSimilarity(a: string, b: string): number {
  const na = normalizeUserTextForSimilarity(a);
  const nb = normalizeUserTextForSimilarity(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // 짧은 위임 문장은 부분 포함으로도 충분히 유사 판정
  if (na.length <= 18 || nb.length <= 18) {
    if (na.includes(nb) || nb.includes(na)) return 0.92;
  }
  const aSet = new Set(na.split(" ").filter(Boolean));
  const bSet = new Set(nb.split(" ").filter(Boolean));
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter += 1;
  const union = aSet.size + bSet.size - inter;
  return union ? inter / union : 0;
}

/**
 * 최근 3턴 사용자 입력이 모두 위임 의사이며, 서로 충분히 유사하면 "루프 위험"으로 판단한다.
 * (사용자가 같은 위임 답만 반복하는 케이스 방지)
 */
export function isDelegationLoopInRecentUserTurns(userTurns: readonly string[]): boolean {
  const last3 = [...userTurns].map((s) => String(s ?? "")).filter((s) => s.trim()).slice(-3);
  if (last3.length < 3) return false;
  if (!last3.every(isDelegationIntentUserReply)) return false;
  const s01 = roughSimilarity(last3[0]!, last3[1]!);
  const s12 = roughSimilarity(last3[1]!, last3[2]!);
  const s02 = roughSimilarity(last3[0]!, last3[2]!);
  return s01 >= 0.75 && s12 >= 0.75 && s02 >= 0.7;
}

function interviewLevelRank(l: InterviewSlotLevel): number {
  if (l === "filled") return 2;
  if (l === "partial") return 1;
  return 0;
}

export function interviewIntentFromWire(raw: unknown): InterviewIntent {
  const t = String(raw ?? "").trim();
  if (t === "answer" || t === "delegate_to_ai" || t === "skip" || t === "unclear") return t;
  return "answer";
}

function normalizeDelegatedSlotId(raw: unknown): ProblemInterviewSlot | null {
  if (raw === null) return null;
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return normalizeLegacyInterviewSlotId(t);
}

function slotFilledBool(state: ProblemInterviewState, slot: ProblemInterviewSlot): boolean {
  const row = state as unknown as Record<string, unknown>;
  return row[slot] === true;
}

export function interviewSlotLevelFromState(state: ProblemInterviewState, slot: ProblemInterviewSlot): InterviewSlotLevel {
  if (slotFilledBool(state, slot)) return "filled";
  if ((state.partial ?? {})[slot]) return "partial";
  return "empty";
}

function normalizeAskedSlotsFromWire(raw: unknown): ProblemInterviewSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => normalizeLegacyInterviewSlotId(String(x ?? "").trim()))
    .filter((x): x is ProblemInterviewSlot => x != null);
}

/**
 * API 요청 바디 `currentInterviewState`를 플랫폼 `ProblemInterviewState`로 변환한다.
 * - 레거시: 슬롯별 boolean + `partial` + 문자열 `notes`
 * - 신규: 슬롯별 `"empty"|"partial"|"filled"` + `notes`를 슬롯별 문자열 배열로 병합
 */
export function problemInterviewStateFromAnalyzerWireInput(raw: unknown, nowIso: string): ProblemInterviewState {
  if (!raw || typeof raw !== "object") return emptyProblemInterviewState(nowIso);
  const o = raw as Record<string, unknown>;
  const asked = normalizeAskedSlotsFromWire(o.askedSlots);
  if (typeof o.coreUser === "boolean") {
    const base = emptyProblemInterviewState(nowIso);
    const legacyMvp = typeof (o as Record<string, unknown>).mvpPriority === "boolean" ? Boolean((o as Record<string, unknown>).mvpPriority) : false;
    const partialRaw =
      typeof o.partial === "object" && o.partial !== null ? { ...(o.partial as Record<string, boolean>) } : {};
    if (partialRaw.mvpPriority) {
      partialRaw.featurePriority = true;
      partialRaw.mvpScope = true;
      delete partialRaw.mvpPriority;
    }
    return {
      ...base,
      coreUser: Boolean(o.coreUser),
      painPoint: Boolean(o.painPoint),
      currentMethod: Boolean(o.currentMethod),
      needForImprovement: Boolean(o.needForImprovement),
      coreFeatures: typeof o.coreFeatures === "boolean" ? o.coreFeatures : false,
      featurePriority: typeof o.featurePriority === "boolean" ? o.featurePriority : legacyMvp,
      mvpScope: typeof o.mvpScope === "boolean" ? o.mvpScope : legacyMvp,
      kpiSuccess: typeof o.kpiSuccess === "boolean" ? o.kpiSuccess : false,
      constraints: typeof o.constraints === "boolean" ? o.constraints : false,
      operations: typeof o.operations === "boolean" ? o.operations : false,
      notes:
        typeof o.notes === "object" && o.notes !== null && !Array.isArray(o.notes)
          ? { ...(o.notes as Record<string, string>) }
          : {},
      partial: Object.keys(partialRaw).length ? partialRaw : {},
      askedSlots: asked.length ? asked : base.askedSlots,
      active: typeof o.active === "boolean" ? o.active : base.active,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : nowIso,
    };
  }
  const st = emptyProblemInterviewState(nowIso);
  const partial: Partial<Record<ProblemInterviewSlot, boolean>> = {};
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    const lv = String(o[slot] ?? "").trim().toLowerCase();
    const row = st as unknown as Record<string, boolean>;
    if (lv === "filled") {
      row[slot] = true;
    } else if (lv === "partial") {
      row[slot] = false;
      partial[slot] = true;
    } else {
      row[slot] = false;
    }
  }
  const legacyMvpWire = String((o as Record<string, unknown>)["mvpPriority"] ?? "").trim().toLowerCase();
  if (legacyMvpWire === "filled" || legacyMvpWire === "partial") {
    const row = st as unknown as Record<string, boolean>;
    if (legacyMvpWire === "filled") {
      row.featurePriority = true;
      row.mvpScope = true;
    } else {
      partial.featurePriority = true;
      partial.mvpScope = true;
    }
  }
  if (Object.keys(partial).length) st.partial = { ...(st.partial ?? {}), ...partial };
  const nRaw = o.notes;
  if (nRaw && typeof nRaw === "object") {
    const notes: ProblemInterviewNotes = { ...(st.notes ?? {}) };
    for (const slot of PROBLEM_INTERVIEW_SLOTS) {
      const arr = (nRaw as Record<string, unknown>)[slot];
      if (!Array.isArray(arr)) continue;
      const joined = arr.map((x) => String(x ?? "").trim()).filter(Boolean).join("\n").slice(0, 8000);
      if (joined) notes[slot] = joined;
    }
    st.notes = notes;
  }
  if (asked.length) st.askedSlots = asked;
  if (typeof o.active === "boolean") st.active = o.active;
  if (typeof o.updatedAt === "string") st.updatedAt = o.updatedAt;
  return st;
}

/** 플랫폼 상태 → 분석 API에 보낼 `currentInterviewState` (슬롯 레벨 + notes 배열 + askedSlots). */
export function problemInterviewStateToAnalyzerWire(state: ProblemInterviewState): Record<string, unknown> {
  const notesWire: Record<string, string[]> = {};
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    const raw = String(state.notes?.[slot] ?? "").trim();
    notesWire[slot] = raw
      ? raw
          .split(/\n/)
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 40)
      : [];
  }
  const out: Record<string, unknown> = { notes: notesWire, askedSlots: [...(state.askedSlots ?? [])] };
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    out[slot] = interviewSlotLevelFromState(state, slot);
  }
  out.active = state.active !== false;
  out.updatedAt = state.updatedAt ?? "";
  return out;
}

function interviewMaxLevel(a: InterviewSlotLevel, b: InterviewSlotLevel): InterviewSlotLevel {
  return interviewLevelRank(a) >= interviewLevelRank(b) ? a : b;
}

function mergeNoteLines(existing: string | undefined, lines: readonly string[]): string {
  const set = new Set(
    String(existing ?? "")
      .split(/\n/)
      .map((x) => x.trim())
      .filter(Boolean)
  );
  for (const line of lines) {
    const t = String(line ?? "").trim();
    if (t) set.add(t);
  }
  return [...set].join("\n").slice(0, 8000);
}

/**
 * 분석기 결과를 기존 상태에 병합한다. 슬롯은 절대 다운그레이드하지 않는다.
 */
export function mergeAnalyzerIntoProblemInterview(
  prev: ProblemInterviewState,
  analyzer: InterviewAnalyzerPayload,
  nowIso: string
): ProblemInterviewState {
  const next: ProblemInterviewState = {
    ...prev,
    notes: { ...(prev.notes ?? {}) },
    partial: { ...(prev.partial ?? {}) },
    askedSlots: [...(prev.askedSlots ?? [])],
    active: prev.active !== false,
    updatedAt: nowIso,
  };

  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    const incoming: InterviewSlotLevel = analyzer.slots[slot] ?? "empty";
    const prevLevel = interviewSlotLevelFromState(prev, slot);
    const merged = interviewMaxLevel(prevLevel, incoming);

    const nextRow = next as unknown as Record<string, unknown>;
    const prevRow = prev as unknown as Record<string, unknown>;

    if (merged === "filled") {
      nextRow[slot] = true;
      if (next.partial && slot in next.partial) {
        const { [slot]: _removed, ...rest } = next.partial;
        next.partial = Object.keys(rest).length ? rest : undefined;
      }
    } else if (merged === "partial") {
      nextRow[slot] = false;
      next.partial = { ...(next.partial ?? {}), [slot]: true };
    } else {
      nextRow[slot] = Boolean(prevRow[slot]);
      if (prev.partial?.[slot]) {
        next.partial = { ...(next.partial ?? {}), [slot]: true };
      } else if (next.partial && slot in next.partial) {
        const { [slot]: _r, ...rest } = next.partial;
        next.partial = Object.keys(rest).length ? rest : undefined;
      }
    }
  }

  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    const lines = analyzer.notes[slot];
    if (!lines?.length) continue;
    const key = slot;
    next.notes[key] = mergeNoteLines(next.notes[key], lines);
  }

  return next;
}

/** 직전 두 턴이 동일 슬롯이면 해당 슬롯 재질문을 피한다(반복 방지). */
export function isDoubleRepeatAsk(asked: readonly ProblemInterviewSlot[] | undefined, slot: ProblemInterviewSlot): boolean {
  const t = asked ?? [];
  if (t.length < 2) return false;
  return t[t.length - 1] === slot && t[t.length - 2] === slot;
}

/** bool true = 확정 filled 만 질문 대상에서 제외(부분은 후속 질문 허용). */
export function slotStrictlyFilled(state: ProblemInterviewState, slot: ProblemInterviewSlot): boolean {
  return slotFilledBool(state, slot);
}

/** boolean 슬롯만 카운트(인터뷰 종료·정리 요청 노출 등 엄격 기준). */
export function problemInterviewStrictFilledCount(state: ProblemInterviewState | null | undefined): number {
  if (!state) return 0;
  let n = 0;
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    if (slotStrictlyFilled(state, slot)) n += 1;
  }
  return n;
}

/** covered이지만 아직 strict filled가 아닌 슬롯 수 */
export function problemInterviewPartialOnlyCount(state: ProblemInterviewState | null | undefined): number {
  if (!state) return 0;
  let n = 0;
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    if (problemInterviewIsCovered(state, slot) && !slotStrictlyFilled(state, slot)) n += 1;
  }
  return n;
}

/**
 * UI 진행률(0~100): 확정 슬롯은 1, 부분 슬롯은 0.5 가중.
 * 인터뷰 종료는 `problemInterviewStrictFilledCount === 전체`일 때만 한다.
 */
export function proposalInterviewReadinessPercent(state: ProblemInterviewState | null | undefined): number {
  const total = PROBLEM_INTERVIEW_SLOT_TOTAL;
  if (!state || !total) return 0;
  const strict = problemInterviewStrictFilledCount(state);
  const partialOnly = problemInterviewPartialOnlyCount(state);
  return Math.min(100, Math.round(((strict + 0.5 * partialOnly) / total) * 100));
}

export function proposalInterviewReadinessScore(state: ProblemInterviewState | null | undefined): number {
  if (!state) return 0;
  const strict = problemInterviewStrictFilledCount(state);
  const partialOnly = problemInterviewPartialOnlyCount(state);
  return strict + 0.5 * partialOnly;
}

const GLOBAL_DELEGATION_DEFAULTS: Partial<Record<ProblemInterviewSlot, string>> = {
  kpiSuccess: "기본 KPI 템플릿 적용: 활성사용/업무시간 절감/오류율 감소/만족도(초안).",
  operations: "표준 운영안 적용: 담당자 지정·승인 흐름·주간 점검·문의 대응(초안).",
  constraints: "일반 SaaS 기준 적용: 개인정보·권한관리·감사로그·가용성·연동 제약(초안).",
};

/** globalDelegation=true일 때 남은 슬롯을 기본안으로 보완한다. */
export function applyGlobalDelegationDefaults(state: ProblemInterviewState, nowIso: string): ProblemInterviewState {
  const next: ProblemInterviewState = {
    ...state,
    notes: { ...(state.notes ?? {}) },
    partial: { ...(state.partial ?? {}) },
    askedSlots: [...(state.askedSlots ?? [])],
    updatedAt: nowIso,
  };

  // KPI/운영/제약은 "기본안 확정"으로 처리(재질문 금지)
  for (const slot of ["kpiSuccess", "operations", "constraints"] as const) {
    if (slotStrictlyFilled(next, slot)) continue;
    (next as any)[slot] = true;
    if (next.partial && slot in next.partial) {
      const { [slot]: _removed, ...rest } = next.partial;
      next.partial = Object.keys(rest).length ? rest : undefined;
    }
    const line = GLOBAL_DELEGATION_DEFAULTS[slot] ?? "AI 권장 기본안 적용(초안).";
    next.notes[slot] = next.notes[slot] ? `${next.notes[slot]}\n${line}`.trim() : line;
  }

  // 인터뷰 슬롯에는 없지만, 통합 기획안에 필요한 리스크 기본 세트는 notes에 남긴다.
  // (slot 계산에는 영향 없음)
  const riskDefault =
    "기본 리스크 세트(초안):\n- 일정 지연(요구사항 변동/리소스)\n- 데이터 품질·정합성(입력·연동)\n- 권한·보안(접근통제/감사로그)\n- 운영 부담(문의·장애 대응)\n- 사용자 정착(변화관리/교육)";
  next.notes["risks"] = next.notes["risks"] ? `${next.notes["risks"]}\n\n${riskDefault}`.trim() : riskDefault;

  // 나머지 미확보 슬롯은 partial로만 채워 점수를 끌어올리되, filled는 강제하지 않는다.
  const partial = { ...(next.partial ?? {}) } as Record<string, boolean>;
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    if (slotStrictlyFilled(next, slot)) continue;
    if (problemInterviewIsCovered(next, slot)) continue;
    partial[slot] = true;
    next.notes[slot] = next.notes[slot]
      ? `${next.notes[slot]}\nAI 권장 기본안으로 보완(사용자 위임).`.trim()
      : "AI 권장 기본안으로 보완(사용자 위임).";
  }
  next.partial = Object.keys(partial).length ? partial : undefined;
  return next;
}

/** 인터뷰 AI 요약 앞에 붙이는 준비도 한 줄 */
export function formatProposalInterviewReadinessLine(state: ProblemInterviewState | null | undefined): string {
  const pct = proposalInterviewReadinessPercent(state);
  const strict = problemInterviewStrictFilledCount(state);
  const total = PROBLEM_INTERVIEW_SLOT_TOTAL;
  return `현재 기획안 준비도는 ${pct}%입니다 (${strict} / ${total} 슬롯 확정). 기획안 완성도를 높이기 위해 몇 가지만 더 확인하겠습니다.`;
}

const CONTROLLED_SLOT_QUESTIONS: Record<ProblemInterviewSlot, readonly string[]> = {
  painPoint: [
    "현재 방식에서 가장 불편하거나 시간이 많이 드는 지점은 무엇인가요?",
    "지금 겪고 있는 문제를 한 문장으로 말하면 어떤 점이 가장 큰가요?",
  ],
  coreUser: [
    "이 문제를 가장 자주 겪는 핵심 사용자는 누구인가요? (예: 사용자·관리자·운영자 등)",
    "이 업무에서 주로 책임지는 사람은 누구이며, 어떤 역할인가요?",
  ],
  needForImprovement: [
    "개선이 꼭 필요하다고 느끼는 이유나 기대하는 변화는 무엇인가요?",
    "무엇이 바뀌면 이 문제는 해결됐다고 느낄 수 있나요?",
  ],
  currentMethod: [
    "기존에는 회의록을 어떻게 작성하고 관리하고 있나요?",
    "지금은 어떤 도구나 절차로 처리하고 있나요? (예: 이메일, 문서, 메신저 등)",
  ],
  coreFeatures: [
    "반드시 들어가야 할 핵심 기능(또는 화면)을 3가지 이내로 짚어 주실 수 있을까요?",
    "사용자가 가장 자주 쓰게 될 핵심 기능은 무엇인가요?",
  ],
  featurePriority: [
    "기능·요구사항 기준으로 구현 우선순위를 어떻게 두고 싶으신가요? (예: 긴급/중요/후순위)",
    "리소스가 한정될 때 가장 먼저 만들어야 할 것은 무엇인가요?",
  ],
  mvpScope: [
    "첫 출시(MVP)에 반드시 포함할 범위와, 이번 버전에서는 빼도 되는 범위를 구분해 주실 수 있을까요?",
    "MVP에서 ‘절대 빠지면 안 되는 것’과 ‘나중에 넣어도 되는 것’을 나눠 주세요.",
  ],
  kpiSuccess: [
    "도입 후 성과를 어떤 지표로 보고 싶으신가요? (예: 시간 절감, 오류 감소, 만족도 등)",
    "성공했다고 판단할 수 있는 기준(수치·주기)이 있으면 알려 주세요.",
  ],
  constraints: [
    "예산, 일정, 보안, 법규, 연동 시스템 등 반드시 지켜야 할 제약이 있나요?",
    "절대로 하면 안 되는 방식이나 범위가 있다면 무엇인가요?",
  ],
  operations: [
    "운영 주체(누가 관리·승인·배포)와 운영 리듬(주간/월간 등)은 어떻게 되나요?",
    "장애나 문의가 생겼을 때 대응 방식은 어떻게 되나요?",
  ],
};

export function getControlledQuestionForSlot(slot: ProblemInterviewSlot, turnSeed: number): string {
  const variants = CONTROLLED_SLOT_QUESTIONS[slot];
  const pick = variants[Math.abs(turnSeed) % variants.length] ?? variants[0];
  return pick;
}

/** 레거시 비-LLM 경로. 정상 인터뷰는 `planNextInterviewTurn` + `composeInterviewPlannerReply`를 사용한다. */
export function buildNextProblemInterviewQuestion(state: ProblemInterviewState, turnSeed: number): { slot: ProblemInterviewSlot; question: string } | null {
  const slot = chooseNextProblemInterviewSlot(state);
  if (!slot) return null;
  if (problemInterviewIsCovered(state, slot)) return null;
  return { slot, question: getControlledQuestionForSlot(slot, turnSeed) };
}

/**
 * 다음에 물을 슬롯: 분석기 힌트 + 고정 우선순위, strict filled·연속 동일 슬롯 질문은 건너뜀.
 */
export function pickNextAskableInterviewSlot(
  state: ProblemInterviewState,
  asked: readonly ProblemInterviewSlot[] | undefined,
  hint: ProblemInterviewSlot | null,
  opts?: { avoidSlots?: readonly ProblemInterviewSlot[] | null }
): ProblemInterviewSlot | null {
  const ordered: ProblemInterviewSlot[] = [];
  if (hint && isProblemInterviewSlot(hint) && !slotStrictlyFilled(state, hint)) ordered.push(hint);
  for (const s of PROBLEM_INTERVIEW_QUESTION_PRIORITY) {
    if (!ordered.includes(s)) ordered.push(s);
  }
  const avoid = new Set((opts?.avoidSlots ?? []).filter(Boolean) as ProblemInterviewSlot[]);
  const askedList = asked ?? [];
  const askedCount = new Map<ProblemInterviewSlot, number>();
  for (const s of askedList) askedCount.set(s, (askedCount.get(s) ?? 0) + 1);
  const lastAsked = asked && asked.length > 0 ? asked[asked.length - 1]! : null;
  for (const slot of ordered) {
    if (avoid.has(slot)) continue;
    // 같은 슬롯 질문 2회 이상 반복 금지(아직 filled가 아니더라도 다른 슬롯 우선)
    if ((askedCount.get(slot) ?? 0) >= 2 && !slotStrictlyFilled(state, slot)) continue;
    if (slotStrictlyFilled(state, slot)) continue;
    if (isDoubleRepeatAsk(asked, slot)) continue;
    if (lastAsked === slot && interviewSlotLevelFromState(state, slot) === "empty") {
      continue;
    }
    return slot;
  }
  return null;
}

/** 진행 배너·힌트용: 다음으로 물을 슬롯 기준 짧은 안내(정리 요청 유도 없음). */
export function proposalInterviewCoachingHintLine(
  state: ProblemInterviewState | null | undefined,
  asked: readonly ProblemInterviewSlot[] | undefined
): string | null {
  if (!state || state.active === false) return null;
  const next = pickNextAskableInterviewSlot(state, asked ?? state.askedSlots, null);
  if (!next) return null;
  const hints: Partial<Record<ProblemInterviewSlot, string>> = {
    painPoint: "현재 문제를 한 가지만 더 구체적으로 알려주시면 준비도가 올라갑니다.",
    coreUser: "핵심 사용자·역할을 짚어 주시면 준비도가 올라갑니다.",
    needForImprovement: "개선이 필요한 이유나 기대 효과를 알려주시면 준비도가 올라갑니다.",
    currentMethod: "지금의 처리 방식·도구를 알려주시면 준비도가 올라갑니다.",
    coreFeatures: "핵심 기능 우선순위를 알려주시면 완성도가 올라갑니다.",
    featurePriority: "기능 간 우선순위(무엇을 먼저)를 알려주시면 완성도가 올라갑니다.",
    mvpScope: "MVP에 포함할 범위와 제외할 범위를 나눠 주시면 완성도가 올라갑니다.",
    kpiSuccess: "성공 기준이나 측정 지표를 알려주시면 완성도가 올라갑니다.",
    constraints: "제약사항(일정·보안·연동 등)을 알려주시면 완성도가 올라갑니다.",
    operations: "운영 방식(담당·승인·지원)을 알려주시면 완성도가 올라갑니다.",
  };
  return hints[next] ?? "기획안 완성도를 높이기 위해 몇 가지만 더 확인하겠습니다.";
}

export type InterviewQuestionPlan =
  | { kind: "slot"; slot: ProblemInterviewSlot; question: string; summary: string }
  | { kind: "clarification"; question: string; summary: string };

/**
 * 병합된 상태 + 분석기 결과로 사용자에게 보여줄 한 턴을 결정한다.
 * - confidence 낮으면 확인형 질문 1개만(슬롯 고정 문구 아님).
 * - 모든 슬롯이 엄격 확정(filled boolean)일 때만 null → 인터뷰 종료.
 *   partial만으로는 종료하지 않는다(문제정의만으로 끝나는 것 방지).
 */
export function planNextInterviewTurn(
  mergedState: ProblemInterviewState,
  analyzer: InterviewAnalyzerPayload | null,
  asked: readonly ProblemInterviewSlot[] | undefined,
  turnSeed: number,
  confidenceThreshold = INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
  fallbackSummary?: string,
  opts?: { avoidNextSlot?: readonly ProblemInterviewSlot[] | null; allowEarlyFinishScore?: number | null }
): InterviewQuestionPlan | null {
  if (PROBLEM_INTERVIEW_SLOTS.every((s) => slotStrictlyFilled(mergedState, s))) {
    return null;
  }
  const early = typeof opts?.allowEarlyFinishScore === "number" ? opts.allowEarlyFinishScore : null;
  if (early !== null && proposalInterviewReadinessScore(mergedState) >= early) {
    return null;
  }
  const summaryFromAnalyzer = (analyzer?.summary ?? "").trim();
  const summary =
    summaryFromAnalyzer ||
    (fallbackSummary && String(fallbackSummary).trim()) ||
    "이전 답변을 반영했습니다.";

  const useClarification =
    analyzer &&
    Number.isFinite(analyzer.confidence) &&
    analyzer.confidence < confidenceThreshold;

  if (useClarification) {
    return { kind: "clarification", question: INTERVIEW_CLARIFICATION_QUESTION_KR, summary };
  }

  const hint = analyzer?.nextBestSlot ?? null;
  const slot = pickNextAskableInterviewSlot(mergedState, asked, hint, { avoidSlots: opts?.avoidNextSlot ?? null });
  if (!slot) {
    return { kind: "clarification", question: INTERVIEW_CLARIFICATION_QUESTION_KR, summary };
  }
  return {
    kind: "slot",
    slot,
    question: getControlledQuestionForSlot(slot, turnSeed),
    summary,
  };
}

export function composeInterviewPlannerReply(summary: string, question: string): string {
  const s = summary.trim();
  const q = question.trim();
  return `핵심 이해:\n${s || "이전 답변을 반영했습니다."}\n\n질문:\n${q}`;
}

/** OpenAI 응답 텍스트에서 분석 JSON 파싱(스키마 완화 + 기본값). */
export function parseInterviewAnalyzerPayloadFromModelText(raw: string): InterviewAnalyzerPayload | null {
  const t = stripJsonMarkdownFences(String(raw ?? "").trim());
  if (!t) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  const intent = interviewIntentFromWire(o.intent);
  const delegatedSlot = normalizeDelegatedSlotId(o.delegatedSlot);
  const delegatedDefault = typeof o.delegatedDefault === "string" ? o.delegatedDefault.trim().slice(0, 400) : "";
  const globalDelegation = o.globalDelegation === true;
  const confRaw = o.confidence;
  const confidence =
    typeof confRaw === "number" && Number.isFinite(confRaw) ? Math.min(1, Math.max(0, confRaw)) : 0.35;
  const fsRaw =
    o.slots && typeof o.slots === "object"
      ? (o.slots as Record<string, unknown>)
      : o.filledSlots && typeof o.filledSlots === "object"
        ? (o.filledSlots as Record<string, unknown>)
        : null;
  const slotLevelFromFsRaw = (slot: ProblemInterviewSlot): InterviewSlotLevel => {
    if (!fsRaw) return "empty";
    const keys =
      slot === "featurePriority"
        ? (["featurePriority", "mvpPriority"] as const)
        : slot === "mvpScope"
          ? (["mvpScope", "mvpPriority"] as const)
          : [slot];
    for (const key of keys) {
      const x = String((fsRaw as Record<string, unknown>)[key] ?? "").trim().toLowerCase();
      if (x === "filled" || x === "partial" || x === "empty") return x;
    }
    return "empty";
  };

  const slots = {} as Record<ProblemInterviewSlot, InterviewSlotLevel>;
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    slots[slot] = slotLevelFromFsRaw(slot);
  }
  const notes: Partial<Record<ProblemInterviewSlot, string[]>> = {};
  const nRaw = o.notes;
  if (nRaw && typeof nRaw === "object") {
    for (const slot of PROBLEM_INTERVIEW_SLOTS) {
      const arr = (nRaw as Record<string, unknown>)[slot];
      if (!Array.isArray(arr)) continue;
      const lines = arr.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24);
      if (lines.length) notes[slot] = lines;
    }
    const legacyMvp = (nRaw as Record<string, unknown>)["mvpPriority"];
    if (Array.isArray(legacyMvp)) {
      const lines = legacyMvp.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24);
      if (lines.length) {
        if (!notes.featurePriority?.length) notes.featurePriority = lines;
        if (!notes.mvpScope?.length) notes.mvpScope = [...lines];
      }
    }
  }
  let nextBestSlot: ProblemInterviewSlot | null = null;
  const nb = o.nextBestSlot;
  if (nb === null) nextBestSlot = null;
  else if (typeof nb === "string") {
    const rawNb = nb.trim();
    const mapped = rawNb === "mvpPriority" ? "featurePriority" : rawNb;
    if (isProblemInterviewSlot(mapped)) nextBestSlot = mapped;
  }

  const allModelFilled = PROBLEM_INTERVIEW_SLOTS.every((s) => slots[s] === "filled");
  if (allModelFilled) nextBestSlot = null;
  if (nextBestSlot && slots[nextBestSlot] === "filled") nextBestSlot = null;

  return { summary, intent, delegatedSlot, delegatedDefault, globalDelegation, slots, notes, nextBestSlot, confidence };
}

/** API 응답 객체를 분석 페이로드로 정규화한다. */
export function coerceInterviewAnalyzerPayload(data: unknown): InterviewAnalyzerPayload | null {
  if (data === null || data === undefined) return null;
  try {
    return parseInterviewAnalyzerPayloadFromModelText(JSON.stringify(data));
  } catch {
    return null;
  }
}

