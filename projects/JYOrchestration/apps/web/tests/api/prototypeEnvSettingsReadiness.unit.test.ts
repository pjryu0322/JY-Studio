import { describe, expect, it } from "vitest";
import {
  buildPrototypeEnvCodeAgentStatusRow,
  isGithubTokenCredentialsError,
  resolvePrototypeEnvTestDisabledTitle,
} from "@/lib/project/prototypeEnvSettingsReadiness";

describe("prototypeEnvSettingsReadiness", () => {
  it("builds Code Agent status for step card", () => {
    expect(buildPrototypeEnvCodeAgentStatusRow({ cursorApiConnectionOk: true } as never).value).toBe("정상");
  });

  it("detects github bad credentials for error card", () => {
    expect(
      isGithubTokenCredentialsError({
        githubOperableOk: false,
        lastHttpStatus: 401,
        lastErrorMessage: "Bad credentials",
        validatedAt: "2026-01-01T00:00:00.000Z",
        repoAccessOk: false,
        prReadOk: false,
        prCreateOk: false,
        prMergeOk: false,
        acceptedPermissionsHeader: null,
        steps: [],
        summaryKr: "",
      }),
    ).toBe(true);
  });

  it("returns disabled title when setup row is missing", () => {
    expect(
      resolvePrototypeEnvTestDisabledTitle({
        isPrototypeMvpUi: true,
        executionSetup: null,
        executionReady: false,
        baseBranchConfigured: false,
        autoPushOn: false,
      }),
    ).toBe("먼저 저장을 눌러 실행 환경 설정을 생성하세요");
  });

});
