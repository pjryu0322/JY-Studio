/** Pre-project 메신저: 플랫폼이 실행하지 않는 「다음에 하겠다」 예고 문구 제거 */

const FUTURE_PROMISE_PATTERNS: readonly RegExp[] = [
  /\n?다음에는\s*제가\s*비교안\/초안\/정리안을\s*만들겠습니다\.?/gi,
  /\n?프로젝트\s*승격\s*또는\s*초안\s*JSON\s*준비를\s*위한\s*다음\s*행동을\s*진행하겠습니다\.?/gi,
  /\n?다음에\s*비교안[·/\s]*초안[·/\s]*정리안을\s*만들겠습니다\.?/gi,
  /\n?다음에는\s*수집\s*가능성\s*점검\s*항목과\s*판단\s*기준을\s*정리하겠습니다\.?/gi,
  /\n?다음에\s*만들\s*정리안[·/\s]*비교안을\s*예고[^\n]*\.?/gi,
  /\n?다음에\s*AI가\s*할\s*정리[·/\s]*비교[·/\s]*초안을\s*예고[^\n]*\.?/gi,
];

export function sanitizeUnsupportedFuturePromise(text: string): string {
  let out = String(text ?? "");
  for (const re of FUTURE_PROMISE_PATTERNS) {
    out = out.replace(re, "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
