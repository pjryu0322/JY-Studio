import { hasProposalFirstStructure } from "@/lib/requirements/requirementsBootstrapInterviewQuality";

/** `RequirementsMessage.meta.internalType` — 아이디어 구체화 자동 인터뷰 시작 메시지 식별용 */
export const IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE = "ideation-interview-bootstrap" as const;

/** 문제정의 인터뷰 턴(핵심 이해 + 질문) AI 메시지 식별 — `problemInterview` JSON 유실 시에도 파이프라인 유지용 */
export const IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE = "ideation-problem-interview-turn" as const;

/** 인터뷰 완료 안내 AI 메시지 식별 */
export const IDEATION_PROBLEM_INTERVIEW_COMPLETE_INTERNAL_TYPE = "ideation-problem-interview-complete" as const;

/** proposal-first bootstrap 본문 — 줄바꿈·목록 구조 유지(질문 한 문장 추출 금지) */
export function preserveIdeationBootstrapProposalMessage(raw: string): string {
  let t = String(raw ?? "").trim();
  if (!t) return "";
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^["'`“”]+|["'`“”]+$/g, "");
  return t.trim();
}

/**
 * bootstrap 첫 AI 메시지 — proposal-first면 전체 본문, legacy question-only면 한 문장 질문으로 축약.
 */
export function normalizeIdeationBootstrapDisplayMessage(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "지금 이 서비스가 가장 먼저 풀어야 할 사용자의 문제는 무엇인가요?";
  if (hasProposalFirstStructure(t)) return preserveIdeationBootstrapProposalMessage(t);
  return sanitizeIdeationInterviewFirstQuestion(t);
}

/**
 * 모델이 설명문을 섞어도 UI/저장은 질문 한 덩어리만 쓰도록 정리합니다.
 * - 첫 `?`까지 한 문장만 사용
 * - 물음표 없으면 문장 끝에 `?` 추가(최대 길이 제한)
 * @deprecated proposal-first bootstrap에는 `normalizeIdeationBootstrapDisplayMessage` 사용
 */
export function sanitizeIdeationInterviewFirstQuestion(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (trimmed && hasProposalFirstStructure(trimmed)) {
    return preserveIdeationBootstrapProposalMessage(trimmed);
  }
  let t = trimmed;
  if (!t) return "지금 이 서비스가 가장 먼저 풀어야 할 사용자의 문제는 무엇인가요?";
  t = t.replace(/^["'`“”]+|["'`“”]+$/g, "");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^\s*\d+[\.)]\s+/, "").trim();
  /** 번호·불릿으로 이어지는 여러 질문이 한 응답에 오면 첫 질문만 사용 */
  t = t.replace(/\n\s*(?:\d+[\.)]|[-*•]|[①-⑨])\s+[\s\S]*$/, "").trim();
  const qGlobal = (t.match(/\?/g) ?? []).length;
  if (qGlobal > 1) {
    const first = t.indexOf("?");
    t = t.slice(0, first + 1).trim();
  }
  const lines = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    const q = line.indexOf("?");
    if (q >= 0) {
      const one = line.slice(0, q + 1).trim();
      return one.length > 240 ? `${one.slice(0, 237)}…?` : one;
    }
  }
  const first = lines[0] ?? t;
  const clipped = first.length > 220 ? `${first.slice(0, 217)}…` : first;
  return clipped.endsWith("?") ? clipped : `${clipped}?`;
}
