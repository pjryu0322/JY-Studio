import { createHash } from "node:crypto";

/** 플랫폼에 메모리 토큰 캐시 없음 — 로그에 명시용 */
export const GITHUB_TOKEN_CACHE_LABEL = "unused";

export type GithubTokenSource = "db" | "env" | "none";

let validationEpoch = 0;

const resolutionThrottle = new Map<string, number>();
const THROTTLE_MS = 30_000;

/** 「다시 검증」 등에서 스로틀 초기화 + 에포크 증가 */
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

export function githubTokenFingerprint(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 12);
}

/** 로그용: 앞 8자 + 말줄임(평문 전체는 기록하지 않음) */
export function githubTokenPrefixForLog(token: string): string {
  const t = String(token ?? "").trim();
  if (!t) return "(empty)";
  const n = Math.min(8, t.length);
  return `${t.slice(0, n)}${t.length > n ? "…" : ""}`;
}

export function githubProcessEnvTokenInfo(): {
  githubTokenSet: boolean;
  ghTokenSet: boolean;
  /** GITHUB_TOKEN 우선, 없으면 GH_TOKEN */
  combined: string | null;
} {
  const g1 = process.env.GITHUB_TOKEN?.trim() || "";
  const g2 = process.env.GH_TOKEN?.trim() || "";
  const combined = g1 || g2 || "";
  return {
    githubTokenSet: Boolean(g1),
    ghTokenSet: Boolean(g2),
    combined: combined || null,
  };
}

export type GithubTokenResolutionLogInput = {
  operation: string;
  token: string | null;
  source: GithubTokenSource;
  validationEpoch?: number;
  /** 동일 해시·작업 반복 호출 시 30초에 한 줄만 */
  throttleKey?: string;
};

export function logGithubTokenResolution(input: GithubTokenResolutionLogInput): void {
  const envInfo = githubProcessEnvTokenInfo();
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
        `VALIDATION_EPOCH=${epoch} ENV_GITHUB_TOKEN=${envInfo.githubTokenSet ? "set" : "empty"} ` +
        `ENV_GH_TOKEN=${envInfo.ghTokenSet ? "set" : "empty"}`
    );
    if (envInfo.combined) {
      console.warn(
        `[GitHub token] WARN: 프로세스에 GITHUB_TOKEN/GH_TOKEN이 설정되어 있으나 이 호출에는 사용할 DB/선호 토큰이 없습니다. ` +
          `ENV_TOKEN_PREFIX=${githubTokenPrefixForLog(envInfo.combined)} ENV_TOKEN_HASH=${githubTokenFingerprint(envInfo.combined)} ` +
          `— 검증 API는 DB 저장 토큰만 사용합니다. 실행 루프는 DB가 비면 ENV로 폴백할 수 있어 토큰이 어긋날 수 있습니다.`
      );
    }
    return;
  }

  const fp = githubTokenFingerprint(input.token);
  const prefix = githubTokenPrefixForLog(input.token);
  console.info(
    `[GitHub token] op=${input.operation} TOKEN_SOURCE=${input.source.toUpperCase()} TOKEN_CACHE=${GITHUB_TOKEN_CACHE_LABEL} ` +
      `TOKEN_PREFIX=${prefix} TOKEN_HASH=${fp} VALIDATION_EPOCH=${epoch} ` +
      `ENV_GITHUB_TOKEN=${envInfo.githubTokenSet ? "set" : "empty"} ENV_GH_TOKEN=${envInfo.ghTokenSet ? "set" : "empty"}`
  );

  if (envInfo.combined && input.source === "db") {
    const envFp = githubTokenFingerprint(envInfo.combined);
    if (envFp !== fp) {
      console.warn(
        `[GitHub token] WARN: 서버 환경 변수 토큰(해시 ${envFp})과 DB 토큰(해시 ${fp})이 다릅니다. ` +
          `이 요청은 TOKEN_SOURCE=DB 입니다. PR/머지 등 다른 코드 경로가 ENV 폴백을 쓰면 권한 헤더가 metadata=read로만 보일 수 있습니다.`
      );
    } else {
      console.warn(
        `[GitHub token] WARN: ENV 토큰과 DB 토큰 해시가 동일합니다. 중복 설정은 제거하는 것을 권장합니다.`
      );
    }
  }

  if (input.source === "env") {
    console.warn(
      `[GitHub token] WARN: TOKEN_SOURCE=ENV — 실행 환경(Execution setup)에 저장된 GitHub 토큰이 없어 GITHUB_TOKEN/GH_TOKEN을 사용합니다. ` +
        `DB에 저장한 PAT와 다른 권한일 수 있습니다. 운영에서는 JY_ORCHESTRATION_GITHUB_DISABLE_ENV_TOKEN=1 로 ENV 폴백을 끌 수 있습니다.`
    );
  }
}

/** fetch 직전 상세 로그(옵션) */
export function logGithubTokenBeforeFetch(operation: string, token: string, source: GithubTokenSource): void {
  if (process.env.JY_ORCHESTRATION_GITHUB_TOKEN_PER_FETCH_LOG !== "1") return;
  console.info(
    `[GitHub token] pre_fetch op=${operation} TOKEN_SOURCE=${source.toUpperCase()} ` +
      `TOKEN_PREFIX=${githubTokenPrefixForLog(token)} TOKEN_HASH=${githubTokenFingerprint(token)}`
  );
}
