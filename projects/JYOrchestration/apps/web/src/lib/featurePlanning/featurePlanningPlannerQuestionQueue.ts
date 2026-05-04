/**
 * 기능정리 planner-turn — 서비스 단계별 세부 확인 질문 큐(내부 id).
 * 슬롯 병합과 별개로 대화 진행(반복 질문 방지)에만 사용한다.
 */

export type PlannerQueueFieldV1 = {
  readonly id: string;
  /** 한글 라벨 — 프롬프트에만 사용 */
  readonly labelKo: string;
};

const UPLOAD_STYLE_QUEUE: readonly PlannerQueueFieldV1[] = [
  { id: "file_format", labelKo: "허용 파일 형식" },
  { id: "file_size_max", labelKo: "최대 파일 용량" },
  { id: "upload_method", labelKo: "업로드 방식" },
  { id: "upload_progress", labelKo: "업로드 진행률" },
  { id: "upload_retry", labelKo: "실패 시 재시도" },
  { id: "upload_done_notify", labelKo: "업로드 완료 알림" },
  { id: "privacy_security_upload", labelKo: "개인정보·보안 안내" },
] as const;

const GENERIC_SERVICE_QUEUE: readonly PlannerQueueFieldV1[] = [
  { id: "scope_goal", labelKo: "목적·범위" },
  { id: "primary_user_actions", labelKo: "핵심 사용자 행동" },
  { id: "constraints_limits", labelKo: "제한·예외" },
  { id: "progress_feedback", labelKo: "진행 안내·피드백" },
  { id: "failure_recovery", labelKo: "실패·복구" },
  { id: "completion_notify", labelKo: "완료 알림" },
  { id: "privacy_security", labelKo: "개인정보·보안" },
] as const;

function dedupeIds(ids: readonly string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of ids) {
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

/** 승인된 서비스 단계 제목 정규화 — 메모리 plannerQueueStepKey와 비교 */
export function normalizePlannerQueueStepKey(stepTitle: string): string {
  return stepTitle
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9\uac00-\ud7a3_-]+/g, "")
    .slice(0, 80);
}

export function resolvePlannerQuestionQueue(currentServiceStepTitle: string): readonly PlannerQueueFieldV1[] {
  const t = currentServiceStepTitle.trim().toLowerCase();
  if (
    /업로드|upload|첨부|파일|녹취|음성|미디어|attachment|드래그앤드롭|드래그/.test(t) ||
    (t.includes("파일") && (t.includes("단계") || t.includes("화면")))
  ) {
    return UPLOAD_STYLE_QUEUE;
  }
  return GENERIC_SERVICE_QUEUE;
}

export function nextUnansweredPlannerField(
  queue: readonly PlannerQueueFieldV1[],
  answeredFieldIds: readonly string[]
): PlannerQueueFieldV1 | undefined {
  const done = new Set(answeredFieldIds.map((x) => x.trim()).filter(Boolean));
  return queue.find((f) => !done.has(f.id));
}

function matchesFileFormat(userNorm: string): boolean {
  if (/mp3|wav|m4a|aac|flac|ogg|wma|opus/.test(userNorm)) return true;
  if (/형식|확장자|포맷|파일\s*종류|첨부.*형식|형식만|만\s*허용|허용.*형식/.test(userNorm)) return true;
  return false;
}

function matchesFileSize(userNorm: string): boolean {
  return /\d+\s*(mb|gb|kb|메가|기가|키로|용량)|최대\s*\d+|용량\s*제한|파일\s*크기/.test(userNorm);
}

function matchesUploadMethod(userNorm: string): boolean {
  return /드래그|클릭\s*업로드|버튼|한\s*번에|여러\s*파일|멀티|일괄|폴더/.test(userNorm);
}

function matchesProgress(userNorm: string): boolean {
  return /진행률|프로그레스|퍼센트|%\s*표시|로딩\s*바|progress/i.test(userNorm);
}

function matchesRetry(userNorm: string): boolean {
  return /재시도|다시\s*업로드|실패\s*시|오류\s*시|retry|에러\s*시/.test(userNorm);
}

