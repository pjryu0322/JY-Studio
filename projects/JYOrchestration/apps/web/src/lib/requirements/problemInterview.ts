export type ProblemInterviewSlot = "coreUser" | "painPoint" | "currentMethod" | "needForImprovement";

export type ProblemInterviewNotes = Record<string, string>;

export type ProblemInterviewState = {
  coreUser: boolean;
  painPoint: boolean;
  currentMethod: boolean;
  needForImprovement: boolean;
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
];

export function emptyProblemInterviewState(nowIso: string): ProblemInterviewState {
  return {
    coreUser: false,
    painPoint: false,
    currentMethod: false,
    needForImprovement: false,
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
  return "개선 필요성";
}

export function problemInterviewCoveredCount(state: ProblemInterviewState | null | undefined): number {
  if (!state) return 0;
  const partial = state.partial ?? {};
  let n = 0;
  if (state.coreUser || partial.coreUser) n += 1;
  if (state.painPoint || partial.painPoint) n += 1;
  if (state.currentMethod || partial.currentMethod) n += 1;
  if (state.needForImprovement || partial.needForImprovement) n += 1;
  return n;
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
 * 매우 가벼운 키워드 기반 해석기(LLM 없이도 반복 질문을 방지할 최소 요건).
 * - filled: 명확한 진술
 * - partial: 힌트만 존재
 */
export function updateProblemInterviewFromUserMessage(
  prev: ProblemInterviewState | null | undefined,
  userText: string,
  nowIso: string
): ProblemInterviewState {
  const base = prev ? { ...prev } : emptyProblemInterviewState(nowIso);
  const t = String(userText ?? "").trim();
  if (!t) return { ...base, updatedAt: nowIso };
  const lower = t.toLowerCase();
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

  return { ...base, notes, partial, updatedAt: nowIso, active: base.active !== false };
}

export function chooseNextProblemInterviewSlot(state: ProblemInterviewState): ProblemInterviewSlot | null {
  // Priority: painPoint -> coreUser -> needForImprovement -> refinement(currentMethod if missing)
  const priority: ProblemInterviewSlot[] = ["painPoint", "coreUser", "needForImprovement", "currentMethod"];
  for (const slot of priority) {
    if (!problemInterviewIsCovered(state, slot)) return slot;
  }
  return null;
}

export function buildNextProblemInterviewQuestion(state: ProblemInterviewState, turnSeed: number): { slot: ProblemInterviewSlot; question: string } | null {
  const slot = chooseNextProblemInterviewSlot(state);
  if (!slot) return null;
  // Duplicate guard: never ask a slot that is already covered (filled or partial)
  if (problemInterviewIsCovered(state, slot)) return null;

  const variants: Record<ProblemInterviewSlot, string[]> = {
    painPoint: [
      "현재 방식에서 가장 불편하거나 시간이 많이 드는 지점은 무엇인가요?",
      "지금 겪고 있는 문제를 한 문장으로 말하면 어떤 점이 가장 큰가요?",
    ],
    coreUser: [
      "이 문제를 가장 자주 겪는 핵심 사용자는 누구인가요? (예: 사용자/관리자/운영자 등)",
      "이 업무/상황의 주 사용자는 누구이며, 어떤 역할을 하나요?",
    ],
    needForImprovement: [
      "개선이 꼭 필요하다고 느끼는 이유나 기대하는 변화는 무엇인가요?",
      "무엇이 바뀌면 '이 문제는 해결됐다'고 느낄 수 있나요?",
    ],
    currentMethod: [
      "현재(기존)에는 이 문제를 어떤 방식으로 해결/관리하고 있나요?",
      "지금은 어떤 도구나 프로세스로 처리하고 있나요? (예: 엑셀, 메신저, 수기 등)",
    ],
  };
  const pick = variants[slot][turnSeed % variants[slot].length] ?? variants[slot][0];
  return { slot, question: pick };
}

export function withAskedSlot(state: ProblemInterviewState, slot: ProblemInterviewSlot, nowIso: string): ProblemInterviewState {
  const asked = Array.isArray(state.askedSlots) ? [...state.askedSlots] : [];
  asked.push(slot);
  return { ...state, askedSlots: asked.slice(-16), updatedAt: nowIso };
}

