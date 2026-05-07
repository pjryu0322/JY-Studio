/** 클라이언트에서 호출하는 요구사항·아이디어 단계 API 경로 (중복 문자열 방지) */
export const REQUIREMENTS_IDEATION_HTTP = {
  AI_CONNECTION: "/api/requirements/ai-connection",
  AI_FACILITATOR: "/api/requirements/ai-facilitator",
  INTERVIEW_ANALYZE: "/api/requirements/interview-analyze",
  INTERVIEW_BOOTSTRAP_SUGGESTIONS: "/api/requirements/interview-bootstrap-suggestions",
  DELIVERABLES_GENERATE: "/api/requirements/deliverables-generate",
} as const;

export function requirementsAiConnectionUrl(projectId?: string | null): string {
  const pid = String(projectId ?? "").trim();
  return pid
    ? `${REQUIREMENTS_IDEATION_HTTP.AI_CONNECTION}?projectId=${encodeURIComponent(pid)}`
    : REQUIREMENTS_IDEATION_HTTP.AI_CONNECTION;
}
