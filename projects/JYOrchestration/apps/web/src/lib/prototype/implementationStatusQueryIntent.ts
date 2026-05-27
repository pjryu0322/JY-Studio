export type ImplementationStatusQueryIntent =
  | "scm_check_details"
  | "environment_check_details"
  | "role_check_details"
  | "reviewer_check_details"
  | "security_check_details"
  | "none";

const QUERY_MARKERS =
  /보여|알려|결과|상태|점검|확인|왜|어떻게|무엇|뭐|상세|이슈|문제|필요|정상인데|정상으로|다\s*정상/i;

function normalizeStatusQueryText(text: string): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function hasQueryMarker(text: string): boolean {
  return QUERY_MARKERS.test(text);
}

/**
 * 구현단계에서 SCM/환경/역할별 점검 상태 조회를 LLM 없이 처리하기 위한 intent 감지.
 * 일반 구현 요구사항(기능·정책 추가)은 `none`을 반환해야 한다.
 */
export function detectImplementationStatusQueryIntent(text: string): ImplementationStatusQueryIntent {
  const raw = String(text ?? "").trim();
  if (!raw) return "none";

  const n = normalizeStatusQueryText(raw);
  const q = hasQueryMarker(raw);

  if (
    /역할별점검|전체점검결과|점검상세|ai검수자.*ai보안관|ai검수자.*scm|검수자.*보안관.*scm/i.test(
      n,
    ) ||
    (n.includes("역할별") && n.includes("점검") && q)
  ) {
    return "role_check_details";
  }

  if (
    /ai검수자|검수기준|검수자상세|품질점검결과|품질점검/i.test(n) &&
    (q || n.includes("검수기준") || n.includes("검수자점검"))
  ) {
    return "reviewer_check_details";
  }

  if (
    /ai보안관|보안기준|보안관상세|보안점검결과|보안점검/i.test(n) &&
    (q || n.includes("보안기준") || n.includes("보안관"))
  ) {
    return "security_check_details";
  }

  if (
    /scm점검|scm결과|scm상세|scm이슈|scm환경|소스관리점검|git점검|github점검|github인증|코드에이전트연결|cursor연결|연결테스트결과/i.test(
      n,
    ) ||
    (n.includes("scm") && q)
  ) {
    return "scm_check_details";
  }

  if (
    /환경설정|환경점검|환경검증|환경상태|연결테스트|환경이슈|환경문제|환경왜|환경필요/i.test(n) &&
    (q || /정상인데|정상으로|왜필요|다정상|미완료/.test(n))
  ) {
    return "environment_check_details";
  }

  if (/git저장소|github인증상태|코드에이전트|cursor연결/.test(n) && q) {
    return "scm_check_details";
  }

  return "none";
}
