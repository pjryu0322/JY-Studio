import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  cursorCredentialLooksStored,
  githubCredentialLooksStored,
  secretMaskedDisplay,
} from "@/components/project-spec/credentialUiMask";
import { isGithubTokenCredentialsError } from "@/lib/project/prototypeEnvSettingsReadiness";
import type { PrototypeEnvReadinessTone } from "@/lib/project/prototypeEnvSettingsReadiness";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { projectDatabaseUserDisplayFromSettings } from "@/lib/planning/projectDatabaseUserDisplay";

export type PrototypeEnvModalRowKey = "repo" | "token" | "cursor" | "database";

export type PrototypeEnvModalTableRow = Readonly<{
  readonly key: PrototypeEnvModalRowKey;
  readonly label: string;
  readonly status: string;
  readonly statusTone: PrototypeEnvReadinessTone;
  readonly currentValue: string;
}>;

export function buildPrototypeEnvModalTableRows(input: {
  readonly executionSetup: ExecutionSetupDto | null;
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
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

  return [
    {
      key: "repo",
      label: "GitHub 저장소",
      status: repoStatus,
      statusTone: repoTone,
      currentValue: repoName || "—",
    },
    {
      key: "database",
      label: "데이터베이스",
      ...(() => {
        const db =
          input.planningDatabaseSettings ??
          parsePlanningDatabaseSettingsV1(es?.planningDatabaseSettingsJson ?? null);
        const display = projectDatabaseUserDisplayFromSettings(db);
        return {
          status: display.status,
          statusTone: display.statusTone,
          currentValue: display.currentValue,
        };
      })(),
    },
    {
      key: "token",
      label: "GitHub Token",
      status: tokenStatus,
      statusTone: tokenTone,
      currentValue: tokenMasked || "—",
    },
    {
      key: "cursor",
      label: "Cursor API",
      status: cursorStatus,
      statusTone: cursorTone,
      currentValue: cursorMasked || "—",
    },
  ];
}
