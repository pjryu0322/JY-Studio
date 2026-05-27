import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  cursorCredentialLooksStored,
  githubCredentialLooksStored,
} from "@/components/project-spec/credentialUiMask";

export type PrototypeEnvReadinessTone = "ok" | "fail" | "warn" | "neutral";

export type PrototypeEnvReadinessRow = Readonly<{
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly tone: PrototypeEnvReadinessTone;
}>;

export function prototypeEnvReadinessToneColors(tone: PrototypeEnvReadinessTone): Readonly<{
  readonly color: string;
  readonly bg: string;
}> {
  if (tone === "ok") return { color: "#15803d", bg: "#f0fdf4" };
  if (tone === "fail") return { color: "#b91c1c", bg: "#fef2f2" };
  if (tone === "warn") return { color: "#b45309", bg: "#fffbeb" };
  return { color: "#475569", bg: "#f8fafc" };
}

/** Code Agent 연결 상태 — 환경설정 Code Agent 카드 내부 전용. */
export function buildPrototypeEnvCodeAgentStatusRow(
  executionSetup: ExecutionSetupDto | null,
): PrototypeEnvReadinessRow {
  const cursorStored = cursorCredentialLooksStored(executionSetup);
  const cursorApiOk = executionSetup?.cursorApiConnectionOk ?? null;

  if (cursorApiOk === true) {
    return { key: "codeAgent", label: "연결 상태", value: "정상", tone: "ok" };
  }
  if (cursorStored) {
    return { key: "codeAgent", label: "연결 상태", value: "키 저장됨 · 검증 필요", tone: "warn" };
  }
  return { key: "codeAgent", label: "연결 상태", value: "미설정", tone: "neutral" };
}

export function isGithubTokenCredentialsError(
  cap: ExecutionSetupDto["githubCapabilityValidation"] | null | undefined,
): boolean {
  if (!cap || cap.githubOperableOk !== false) return false;
  const msg = String(cap.lastErrorMessage ?? "");
  return cap.lastHttpStatus === 401 || /bad credentials/i.test(msg);
}

/** 연결 테스트 비활성 시 사용자에게 보여줄 사유 (prototype MVP UI). */
export function resolvePrototypeEnvTestDisabledTitle(input: {
  readonly isPrototypeMvpUi: boolean;
  readonly executionSetup: ExecutionSetupDto | null;
  readonly executionReady: boolean;
  readonly baseBranchConfigured: boolean;
  readonly autoPushOn: boolean;
}): string | undefined {
  if (!input.isPrototypeMvpUi) return undefined;
  const es = input.executionSetup;
  if (!es) return "먼저 저장을 눌러 실행 환경 설정을 생성하세요";
  if (!String(es.gitRepoUrl ?? "").trim()) return "저장소 URL이 필요합니다";
  if (!String(es.gitRepoName ?? "").trim()) return "owner/repo가 필요합니다";
  if (!githubCredentialLooksStored(es)) return "GitHub 토큰을 먼저 저장하세요";
  if (!cursorCredentialLooksStored(es)) return "Cursor API 키를 먼저 저장하세요";
  if (!input.executionReady) return "저장소·GitHub·Cursor 검증을 통과해야 합니다";
  if (!input.baseBranchConfigured) return "기본 브랜치가 필요합니다";
  if (!input.autoPushOn) return "자동화를 「자동 PR 생성까지」 이상으로 설정하세요";
  return undefined;
}
