import { stripJsonMarkdownFences } from "@/lib/requirements/ideationDeliverables";
import { IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";

export type ProblemInterviewSlot =
  | "productGoal"
  | "targetUser"
  | "platformType"
  | "coreFeatures"
  | "authNeed"
  | "mainScreens"
  | "dataEntities"
  | "integrations"
  | "mvpScope"
  | "designLevel";

export type ProblemInterviewNotes = Record<string, string>;

export type ProblemInterviewState = {
  productGoal: boolean;
  targetUser: boolean;
  platformType: boolean;
  coreFeatures: boolean;
  authNeed: boolean;
  mainScreens: boolean;
  dataEntities: boolean;
  integrations: boolean;
  mvpScope: boolean;
  designLevel: boolean;
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
  "productGoal",
  "targetUser",
  "platformType",
  "coreFeatures",
  "authNeed",
  "mainScreens",
  "dataEntities",
  "integrations",
  "mvpScope",
  "designLevel",
];

/** 기획안 인터뷰 전체 슬롯 수(진행률 표시용) */
export const PROBLEM_INTERVIEW_SLOT_TOTAL = PROBLEM_INTERVIEW_SLOTS.length;

export function emptyProblemInterviewState(nowIso: string): ProblemInterviewState {
  return {
    productGoal: false,
    targetUser: false,
    platformType: false,
    coreFeatures: false,
    authNeed: false,
    mainScreens: false,
    dataEntities: false,
    integrations: false,
    mvpScope: false,
    designLevel: false,
    notes: {},
    partial: {},
    askedSlots: [],
    active: true,
    updatedAt: nowIso,
  };
}

export function problemInterviewSlotLabelKr(slot: ProblemInterviewSlot): string {
  if (slot === "productGoal") return "무엇을 만들고 싶은가";
  if (slot === "targetUser") return "누가 사용하는가";
  if (slot === "platformType") return "플랫폼 형태(웹/모바일/관리자/혼합)";
  if (slot === "coreFeatures") return "핵심 기능";
  if (slot === "authNeed") return "로그인/권한 필요 여부";
  if (slot === "mainScreens") return "주요 화면 구성";
  if (slot === "dataEntities") return "저장 데이터 종류";
  if (slot === "integrations") return "외부 연동";
  if (slot === "mvpScope") return "MVP 범위";
  return "디자인 수준(간단/일반/고급)";
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

  // productGoal (무엇을 만들고 싶은가)
  const goalStrong =
    /(만들|구현|개발|서비스|플랫폼|프로덕트|앱|웹|시스템).*(하고\s*싶|만들고\s*싶|필요|원해|원합니다|하려고)/.test(t) ||
    /(자동화|생성|관리|정리|대시보드|프로토타입)/.test(t);
  if (goalStrong) {
    base.productGoal = true;
    addNote(notes, "productGoal", t);
  } else if (!base.productGoal && /(만들|앱|웹|서비스|플랫폼)/.test(t)) {
    partial.productGoal = true;
    addNote(notes, "productGoalHint", t);
  }

  // targetUser (누가 사용하는가)
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

  // platformType (웹/모바일/관리자/혼합)
  const platformHit = /(웹|모바일|앱|ios|안드로이드|관리자|어드민|admin|혼합|웹앱)/i.test(t);
  if (platformHit) {
    base.platformType = true;
    addNote(notes, "platformType", t);
  } else if (!base.platformType && /(웹|앱|관리자)/.test(t)) {
    partial.platformType = true;
    addNote(notes, "platformTypeHint", t);
  }

  // coreFeatures
  if (/(기능|화면|대시보드|알림|검색|업로드|다운로드|승인\s*흐름)/.test(t) && /(필요|구현|만들|추가|포함)/.test(t)) {
    base.coreFeatures = true;
    addNote(notes, "coreFeatures", t);
  } else if (!base.coreFeatures && /(기능|화면|대시보드)/.test(t)) {
    partial.coreFeatures = true;
    addNote(notes, "coreFeaturesHint", t);
  }

  // authNeed (로그인/권한)
  if (/(로그인|회원가입|권한|역할|role|rbac|접근\s*제어|인증|oauth|ss[o0])/i.test(t)) {
    base.authNeed = true;
    addNote(notes, "authNeed", t);
  } else if (!base.authNeed && /(로그인|권한|인증)/.test(t)) {
    partial.authNeed = true;
    addNote(notes, "authNeedHint", t);
  }

  // mainScreens (주요 화면)
  if (/(화면|페이지|뷰|탭|플로우|대시보드|리스트|상세|작성|편집)/.test(t) && /(구성|필요|있|원해|포함)/.test(t)) {
    base.mainScreens = true;
    addNote(notes, "mainScreens", t);
  } else if (!base.mainScreens && /(화면|페이지|대시보드|리스트|상세)/.test(t)) {
    partial.mainScreens = true;
    addNote(notes, "mainScreensHint", t);
  }

  // dataEntities (저장 데이터)
  if (/(데이터|저장|DB|테이블|엔티티|모델|필드|레코드)/i.test(t) && /(무엇|종류|구성|필요|있)/.test(t)) {
    base.dataEntities = true;
    addNote(notes, "dataEntities", t);
  } else if (!base.dataEntities && /(DB|데이터|저장)/i.test(t)) {
    partial.dataEntities = true;
    addNote(notes, "dataEntitiesHint", t);
  }

  // integrations (외부 연동)
  if (/(연동|API|웹훅|메일|결제|슬랙|카카오|구글|드라이브|파일|S3|AI|LLM|크롤링)/i.test(t)) {
    base.integrations = true;
    addNote(notes, "integrations", t);
  } else if (!base.integrations && /(연동|API|결제|메일|파일|AI)/i.test(t)) {
    partial.integrations = true;
    addNote(notes, "integrationsHint", t);
  }

  // mvpScope (MVP 포함/제외 범위)
  if (/(MVP|최소|1차\s*출시|첫\s*버전|포함\s*범위|제외|후순위)/i.test(t)) {
    base.mvpScope = true;
    addNote(notes, "mvpScope", t);
  } else if (!base.mvpScope && /(포함|빼|일단|범위)/.test(t)) {
    partial.mvpScope = true;
    addNote(notes, "mvpScopeHint", t);
  }

  // designLevel (간단/일반/고급)
  if (/(간단|심플|단순|기본|일반|보통|고급|완성도|디자인|UI|UX)/i.test(t)) {
    base.designLevel = true;
    addNote(notes, "designLevel", t);
  } else if (!base.designLevel && /(디자인|UI|UX)/i.test(t)) {
    partial.designLevel = true;
    addNote(notes, "designLevelHint", t);
  }

  return { ...base, notes, partial, updatedAt: nowIso, active: base.active !== false };
}

/** 레거시 비-LLM 경로(플래너 외부에서만 참조 시 사용). */
export function chooseNextProblemInterviewSlot(state: ProblemInterviewState): ProblemInterviewSlot | null {
  const priority: ProblemInterviewSlot[] = [
    "productGoal",
    "targetUser",
    "platformType",
    "coreFeatures",
    "authNeed",
    "mainScreens",
    "dataEntities",
    "integrations",
    "mvpScope",
    "designLevel",
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

  if (/(무엇|어떤\s*서비스|만들고|구현|프로덕트|앱|웹|플랫폼)/.test(t)) {
    push("productGoal");
  }
  if (/(누구|대상(?:은|이)?|사용자|고객|관리자|운영자|역할)/.test(t)) {
    push("targetUser");
  }
  if (/(웹|모바일|앱|ios|안드로이드|관리자|어드민|admin|혼합)/i.test(t)) {
    push("platformType");
  }
  if (/(기능|화면|요구\s*사항|필요\s*기능)/.test(t)) {
    push("coreFeatures");
  }
  if (/(로그인|회원가입|권한|role|rbac|인증|oauth|SSO)/i.test(t)) {
    push("authNeed");
  }
  if (/(주요\s*화면|화면\s*구성|페이지|대시보드|리스트|상세|작성|편집)/.test(t)) {
    push("mainScreens");
  }
  if (/(데이터|DB|엔티티|테이블|저장|모델)/i.test(t)) {
    push("dataEntities");
  }
  if (/(연동|API|웹훅|메일|결제|슬랙|카카오|구글|드라이브|파일|S3|AI|LLM)/i.test(t)) {
    push("integrations");
  }
  if (/(MVP|1차|첫\s*출시|필수\s*포함|제외|후순위|범위)/.test(t)) {
    push("mvpScope");
  }
  if (/(디자인|UI|UX|간단|일반|고급|완성도)/i.test(t)) {
    push("designLevel");
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
  "productGoal",
  "targetUser",
  "platformType",
  "coreFeatures",
  "authNeed",
  "mainScreens",
  "dataEntities",
  "integrations",
  "mvpScope",
  "designLevel",
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
  // legacy -> new slot mapping (best-effort)
  if (t === "coreUser") return "targetUser";
  if (t === "painPoint") return "productGoal";
  if (t === "needForImprovement") return "productGoal";
  if (t === "currentMethod") return "productGoal";
  if (t === "featurePriority") return "mvpScope";
  if (t === "mvpPriority") return "mvpScope";
  if (t === "kpiSuccess") return "productGoal";
  if (t === "constraints") return "integrations";
  if (t === "operations") return "platformType";
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
    setFromLegacy("painPoint", "productGoal");
    setFromLegacy("needForImprovement", "productGoal");
    setFromLegacy("currentMethod", "productGoal");
    setFromLegacy("coreFeatures", "coreFeatures");
    setFromLegacy("featurePriority", "mvpScope");
    setFromLegacy("mvpScope", "mvpScope");
    setFromLegacy("kpiSuccess", "productGoal");
    setFromLegacy("constraints", "integrations");
    setFromLegacy("operations", "platformType");

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
  platformType: "기본 플랫폼 형태(초안): 웹(사용자용) + 관리자(어드민) 혼합으로 가정합니다.",
  authNeed: "기본 인증(초안): 로그인/역할 기반 권한(RBAC) 적용을 기본으로 가정합니다.",
  integrations: "기본 연동(초안): 이메일 알림·파일 업로드를 우선 가정하고, 결제는 필요 시 확장합니다.",
  designLevel: "기본 디자인 수준(초안): 일반(실무형 UI, 과도한 커스텀 디자인 제외)로 가정합니다.",
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

  // 실행/프로토타입 생성에 직접적인 기본 옵션은 "기본안 확정"으로 처리(재질문 최소화)
  for (const slot of ["platformType", "authNeed", "integrations", "designLevel"] as const) {
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
  productGoal: [
    "무엇을 만들고 싶은가요? (한 문장으로: 사용자가 무엇을 할 수 있게 만들고 싶나요?)",
    "이 아이디어로 최종적으로 자동화/생성/관리하고 싶은 것은 무엇인가요?",
  ],
  targetUser: [
    "누가 사용하나요? (주 사용자 역할 1~2개: 예. 사용자/관리자/운영자)",
    "가장 자주 쓰는 사람은 누구이며, 어떤 업무를 하다가 이 기능이 필요해졌나요?",
  ],
  platformType: [
    "플랫폼 형태는 무엇이 좋나요? (웹 / 모바일 / 관리자 / 혼합)",
    "사용자용 화면과 관리자(어드민) 화면이 모두 필요한가요?",
  ],
  coreFeatures: [
    "핵심 기능 3가지만 적어주세요. (가능하면 동사형: 예. 업로드/검색/자동 요약)",
    "프로토타입에서 ‘반드시 동작해야 하는 것’ 3가지는 무엇인가요?",
  ],
  authNeed: [
    "로그인/권한이 필요하나요? (필요/불필요 + 필요하면 역할 예: 관리자/일반사용자)",
    "익명 사용 가능인가요, 아니면 회원/조직 단위로 구분해야 하나요?",
  ],
  mainScreens: [
    "주요 화면 구성은 어떻게 되나요? (예: 목록/상세/작성/관리자 대시보드)",
    "사용자가 처음 들어왔을 때부터 목표를 달성할 때까지 화면 흐름을 3~6개로 적어주세요.",
  ],
  dataEntities: [
    "저장해야 하는 데이터 종류는 무엇인가요? (예: 사용자, 프로젝트, 문서, 작업(Task) 등)",
    "각 데이터에서 최소로 필요한 필드가 있다면 알려주세요. (예: 제목/상태/작성자/첨부파일)",
  ],
  integrations: [
    "외부 연동이 필요하나요? (메일/결제/AI/파일/슬랙 등) 필요하면 무엇인가요?",
    "현재 쓰는 시스템(구글드라이브/노션/슬랙/사내DB 등)과 연결이 필요한가요?",
  ],
  mvpScope: [
    "초기 버전(MVP)에 꼭 필요한 범위만 남긴다면 무엇을 포함/제외할까요?",
    "프로토타입 1차에서 ‘없어도 되는 것’ 3개를 먼저 빼보면 무엇인가요?",
  ],
  designLevel: [
    "디자인 수준은 어느 정도가 좋나요? (간단 / 일반 / 고급)",
    "UI는 빠른 프로토타입(간단)로 갈까요, 아니면 실서비스 수준(일반/고급)에 가깝게 할까요?",
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
    productGoal: "무엇을 만들지 한 문장으로 정리해 주시면 다음 단계(화면/데이터)로 빠르게 넘어갈 수 있어요.",
    targetUser: "주 사용자(역할)를 정하면 화면/권한/데이터 구조를 더 정확히 잡을 수 있어요.",
    platformType: "웹/모바일/관리자(어드민) 여부를 정하면 프로토타입 구조가 명확해져요.",
    coreFeatures: "핵심 기능 3개만 확정하면 바로 Task 분해가 가능해져요.",
    authNeed: "로그인/권한 여부를 정하면 사용자 흐름과 데이터 접근 규칙을 만들 수 있어요.",
    mainScreens: "주요 화면 구성이 정해지면 프로토타입 화면/라우팅을 바로 설계할 수 있어요.",
    dataEntities: "저장 데이터 종류가 정해지면 DB 스키마와 API를 바로 설계할 수 있어요.",
    integrations: "외부 연동 여부를 정하면 필요한 API/권한/키 관리 범위를 정할 수 있어요.",
    mvpScope: "MVP 범위를 좁히면 질문 수가 줄고, 더 빠르게 프로토타입을 만들 수 있어요.",
    designLevel: "디자인 수준을 정하면 UI 작업량과 프로토타입 완성도를 맞출 수 있어요.",
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
    // legacy analyzers may output old slot ids; try them as aliases
    const legacyAliases: Partial<Record<ProblemInterviewSlot, readonly string[]>> = {
      productGoal: ["painPoint", "needForImprovement", "currentMethod", "kpiSuccess"],
      targetUser: ["coreUser"],
      platformType: ["operations"],
      integrations: ["constraints"],
      mvpScope: ["featurePriority", "mvpPriority"],
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
        if (!notes.mvpScope?.length) notes.mvpScope = [...lines];
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

