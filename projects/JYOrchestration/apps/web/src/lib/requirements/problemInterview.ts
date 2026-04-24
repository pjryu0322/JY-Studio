import { stripJsonMarkdownFences } from "@/lib/requirements/ideationDeliverables";
import { IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";

export type ProblemInterviewSlot =
  | "serviceIdea"
  | "targetUser"
  | "coreProblem"
  | "expectedOutcome"
  | "roughActors"
  | "roughFlow"
  | "mustHaveFeatures"
  | "constraints";

export type ProblemInterviewNotes = Record<string, string>;

export type ProblemInterviewState = {
  serviceIdea: boolean;
  targetUser: boolean;
  coreProblem: boolean;
  expectedOutcome: boolean;
  roughActors: boolean;
  roughFlow: boolean;
  mustHaveFeatures: boolean;
  constraints: boolean;
  notes: ProblemInterviewNotes;
  /**
   * 부분 확보 표시용(예: 힌트만 있는 경우).
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
  "serviceIdea",
  "targetUser",
  "coreProblem",
  "expectedOutcome",
  "roughActors",
  "roughFlow",
  "mustHaveFeatures",
  "constraints",
];

/** 기획안 인터뷰 전체 슬롯 수(진행률 표시용) */
export const PROBLEM_INTERVIEW_SLOT_TOTAL = PROBLEM_INTERVIEW_SLOTS.length;

export function emptyProblemInterviewState(nowIso: string): ProblemInterviewState {
  return {
    serviceIdea: false,
    targetUser: false,
    coreProblem: false,
    expectedOutcome: false,
    roughActors: false,
    roughFlow: false,
    mustHaveFeatures: false,
    constraints: false,
    notes: {},
    partial: {},
    askedSlots: [],
    active: true,
    updatedAt: nowIso,
  };
}

export function problemInterviewSlotLabelKr(slot: ProblemInterviewSlot): string {
  if (slot === "serviceIdea") return "무엇을 만들고 싶은가";
  if (slot === "targetUser") return "주 사용자";
  if (slot === "coreProblem") return "가장 큰 문제";
  if (slot === "expectedOutcome") return "기대 효과";
  if (slot === "roughActors") return "개략 액터";
  if (slot === "roughFlow") return "개략 흐름";
  if (slot === "mustHaveFeatures") return "핵심 기능(3개 내외)";
  return "큰 제약사항";
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

  // serviceIdea (무엇을 만들고 싶은가)
  const ideaStrong =
    /(서비스|플랫폼|앱|웹|시스템|프로덕트).*(만들|구현|개발|하려고|원해|필요)/.test(t) ||
    /(자동화|생성|관리|정리|프로토타입)/.test(t);
  if (ideaStrong) {
    base.serviceIdea = true;
    addNote(notes, "serviceIdea", t);
  } else if (!base.serviceIdea && /(앱|웹|서비스|플랫폼)/.test(t)) {
    partial.serviceIdea = true;
    addNote(notes, "serviceIdeaHint", t);
  }

  // targetUser (주 사용자)
  const userHit =
    /(사용자|고객|회원|관리자|운영자|담당자|팀장|직원|강사|학생|환자|의사|상담사|매니저)/.test(t) &&
    /(누구|대상|주로|가장|자주|주체|하는\s*사람)/.test(t);
  if (userHit) {
    base.targetUser = true;
    addNote(notes, "targetUser", t);
  } else if (!base.targetUser && /(관리자|운영자|담당자|사용자|고객|회원)/.test(t)) {
    partial.targetUser = true;
    addNote(notes, "targetUserHint", t);
  }

  // coreProblem (가장 큰 문제)
  const problemStrong =
    /(불편|문제|어렵|힘들|번거|귀찮|시간.*(많|오래)|자주.*(누락|실수)|비효율|오류|중복|지연)/.test(t) ||
    /(늦|느리|헷갈|정리.*(힘|어렵))/i.test(t);
  if (problemStrong) {
    base.coreProblem = true;
    addNote(notes, "coreProblem", t);
  } else if (!base.coreProblem && /(불편|문제|힘들|어렵|시간|늦)/.test(t)) {
    partial.coreProblem = true;
    addNote(notes, "coreProblemHint", t);
  }

  // expectedOutcome (기대 효과)
  const outcomeStrong =
    /(원하|기대|되면|되었으면|하고\s*싶|목표|줄이|단축|자동|개선|빠르|즉시|정확)/.test(t) &&
    /(싶|원합니다|원해요|되면|되었으면)/.test(t);
  if (outcomeStrong) {
    base.expectedOutcome = true;
    addNote(notes, "expectedOutcome", t);
  } else if (!base.expectedOutcome && /(자동|개선|빠르|단축|줄이|정확)/.test(t)) {
    partial.expectedOutcome = true;
    addNote(notes, "expectedOutcomeHint", t);
  }

  // roughActors (개략 액터)
  if (/(사용자|고객|회원|관리자|운영자|담당자|상담사|강사|학생|직원)/.test(t) && /(\/|,|및|와|과)/.test(t)) {
    base.roughActors = true;
    addNote(notes, "roughActors", t);
  } else if (!base.roughActors && /(관리자|사용자|고객|회원|운영자|상담사)/.test(t)) {
    partial.roughActors = true;
    addNote(notes, "roughActorsHint", t);
  }

  // roughFlow (개략 흐름)
  if (/(→|->|▶|흐름|과정|절차)/.test(t) || /(가입|등록|업로드|분석|확인|예약|결제|상담)/.test(t)) {
    base.roughFlow = true;
    addNote(notes, "roughFlow", t);
  } else if (!base.roughFlow && /(업로드|확인|예약|결제)/.test(t)) {
    partial.roughFlow = true;
    addNote(notes, "roughFlowHint", t);
  }

  // mustHaveFeatures (핵심 기능 3개 내외)
  if (/(기능|필요|해야|지원|제공)/.test(t) && /(업로드|검색|요약|정리|공유|알림|예약|결제|상담|관리)/.test(t)) {
    base.mustHaveFeatures = true;
    addNote(notes, "mustHaveFeatures", t);
  } else if (!base.mustHaveFeatures && /(업로드|검색|요약|공유|알림|예약|결제|관리)/.test(t)) {
    partial.mustHaveFeatures = true;
    addNote(notes, "mustHaveFeaturesHint", t);
  }

  // constraints (큰 제약사항)
  if (/(예산|기간|일정|보안|법|규정|개인정보|정책|제약|필수)/i.test(t)) {
    base.constraints = true;
    addNote(notes, "constraints", t);
  } else if (!base.constraints && /(안\s*되|불가|못\s*함|필수)/.test(t)) {
    partial.constraints = true;
    addNote(notes, "constraintsHint", t);
  }

  return { ...base, notes, partial, updatedAt: nowIso, active: base.active !== false };
}

/** 레거시 비-LLM 경로(플래너 외부에서만 참조 시 사용). */
export function chooseNextProblemInterviewSlot(state: ProblemInterviewState): ProblemInterviewSlot | null {
  const priority: ProblemInterviewSlot[] = [
    "serviceIdea",
    "targetUser",
    "coreProblem",
    "expectedOutcome",
    "roughActors",
    "roughFlow",
    "mustHaveFeatures",
    "constraints",
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

  if (/(무엇|어떤\s*(서비스|앱|웹)|만들고|아이디어|서비스\s*개요|한\s*문장)/.test(t)) {
    push("serviceIdea");
  }
  if (/(누구|대상(?:은|이)?|사용자|고객|관리자|운영자|역할)/.test(t)) {
    push("targetUser");
  }
  if (/(가장\s*큰\s*(문제|불편)|문제점|불편|힘들|어렵|지연|비효율|오류|누락)/.test(t)) {
    push("coreProblem");
  }
  if (/(기대\s*효과|원하는\s*상태|어떻게\s*개선|목표|되면\s*좋|원하)/.test(t)) {
    push("expectedOutcome");
  }
  if (/(액터|역할|사용자\s*종류|누가\s*쓰|관리자\s*포함)/.test(t)) {
    push("roughActors");
  }
  if (/(흐름|한\s*줄|단계|과정|→|->|업로드|분석|확인|예약|결제|상담)/.test(t)) {
    push("roughFlow");
  }
  if (/(핵심\s*기능|꼭\s*필요|필수\s*기능|3개)/.test(t)) {
    push("mustHaveFeatures");
  }
  if (/(제약|예산|기간|일정|보안|정책|개인정보|필수)/i.test(t)) {
    push("constraints");
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
  "아이디어 초안에 필요한 핵심 정보가 모두 확보되었습니다.\n정리 요청으로 아이디어 초안을 생성할 수 있습니다.";

/** 질문 후보 우선순위(플랫폼). 분석기 힌트는 이 순서 안에서만 조정한다. */
export const PROBLEM_INTERVIEW_QUESTION_PRIORITY: readonly ProblemInterviewSlot[] = [
  "serviceIdea",
  "targetUser",
  "coreProblem",
  "expectedOutcome",
  "roughActors",
  "roughFlow",
  "mustHaveFeatures",
  "constraints",
] as const;

export const INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD = 0.55;

export const INTERVIEW_CLARIFICATION_QUESTION_KR =
  "말씀하신 내용을 이해했습니다.\n가장 큰 문제(불편)를 한 문장으로만 알려주실 수 있을까요?";

function isProblemInterviewSlot(s: string): s is ProblemInterviewSlot {
  return (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(s);
}

/** API·저장소 레거시 `mvpPriority` 문자열을 신규 슬롯으로 매핑 */
function normalizeLegacyInterviewSlotId(s: string): ProblemInterviewSlot | null {
  const t = String(s ?? "").trim();
  // legacy -> new slot mapping (best-effort)
  if (t === "coreUser") return "targetUser";
  if (t === "productGoal") return "serviceIdea";
  if (t === "painPoint") return "coreProblem";
  if (t === "needForImprovement") return "expectedOutcome";
  if (t === "currentMethod") return "serviceIdea";
  if (t === "coreFeatures") return "mustHaveFeatures";
  if (t === "featurePriority") return "mustHaveFeatures";
  if (t === "mvpPriority") return "mustHaveFeatures";
  if (t === "mvpScope") return "mustHaveFeatures";
  if (t === "kpiSuccess") return "expectedOutcome";
  if (t === "constraints") return "constraints";
  if (t === "operations") return "roughActors";
  if (t === "platformType") return "roughActors";
  if (t === "roughFlow") return "roughFlow";
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
  // legacy wire: boolean slots + {partial} + notes map
  if (
    typeof (o as any).coreUser === "boolean" ||
    typeof (o as any).painPoint === "boolean" ||
    typeof (o as any).needForImprovement === "boolean"
  ) {
    const base = emptyProblemInterviewState(nowIso);
    const partialRaw =
      typeof o.partial === "object" && o.partial !== null ? { ...(o.partial as Record<string, boolean>) } : {};

    const setFromLegacy = (legacyKey: string, slot: ProblemInterviewSlot) => {
      const v = (o as Record<string, unknown>)[legacyKey];
      if (typeof v === "boolean" && v) (base as unknown as Record<string, boolean>)[slot] = true;
      if (partialRaw[legacyKey]) (base.partial as any)[slot] = true;
    };

    setFromLegacy("coreUser", "targetUser");
    setFromLegacy("productGoal", "serviceIdea");
    setFromLegacy("painPoint", "coreProblem");
    setFromLegacy("needForImprovement", "expectedOutcome");
    setFromLegacy("currentMethod", "serviceIdea");
    setFromLegacy("coreFeatures", "mustHaveFeatures");
    setFromLegacy("featurePriority", "mustHaveFeatures");
    setFromLegacy("mvpScope", "mustHaveFeatures");
    setFromLegacy("kpiSuccess", "expectedOutcome");
    setFromLegacy("constraints", "constraints");
    setFromLegacy("operations", "roughActors");

    const notesLegacy =
      typeof o.notes === "object" && o.notes !== null && !Array.isArray(o.notes)
        ? { ...(o.notes as Record<string, string>) }
        : {};
    const notes: ProblemInterviewNotes = { ...(base.notes ?? {}) };
    for (const [k, v] of Object.entries(notesLegacy)) {
      const key = normalizeLegacyInterviewSlotId(String(k ?? "").trim());
      const val = String(v ?? "").trim();
      if (!key || !val) continue;
      notes[key] = notes[key] ? `${notes[key]}\n${val}`.trim().slice(0, 8000) : val.slice(0, 8000);
    }

    return {
      ...base,
      notes,
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
  roughActors: "기본 액터(초안): 일반 사용자 / 관리자 2가지 역할로 가정합니다.",
  roughFlow: "기본 흐름(초안): 입력(업로드/등록) → 처리(분석/정리) → 결과 확인 → 공유/저장.",
  mustHaveFeatures: "기본 핵심 기능(초안): 입력(업로드/작성) · AI 처리(요약/분류) · 결과 공유.",
  constraints: "기본 제약(초안): 개인정보 보호 및 최소 2~4주 내 MVP 가정.",
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

  // 아이디어 구체화 단계에서는 거친 초안만으로 진행할 수 있도록 일부 슬롯을 기본안으로 "확정" 처리
  for (const slot of ["roughActors", "roughFlow", "mustHaveFeatures", "constraints"] as const) {
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
  return `현재 아이디어 정리도는 ${pct}%입니다 (${strict} / ${total} 슬롯 확정). 간단히 핵심만 더 확인하겠습니다.`;
}

const CONTROLLED_SLOT_QUESTIONS: Record<ProblemInterviewSlot, readonly string[]> = {
  serviceIdea: [
    "무엇을 만들고 싶은가요? (예: 회의록 자동화 웹서비스, 중고차 비교 앱)",
    "한 문장으로 서비스 아이디어를 적어주실 수 있을까요?",
  ],
  targetUser: [
    "주 사용자는 누구인가요? (예: 회사 직원, 소상공인, 학생, 관리자)",
    "이 서비스를 가장 자주 쓰게 될 사람(역할)은 누구인가요?",
  ],
  coreProblem: [
    "현재 가장 큰 불편/문제는 무엇인가요? (한 문장)",
    "지금 가장 시간이 많이 들거나 자주 막히는 지점은 어디인가요?",
  ],
  expectedOutcome: [
    "어떻게 개선되길 원하나요? (예: 5분 내 자동 생성, 즉시 응답)",
    "이 서비스가 성공했다고 느끼려면 무엇이 달라져야 하나요?",
  ],
  roughActors: [
    "사용자 종류를 개략적으로만 적어주세요. (예: 일반 사용자 / 관리자)",
    "누가 누굴 위해 쓰나요? (예: 고객 / 상담사 / 관리자)",
  ],
  roughFlow: [
    "서비스 흐름을 한 줄로만 적어주세요. (예: 업로드 → 분석 → 결과 확인)",
    "사용자가 처음부터 끝까지 하는 과정을 3~5단계로만 적어주실 수 있나요?",
  ],
  mustHaveFeatures: [
    "반드시 필요한 핵심 기능을 3개 내외로 적어주세요. (예: 파일 업로드, 자동 요약, 공유 링크)",
    "없으면 서비스가 성립하지 않는 기능 3가지는 무엇인가요?",
  ],
  constraints: [
    "큰 제약사항이 있나요? (예: 1개월 MVP, 개인정보 필수 보호, 모바일 우선)",
    "기간/예산/정책/보안 등 반드시 지켜야 할 조건이 있으면 적어주세요.",
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
    serviceIdea: "서비스 아이디어를 한 문장으로 정리하면 나머지 질문이 짧아집니다.",
    targetUser: "주 사용자(역할)만 정해도 이후 단계(액터/흐름) 품질이 좋아집니다.",
    coreProblem: "가장 큰 문제 1개만 먼저 확정해 주세요.",
    expectedOutcome: "원하는 개선 결과(한 문장)만 정해도 방향이 선명해집니다.",
    roughActors: "액터는 ‘사용자 종류’만 개략적으로 잡으면 충분해요. 상세 권한은 다음 탭에서 다룹니다.",
    roughFlow: "흐름은 한 줄만이면 됩니다. 상세 플로우는 다음 탭에서 다룹니다.",
    mustHaveFeatures: "핵심 기능 3개만 정하면 다음 단계에서 기능/Task 정리가 쉬워집니다.",
    constraints: "큰 제약(기간/보안/정책)만 먼저 잡아두면 나중에 되돌림이 줄어듭니다.",
  };
  return hints[next] ?? "아이디어 초안 완성도를 위해 핵심만 더 확인하겠습니다.";
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
    // legacy analyzers may output old slot ids; try them as aliases
    const legacyAliases: Partial<Record<ProblemInterviewSlot, readonly string[]>> = {
      serviceIdea: ["productGoal", "currentMethod"],
      targetUser: ["coreUser"],
      coreProblem: ["painPoint"],
      expectedOutcome: ["needForImprovement", "kpiSuccess"],
      roughActors: ["operations", "platformType"],
      roughFlow: ["mainScreens"],
      mustHaveFeatures: ["coreFeatures", "featurePriority", "mvpPriority", "mvpScope"],
      constraints: ["constraints", "integrations"],
    };
    const keys = [slot, ...(legacyAliases[slot] ?? [])];
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
        if (!notes.mustHaveFeatures?.length) notes.mustHaveFeatures = [...lines];
      }
    }
  }
  let nextBestSlot: ProblemInterviewSlot | null = null;
  const nb = o.nextBestSlot;
  if (nb === null) nextBestSlot = null;
  else if (typeof nb === "string") {
    const rawNb = nb.trim();
    const mapped = normalizeLegacyInterviewSlotId(rawNb) ?? (isProblemInterviewSlot(rawNb) ? (rawNb as ProblemInterviewSlot) : null);
    if (mapped) nextBestSlot = mapped;
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

