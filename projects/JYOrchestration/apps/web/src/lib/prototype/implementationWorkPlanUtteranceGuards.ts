/** Rule/alias classifier — 작업안 관련 질문·설명형 vs 명확한 실행형 구분 */

const WORK_PLAN_TOPIC = /구현\s*작업\s*안|작업\s*안|작업\s*계획|작업계획/i;

const WORK_PLAN_QUESTION_OR_EXPLAIN =
  /(설명|알려\s*줘|어떻게|방법|기준|가능한지|가능\s*해|가능\s*한지|뭐가\s*필요|필요한가|필요\s*해|비교|추천|의견|방향|전략|전에는|전에|먼저|나중에|보류|검토|확인)/i;

function compactWorkPlanText(text: string): string {
  return String(text ?? "")
    .trim()
    .replace(/\s/g, "");
}

/** `구현 작업안 생성해줘` 등 짧은 실행 요청 (질문·설명 수식어 없음) */
export function matchesExplicitWorkPlanExecutePattern(text: string): boolean {
  return /^(구현)?작업(안)?(초안)?(계획)?(생성|만들|수립)(해줘|해주|요)?$/i.test(compactWorkPlanText(text));
}

/** 질문·설명·조건 확인형 — rule/alias에서 CREATE_WORK_PLAN 실행으로 보내지 않음 */
export function isQuestionLikeWorkPlanUtterance(text: string): boolean {
  const raw = String(text ?? "").trim();
  if (!raw) return false;
  if (matchesExplicitWorkPlanExecutePattern(raw)) return false;
  if (WORK_PLAN_QUESTION_OR_EXPLAIN.test(raw)) return true;
  if (/\?\s*$/.test(raw) && WORK_PLAN_TOPIC.test(raw)) return true;
  return false;
}

export function isExplicitWorkPlanExecuteUtterance(text: string): boolean {
  const raw = String(text ?? "").trim();
  if (!raw || isQuestionLikeWorkPlanUtterance(raw)) return false;
  return matchesExplicitWorkPlanExecutePattern(raw);
}
