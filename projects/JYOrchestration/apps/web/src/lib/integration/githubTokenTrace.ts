import { createHash } from "node:crypto";

export const GITHUB_TOKEN_CACHE_LABEL = "unused";

/** 플랫폼 GitHub 토큰 출처: DB(Execution setup)만. ENV 토큰은 사용하지 않음. */
export type GithubTokenSource = "db" | "none";

let validationEpoch = 0;

const resolutionThrottle = new Map<string, number>();
const THROTTLE_MS = 30_000;

export function bumpGithubTokenValidationEpoch(reason: string): number {
  validationEpoch += 1;
  resolutionThrottle.clear();
  console.info(
    `[GitHub token] VALIDATION_EPOCH=${validationEpoch} CACHE_INVALIDATE=all_throttles_cleared reason=${reason}`
  );
  return validationEpoch;
}

export function getGithubTokenValidationEpoch(): number {
  return validationEpoch;
}

export function clearGithubTokenResolutionThrottle(): void {
  resolutionThrottle.clear();
}

export function githubTokenFingerprint(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 12);
}

export function githubTokenPrefixForLog(token: string): string {
  const t = String(token ?? "").trim();
  if (!t) return "(empty)";
  const n = Math.min(8, t.length);
  return `${t.slice(0, n)}${t.length > n ? "…" : ""}`;
}

export type GithubTokenResolutionLogInput = {
  operation: string;
  token: string | null;
  source: GithubTokenSource;
  validationEpoch?: number;
  throttleKey?: string;
};

export function logGithubTokenResolution(input: GithubTokenResolutionLogInput): void {
  const epoch = input.validationEpoch ?? getGithubTokenValidationEpoch();

  if (input.throttleKey && input.token) {
    const fp = githubTokenFingerprint(input.token);
    const k = `${input.throttleKey}:${fp}`;
    const now = Date.now();
    const prev = resolutionThrottle.get(k) ?? 0;
    if (now - prev < THROTTLE_MS) return;
    resolutionThrottle.set(k, now);
  }

  if (!input.token) {
    console.info(
      `[GitHub token] op=${input.operation} TOKEN_SOURCE=NONE TOKEN_CACHE=${GITHUB_TOKEN_CACHE_LABEL} ` +
        `DB_TOKEN=missing VALIDATION_EPOCH=${epoch}`
    );
    return;
  }

  const fp = githubTokenFingerprint(input.token);
  const prefix = githubTokenPrefixForLog(input.token);
  console.info(
    `[GitHub token] op=${input.operation} TOKEN_SOURCE=DB TOKEN_CACHE=${GITHUB_TOKEN_CACHE_LABEL} ` +
      `TOKEN_PREFIX=${prefix} TOKEN_HASH=${fp} VALIDATION_EPOCH=${epoch}`
  );
}

export function logGithubTokenBeforeFetch(operation: string, token: string, _source: GithubTokenSource): void {
  if (process.env.JY_ORCHESTRATION_GITHUB_TOKEN_PER_FETCH_LOG !== "1") return;
  console.info(
    `[GitHub token] pre_fetch op=${operation} TOKEN_SOURCE=DB ` +
      `TOKEN_PREFIX=${githubTokenPrefixForLog(token)} TOKEN_HASH=${githubTokenFingerprint(token)}`
  );
}
