import type { MentionRoutingResult } from "@/lib/service-design/serviceDesignMentionRouter";
import type { ValidationResult } from "@/lib/service-design/serviceDesignStepValidator";
import type { Intent } from "@/lib/service-design/serviceDesignIntentRouter";

export type HarnessResponsePolicy = {
  responderLabel: string;
  advisorLabels: string[];
  finalAuthorityLabel: string;
  responseMode: "DIRECT" | "ADVISORY_SUMMARY" | "STAGE_CONTROLLED" | "BLOCKED";
  responseContract: string;
};

const LABELS: Record<string, string> = {
  planner: "AI 기획자",
  analyst: "AI 분석가",
  feature_designer: "AI 기능설계자",
  designer: "AI 디자이너",
  security_reviewer: "AI 보안관",
  scm_manager: "AI 형상관리자",
};

export function labelAi(id: string): string {
  return LABELS[id] ?? id;
}

export function buildHarnessResponsePolicy(input: {
  intent: Intent;
  routing: MentionRoutingResult;
  validation: ValidationResult;
}): HarnessResponsePolicy {
  const responderLabel = labelAi(input.routing.visibleResponder);
  const advisorLabels = input.routing.internalAdvisors.map(labelAi);
  const finalAuthorityLabel = labelAi(input.routing.finalAuthority);

  const blocked = input.validation === "FORWARD_BLOCK";
  const advisory = advisorLabels.length > 0;

  const responseMode = blocked
    ? "BLOCKED"
    : advisory
      ? "ADVISORY_SUMMARY"
      : input.routing.visibleResponder !== input.routing.finalAuthority
        ? "STAGE_CONTROLLED"
        : "DIRECT";

  const advisorLine = advisorLabels.length
    ? `내부 자문 관점: ${advisorLabels.join(", ")}`
    : "내부 자문 관점: 없음";

  const responseContract = `
[하네스 응답 계약]
- 화면상 응답자는 반드시 "${responderLabel}"이다.
- ${advisorLine}
- 최종 판단 기준은 반드시 "${finalAuthorityLabel}"이다.
- 사용자가 멘션한 AI가 현재 단계 Primary가 아니더라도, 최종 결론은 현재 단계 Primary 기준을 벗어나면 안 된다.
- 내부 자문 AI가 있는 경우, 응답 안에 자문 관점을 짧게 반영하되 자문 AI가 직접 답변하는 것처럼 쓰지 않는다.
- 현재 단계 밖 실행 요청은 수행하지 말고, 현재 단계에서 가능한 작업으로 재유도한다.
- 답변은 한국어로 한다.
- 답변은 1~4문장으로 제한한다.
`.trim();

  return {
    responderLabel,
    advisorLabels,
    finalAuthorityLabel,
    responseMode,
    responseContract,
  };
}

export type HarnessForTurnDefaults = {
  readonly intent: Intent;
  readonly validation: ValidationResult;
  readonly routing: MentionRoutingResult;
  readonly responsePolicy: HarnessResponsePolicy;
};

/** LLM이 생략한 하네스 필드를 정책 기반으로 채움(하위 호환). */
export function applyHarnessDefaultsToTurnModel(
  root: Record<string, unknown>,
  harness: HarnessForTurnDefaults
): {
  responderLabel: string;
  advisorSummary: string;
  finalAuthoritySummary: string;
  harnessPayload: {
    intent: Intent;
    validation: ValidationResult;
    responseMode: HarnessResponsePolicy["responseMode"];
    visibleResponder: string;
    finalAuthority: string;
    advisors: string[];
  };
} {
  const p = harness.responsePolicy;
  const rawResponder = String(root.responderLabel ?? "").trim();
  const responderLabel = rawResponder || p.responderLabel;

  const rawAdvisorSummary = String(root.advisorSummary ?? "").trim();
  const advisorSummary =
    rawAdvisorSummary ||
    (p.advisorLabels.length > 0 ? `${p.advisorLabels.join(", ")} 관점을 반영합니다.` : "내부 자문 없음.");

  const rawFa = String(root.finalAuthoritySummary ?? "").trim();
  const finalAuthoritySummary = rawFa || `${p.finalAuthorityLabel} 기준으로 최종 판단합니다.`;

  const harnessPayload = {
    intent: harness.intent,
    validation: harness.validation,
    responseMode: p.responseMode,
    visibleResponder: harness.routing.visibleResponder,
    finalAuthority: harness.routing.finalAuthority,
    advisors: harness.routing.internalAdvisors,
  };

  return { responderLabel, advisorSummary, finalAuthoritySummary, harnessPayload };
}
