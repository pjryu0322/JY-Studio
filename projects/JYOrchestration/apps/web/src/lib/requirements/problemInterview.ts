import { stripJsonMarkdownFences } from "@/lib/requirements/ideationDeliverables";

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

// ---------------------------------------------------------------------------
// LLM 인터뷰 분석기 + 플랫폼 질문 작성(규칙 기반 슬롯 채우기 대체)
// ---------------------------------------------------------------------------

export type InterviewSlotLevel = "empty" | "partial" | "filled";

export type InterviewAnalyzerPayload = {
  summary: string;
  filledSlots: Record<ProblemInterviewSlot, InterviewSlotLevel>;
  notes: Partial<Record<ProblemInterviewSlot, string[]>>;
  nextBestSlot: ProblemInterviewSlot | null;
  confidence: number;
};

/** 질문 후보 우선순위(플랫폼). 분석기 힌트는 이 순서 안에서만 조정한다. */
export const PROBLEM_INTERVIEW_QUESTION_PRIORITY: readonly ProblemInterviewSlot[] = [
  "painPoint",
  "coreUser",
  "needForImprovement",
  "currentMethod",
] as const;

export const INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD = 0.55;

export const INTERVIEW_CLARIFICATION_QUESTION_KR =
  "말씀하신 내용을 이해했습니다.\n현재 방식에서 가장 큰 불편 요소가 무엇인지 한 가지만 알려주실 수 있을까요?";

function isProblemInterviewSlot(s: string): s is ProblemInterviewSlot {
  return (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(s);
}

function interviewLevelRank(l: InterviewSlotLevel): number {
  if (l === "filled") return 2;
  if (l === "partial") return 1;
  return 0;
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
    const incoming: InterviewSlotLevel = analyzer.filledSlots[slot] ?? "empty";
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
};

export function getControlledQuestionForSlot(slot: ProblemInterviewSlot, turnSeed: number): string {
  const variants = CONTROLLED_SLOT_QUESTIONS[slot];
  const pick = variants[Math.abs(turnSeed) % variants.length] ?? variants[0];
  return pick;
}

/**
 * 다음에 물을 슬롯: 분석기 힌트 + 고정 우선순위, strict filled·연속 동일 슬롯 질문은 건너뜀.
 */
export function pickNextAskableInterviewSlot(
  state: ProblemInterviewState,
  asked: readonly ProblemInterviewSlot[] | undefined,
  hint: ProblemInterviewSlot | null
): ProblemInterviewSlot | null {
  const ordered: ProblemInterviewSlot[] = [];
  if (hint && isProblemInterviewSlot(hint)) ordered.push(hint);
  for (const s of PROBLEM_INTERVIEW_QUESTION_PRIORITY) {
    if (!ordered.includes(s)) ordered.push(s);
  }
  for (const slot of ordered) {
    if (slotStrictlyFilled(state, slot)) continue;
    if (isDoubleRepeatAsk(asked, slot)) continue;
    return slot;
  }
  return null;
}

export type InterviewQuestionPlan =
  | { kind: "slot"; slot: ProblemInterviewSlot; question: string; summary: string }
  | { kind: "clarification"; question: string; summary: string };

/**
 * 병합된 상태 + 분석기 결과로 사용자에게 보여줄 한 턴을 결정한다.
 * - confidence 낮으면 확인형 질문 1개만(슬롯 고정 문구 아님).
 * - 모든 슬롯이 covered(부분 포함)면 null → 인터뷰 종료.
 */
export function planNextInterviewTurn(
  mergedState: ProblemInterviewState,
  analyzer: InterviewAnalyzerPayload | null,
  asked: readonly ProblemInterviewSlot[] | undefined,
  turnSeed: number,
  confidenceThreshold = INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
  fallbackSummary?: string
): InterviewQuestionPlan | null {
  if (PROBLEM_INTERVIEW_SLOTS.every((s) => problemInterviewIsCovered(mergedState, s))) {
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
  const slot = pickNextAskableInterviewSlot(mergedState, asked, hint);
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
  const confRaw = o.confidence;
  const confidence = typeof confRaw === "number" && Number.isFinite(confRaw) ? Math.min(1, Math.max(0, confRaw)) : 0;
  const fsRaw = o.filledSlots;
  const filledSlots = {} as Record<ProblemInterviewSlot, InterviewSlotLevel>;
  for (const slot of PROBLEM_INTERVIEW_SLOTS) {
    let v: InterviewSlotLevel = "empty";
    if (fsRaw && typeof fsRaw === "object") {
      const x = String((fsRaw as Record<string, unknown>)[slot] ?? "").trim().toLowerCase();
      if (x === "filled" || x === "partial" || x === "empty") v = x;
    }
    filledSlots[slot] = v;
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
  }
  let nextBestSlot: ProblemInterviewSlot | null = null;
  const nb = o.nextBestSlot;
  if (nb === null) nextBestSlot = null;
  else if (typeof nb === "string" && isProblemInterviewSlot(nb.trim())) nextBestSlot = nb.trim() as ProblemInterviewSlot;

  return { summary, filledSlots, notes, nextBestSlot, confidence };
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

