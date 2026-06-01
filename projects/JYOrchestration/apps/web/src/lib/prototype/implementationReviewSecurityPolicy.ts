import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

export type ImplementationReviewRisk = "low" | "medium" | "high";
export type ImplementationSecurityRisk = "none" | "low" | "medium" | "high";
export type ImplementationReviewPolicy = "skip" | "lightweight" | "ai_required";
export type ImplementationSecurityPolicy = "skip" | "lightweight" | "ai_required";

export type CodeTaskReviewSecurityPolicyResult = Readonly<{
  readonly reviewRisk: ImplementationReviewRisk;
  readonly securityRisk: ImplementationSecurityRisk;
  readonly reviewPolicy: ImplementationReviewPolicy;
  readonly securityPolicy: ImplementationSecurityPolicy;
  readonly riskReasons: readonly string[];
}>;

const SECURITY_PATH_PATTERNS: readonly RegExp[] = [
  /(?:^|\/)api\/auth\b/i,
  /\bauth\b/i,
  /\bpermission/i,
  /\btoken/i,
  /\bsecret/i,
  /\bcredential/i,
  /\bprisma\b/i,
  /\bdb\b/i,
  /database/i,
  /upload/i,
  /download/i,
  /\badmin\b/i,
  /personal/i,
  /privacy/i,
  /\boauth\b/i,
  /session/i,
];

const REVIEW_PATH_PATTERNS: readonly RegExp[] = [
  /\broute/i,
  /\brouter\b/i,
  /state/i,
  /redux|zustand|context/i,
  /config/i,
  /\.env/i,
  /build/i,
  /webpack|vite/i,
];

function normalizePaths(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly workItem?: CursorWorkItem | null;
}): readonly string[] {
  const paths = [
    ...(input.codeTask.candidateFiles ?? []),
    ...(input.codeTask.candidateFileHints ?? []),
    ...(input.workItem?.candidateFiles ?? []),
    ...(input.workItem?.targetHints ?? []),
    ...input.codeTask.targetHints,
  ];
  return paths.map((p) => String(p ?? "").trim()).filter(Boolean);
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function collectPathSignals(paths: readonly string[]): Readonly<{
  readonly securityHits: readonly string[];
  readonly reviewHits: readonly string[];
}> {
  const securityHits: string[] = [];
  const reviewHits: string[] = [];
  for (const path of paths) {
    if (matchesAny(path, SECURITY_PATH_PATTERNS)) securityHits.push(path);
    if (matchesAny(path, REVIEW_PATH_PATTERNS)) reviewHits.push(path);
  }
  return { securityHits, reviewHits };
}

function textBlob(codeTask: ImplementationCodeTaskV1): string {
  return [codeTask.title, codeTask.description, ...(codeTask.acceptanceCriteria ?? [])]
    .join(" ")
    .toLowerCase();
}

function isSimpleUiTask(codeTask: ImplementationCodeTaskV1, paths: readonly string[]): boolean {
  if (codeTask.changeType === "style") return true;
  const blob = textBlob(codeTask);
  if (/\bmock\b/i.test(blob) || /문구|레이아웃|아이콘|스타일/.test(blob)) return true;
  if (codeTask.changeType === "component" && paths.length > 0) {
    return paths.every((p) => /components?\//i.test(p) || /\.module\.css$/i.test(p));
  }
  return false;
}

function isAuthSecuritySensitive(codeTask: ImplementationCodeTaskV1, paths: readonly string[]): boolean {
  const blob = textBlob(codeTask);
  if (/\bauth\b|인증|권한|토큰|api key|개인정보|관리자/.test(blob)) return true;
  return paths.some((p) => matchesAny(p, SECURITY_PATH_PATTERNS));
}

function isReviewSensitive(codeTask: ImplementationCodeTaskV1, paths: readonly string[]): boolean {
  const changeType = codeTask.changeType;
  if (changeType === "api" || changeType === "data" || changeType === "integration" || changeType === "config") {
    return true;
  }
  if (changeType === "state") return true;
  const blob = textBlob(codeTask);
  if (/라우팅|상태관리|데이터 흐름|공통 컴포넌트|빌드|설정/.test(blob)) return true;
  return paths.some((p) => matchesAny(p, REVIEW_PATH_PATTERNS));
}

export function evaluateCodeTaskReviewSecurityPolicy(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly workItem?: CursorWorkItem | null;
}): CodeTaskReviewSecurityPolicyResult {
  const paths = normalizePaths(input);
  const { securityHits, reviewHits } = collectPathSignals(paths);
  const reasons: string[] = [];
  const simpleUi = isSimpleUiTask(input.codeTask, paths);
  const authSensitive = isAuthSecuritySensitive(input.codeTask, paths);
  const reviewSensitive = isReviewSensitive(input.codeTask, paths);

  let securityRisk: ImplementationSecurityRisk = "none";
  let reviewRisk: ImplementationReviewRisk = "low";

  if (authSensitive || securityHits.length > 0) {
    securityRisk = "high";
    if (authSensitive) reasons.push("auth/permission/token");
    if (securityHits.length) reasons.push(`paths:${securityHits.slice(0, 3).join(",")}`);
  } else if (input.codeTask.changeType === "api" || input.codeTask.changeType === "data") {
    securityRisk = "medium";
    reasons.push("api/data change");
  }

  if (reviewSensitive || reviewHits.length > 0) {
    reviewRisk = securityRisk === "high" ? "high" : "medium";
    if (reviewHits.length) reasons.push(`review_paths:${reviewHits.slice(0, 3).join(",")}`);
    if (input.codeTask.changeType !== "unknown") reasons.push(`changeType:${input.codeTask.changeType}`);
  }

  if (simpleUi && !authSensitive) {
    reviewRisk = "low";
    securityRisk = securityRisk === "high" ? securityRisk : "none";
    reasons.push("simple_ui");
  }

  let reviewPolicy: ImplementationReviewPolicy = "lightweight";
  let securityPolicy: ImplementationSecurityPolicy = "lightweight";

  if (simpleUi && reviewRisk === "low" && securityRisk === "none") {
    reviewPolicy = "skip";
    securityPolicy = "skip";
  } else if (reviewRisk === "high" || input.codeTask.changeType === "api" || input.codeTask.changeType === "data") {
    reviewPolicy = "ai_required";
  } else if (reviewRisk === "low") {
    reviewPolicy = "skip";
  }

  if (securityRisk === "high" || authSensitive) {
    securityPolicy = "ai_required";
  } else if (securityRisk === "none" && simpleUi) {
    securityPolicy = "skip";
  } else if (securityRisk === "medium") {
    securityPolicy = "lightweight";
  }

  if (
    paths.some((p) => /app\/api\//i.test(p) || /\bprisma\b/i.test(p)) &&
    (reviewPolicy === "skip" || securityPolicy === "skip")
  ) {
    reviewPolicy = "ai_required";
    securityPolicy = securityPolicy === "skip" ? "lightweight" : securityPolicy;
    if (securityRisk !== "high") securityPolicy = "ai_required";
    reasons.push("api_db_paths");
  }

  return {
    reviewRisk,
    securityRisk,
    reviewPolicy,
    securityPolicy,
    riskReasons: [...new Set(reasons)],
  };
}
