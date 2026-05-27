import type { ExecutionSetupDto } from "@/components/project-spec/api";
import type { EnvironmentTestLastDto } from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";
import {
  cursorCredentialLooksStored,
  githubCredentialLooksStored,
  secretMaskedDisplay,
} from "@/components/project-spec/credentialUiMask";
import { isGithubTokenCredentialsError } from "@/lib/project/prototypeEnvSettingsReadiness";
import type { PrototypeEnvReadinessTone } from "@/lib/project/prototypeEnvSettingsReadiness";

export type PrototypeEnvModalRowKey = "repo" | "token" | "cursor" | "connectionTest";

export type PrototypeEnvModalTableRow = Readonly<{
  readonly key: PrototypeEnvModalRowKey;
  readonly label: string;
  readonly status: string;
  readonly statusTone: PrototypeEnvReadinessTone;
  readonly currentValue: string;
  readonly actionLabel: string;
}>;

function summarizeConnectionTestValue(input: {
  readonly connectionTestSatisfied: boolean;
  readonly busyEnvTest: boolean;
  readonly envTestLast: EnvironmentTestLastDto | null;
}): { readonly status: string; readonly tone: PrototypeEnvReadinessTone; readonly value: string } {
  if (input.busyEnvTest) {
    return { status: "실행 중", tone: "warn", value: "진행 중…" };
  }
  if (input.connectionTestSatisfied) {
    return { status: "완료", tone: "ok", value: "완료" };
  }
  const last = input.envTestLast;
  const wf = String(last?.workflowStatus ?? "").trim().toLowerCase();
  if (wf === "failed" || wf === "verify_failed" || String(last?.envTestStage1FailureLine ?? "").trim()) {
    const line = String(last?.envTestStage1FailureLine ?? "실패").trim();
    return { status: "실패", tone: "fail", value: line.slice(0, 80) || "실패" };
  }
  return { status: "미완료", tone: "warn", value: "—" };
}

export function buildPrototypeEnvModalTableRows(input: {
  readonly executionSetup: ExecutionSetupDto | null;
  readonly connectionTestSatisfied: boolean;
  readonly busyEnvTest: boolean;
  readonly envTestLast: EnvironmentTestLastDto | null;
}): readonly PrototypeEnvModalTableRow[] {
  const es = input.executionSetup;
  const repoName = String(es?.gitRepoName ?? "").trim();
  const repoOk = es?.repoConnectionOk ?? null;

  let repoStatus = "미설정";
  let repoTone: PrototypeEnvReadinessTone = "neutral";
  if (!repoName) {
    repoStatus = "미설정";
    repoTone = "neutral";
  } else if (repoOk === true) {
    repoStatus = "정상";
    repoTone = "ok";
  } else if (repoOk === false) {
    repoStatus = "실패";
    repoTone = "fail";
  } else {
    repoStatus = "검증 필요";
    repoTone = "warn";
  }

  const githubCap = es?.githubCapabilityValidation ?? null;
  const githubAuthOk = es?.githubAuthConnectionOk ?? null;
  const githubEffectiveOk =
    githubAuthOk === true && githubCap != null && githubCap.githubOperableOk === true;
  const hasGithubToken = githubCredentialLooksStored(es);
  const tokenMasked = secretMaskedDisplay(es?.githubAccessTokenMasked ?? null, null, hasGithubToken);

  let tokenStatus = "미설정";
  let tokenTone: PrototypeEnvReadinessTone = "neutral";
  if (githubEffectiveOk) {
    tokenStatus = "정상";
    tokenTone = "ok";
  } else if (isGithubTokenCredentialsError(githubCap)) {
    tokenStatus = "오류";
    tokenTone = "fail";
  } else if (githubCap != null && githubCap.githubOperableOk === false) {
    tokenStatus = "실패";
    tokenTone = "fail";
  } else if (hasGithubToken) {
    tokenStatus = "검증 필요";
    tokenTone = "warn";
  }

  const cursorStored = cursorCredentialLooksStored(es);
  const cursorApiOk = es?.cursorApiConnectionOk ?? null;
  const cursorMasked = secretMaskedDisplay(es?.cursorApiTokenMasked ?? null, null, cursorStored);

  let cursorStatus = "미설정";
  let cursorTone: PrototypeEnvReadinessTone = "neutral";
  if (cursorApiOk === true) {
    cursorStatus = "정상";
    cursorTone = "ok";
  } else if (cursorStored) {
    cursorStatus = "검증 필요";
    cursorTone = "warn";
  }

  const conn = summarizeConnectionTestValue(input);

  return [
    {
      key: "repo",
      label: "GitHub 저장소",
      status: repoStatus,
      statusTone: repoTone,
      currentValue: repoName || "—",
      actionLabel: repoName ? "수정" : "설정",
    },
    {
      key: "token",
      label: "GitHub Token",
      status: tokenStatus,
      statusTone: tokenTone,
      currentValue: tokenMasked || "—",
      actionLabel: hasGithubToken ? "교체" : "설정",
    },
    {
      key: "cursor",
      label: "Cursor API",
      status: cursorStatus,
      statusTone: cursorTone,
      currentValue: cursorMasked || "—",
      actionLabel: cursorStored ? "교체" : "설정",
    },
    {
      key: "connectionTest",
      label: "연결 테스트",
      status: conn.status,
      statusTone: conn.tone,
      currentValue: conn.value,
      actionLabel: "실행",
    },
  ];
}
