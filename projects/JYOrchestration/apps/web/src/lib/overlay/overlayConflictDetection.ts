/**
 * Overlay: keyword-heuristic conflict detection.
 *
 * **WARNING ONLY.** 이 헬퍼는 실행을 차단하거나 라우팅을 변경하지 않는다. 단순한 키워드
 * 휴리스틱으로 충돌 가능성만 metadata로 노출한다.
 */

export type OverlayConflictWarningCategory =
  | "architecture"
  | "security"
  | "storage"
  | "authentication"
  | "policy";

export type OverlayConflictWarningSeverity = "info" | "warning";

export type OverlayConflictWarning = Readonly<{
  code: string;
  severity: OverlayConflictWarningSeverity;
  category: OverlayConflictWarningCategory;
  message: string;
}>;

const CONFLICT_CATEGORIES = new Set<OverlayConflictWarningCategory>([
  "architecture",
  "security",
  "storage",
  "authentication",
  "policy",
]);
const CONFLICT_SEVERITIES = new Set<OverlayConflictWarningSeverity>(["info", "warning"]);

/** detect 입력 timeline 메시지 수 상한(휴리스틱 비대화 방지). */
const OVERLAY_CONFLICT_DETECT_MAX_MESSAGES = 64;

/** 행당 conflict warning 최대 보존 개수(promptTrace replay 안정화). */
export const OVERLAY_CONFLICT_WARNINGS_MAX = 32;

const CODE_MAX_LEN = 80;
const MESSAGE_MAX_LEN = 500;

type Rule = Readonly<{
  code: string;
  severity: OverlayConflictWarningSeverity;
  category: OverlayConflictWarningCategory;
  message: string;
  needA: readonly RegExp[];
  needB: readonly RegExp[];
}>;

const RULES: readonly Rule[] = [
  {
    code: "OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT",
    severity: "warning",
    category: "storage",
    message: "localStorage 저장 vs JWT 무상태 인증이 동시에 언급되었습니다(저장·보안 정책 충돌 가능).",
    needA: [/localStorage/i, /로컬\s*스토리지/i],
    needB: [/jwt/i],
  },
  {
    code: "OVERLAY_CONFLICT_SESSION_VS_STATELESS_AUTH",
    severity: "warning",
    category: "authentication",
    message: "세션 기반 인증 vs 무상태(stateless) 인증이 동시에 언급되었습니다.",
    needA: [/세션\s*기반/i, /session\s*auth/i, /cookie\s*session/i],
    needB: [/stateless/i, /무상태/i, /jwt/i],
  },
  {
    code: "OVERLAY_CONFLICT_MONOLITH_VS_MICROSERVICE",
    severity: "info",
    category: "architecture",
    message: "모놀리식 vs 마이크로서비스 구조가 동시에 언급되었습니다(아키텍처 방향 정합성 확인 권장).",
    needA: [/monolith/i, /모놀리식/i, /단일\s*서비스/i],
    needB: [/microservice/i, /마이크로서비스/i],
  },
];

function anyMatch(text: string, patterns: readonly RegExp[]): boolean {
  for (const p of patterns) {
    if (p.test(text)) return true;
  }
  return false;
}

export function detectOverlayConflicts(input: {
  timelineMessages: readonly string[];
}): readonly OverlayConflictWarning[] {
  if (!Array.isArray(input.timelineMessages) || input.timelineMessages.length === 0) return [];
  const joined = input.timelineMessages
    .slice(0, OVERLAY_CONFLICT_DETECT_MAX_MESSAGES)
    .map((m) => (typeof m === "string" ? m : ""))
    .join("\n");
  const out: OverlayConflictWarning[] = [];
  for (const rule of RULES) {
    if (anyMatch(joined, rule.needA) && anyMatch(joined, rule.needB)) {
      out.push({
        code: rule.code,
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
      });
    }
  }
  return out.slice(0, OVERLAY_CONFLICT_WARNINGS_MAX);
}

export function parseOverlayConflictWarningsFromUnknown(
  raw: unknown
): readonly OverlayConflictWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlayConflictWarning[] = [];
  for (const item of raw) {
    if (out.length >= OVERLAY_CONFLICT_WARNINGS_MAX) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const code = String(r.code ?? "").trim().slice(0, CODE_MAX_LEN);
    const message = String(r.message ?? "").trim().slice(0, MESSAGE_MAX_LEN);
    const severity = String(r.severity ?? "").trim() as OverlayConflictWarningSeverity;
    const category = String(r.category ?? "").trim() as OverlayConflictWarningCategory;
    if (!code || !message) continue;
    if (!CONFLICT_SEVERITIES.has(severity)) continue;
    if (!CONFLICT_CATEGORIES.has(category)) continue;
    out.push({ code, severity, category, message });
  }
  return out;
}

export type OverlayConflictSummaryWire = Readonly<{
  warningCount: number;
  infoCount: number;
  byCategory: Readonly<Record<OverlayConflictWarningCategory, number>>;
}>;

export function summarizeOverlayConflictWarnings(
  warnings: readonly OverlayConflictWarning[]
): OverlayConflictSummaryWire {
  const byCategory: Record<OverlayConflictWarningCategory, number> = {
    architecture: 0,
    security: 0,
    storage: 0,
    authentication: 0,
    policy: 0,
  };
  let warningCount = 0;
  let infoCount = 0;
  for (const w of warnings) {
    if (w.severity === "warning") warningCount++;
    else if (w.severity === "info") infoCount++;
    if (byCategory[w.category] !== undefined) byCategory[w.category]++;
  }
  return { warningCount, infoCount, byCategory };
}