function matchesNotify(userNorm: string): boolean {
  return /알림|완료\s*후|push|토스트|메일|이메일|sms|완료\s*메시지/.test(userNorm);
}

function matchesPrivacy(userNorm: string): boolean {
  return /개인정보|보안|암호화|https|삭제\s*정책|유출|마스킹/.test(userNorm);
}

function fieldAnsweredByMessage(fieldId: string, userNorm: string): boolean {
  switch (fieldId) {
    case "file_format":
      return matchesFileFormat(userNorm);
    case "file_size_max":
      return matchesFileSize(userNorm);
    case "upload_method":
      return matchesUploadMethod(userNorm);
    case "upload_progress":
      return matchesProgress(userNorm);
    case "upload_retry":
      return matchesRetry(userNorm);
    case "upload_done_notify":
      return matchesNotify(userNorm);
    case "privacy_security_upload":
      return matchesPrivacy(userNorm);
    case "scope_goal":
      return /목적|범위|왜|무엇을|어디까지/.test(userNorm);
    case "primary_user_actions":
      return /사용자가|할\s*일|행동|버튼|누르|선택|입력/.test(userNorm);
    case "constraints_limits":
      return /제한|불가|예외|금지|최대|최소/.test(userNorm);
    case "progress_feedback":
      return matchesProgress(userNorm) || /안내|표시|피드백/.test(userNorm);
    case "failure_recovery":
      return matchesRetry(userNorm) || /오류|실패/.test(userNorm);
    case "completion_notify":
      return matchesNotify(userNorm);
    case "privacy_security":
      return matchesPrivacy(userNorm);
    default:
      return false;
  }
}

/**
 * 직전 사용자 한 턴 메시지로부터 답이 확실한 큐 항목 id 추론(프롬프트 보강·저장 병합).
 */
export function inferAnsweredPlannerFieldsFromUserMessage(
  userMessage: string,
  nextField: PlannerQueueFieldV1 | undefined,
  queue: readonly PlannerQueueFieldV1[],
  alreadyAnswered: readonly string[]
): string[] {
  const u = userMessage.replace(/\s+/g, " ").trim();
  if (!u) return [];
  const userNorm = u.toLowerCase();
  const done = new Set(alreadyAnswered.map((x) => x.trim()).filter(Boolean));
  const out: string[] = [];

  if (nextField && !done.has(nextField.id) && fieldAnsweredByMessage(nextField.id, userNorm)) {
    out.push(nextField.id);
  }
  for (const f of queue) {
    if (done.has(f.id) || out.includes(f.id)) continue;
    if (fieldAnsweredByMessage(f.id, userNorm)) out.push(f.id);
  }
  return dedupeIds(out, 16);
}

export function formatPlannerQueueForPrompt(input: {
  readonly stepTitle: string;
  readonly stepKey: string;
  readonly queue: readonly PlannerQueueFieldV1[];
  readonly answeredFieldIds: readonly string[];
  readonly nextField: PlannerQueueFieldV1 | undefined;
}): string {
  const done = new Set(input.answeredFieldIds.map((x) => x.trim()).filter(Boolean));
  const lines = input.queue.map((f) => {
    const mark = done.has(f.id) ? "[답함]" : f.id === input.nextField?.id ? "[이번에 질문할 항목]" : "[미답]";
    return `${f.id} ${mark} ${f.labelKo}`;
  });
  const nextLine = input.nextField
    ? `nextQuestionMustTargetFieldId: "${input.nextField.id}" (${input.nextField.labelKo}) — 질문은 이 항목만 다루고, 이미 [답함]인 항목은 다시 묻지 말 것.`
    : `nextQuestionMustTargetFieldId: (없음) — 이 단계 세부 항목은 충분히 다룸. 마무리·다음 단계 안내만 짧게.`;

  return [
    `[QUESTION_QUEUE / currentServiceStep]`,
    `stepTitle: "${input.stepTitle.slice(0, 120)}"`,
    `stepKey: ${input.stepKey}`,
    ...lines,
    nextLine,
  ].join("\n");
}
