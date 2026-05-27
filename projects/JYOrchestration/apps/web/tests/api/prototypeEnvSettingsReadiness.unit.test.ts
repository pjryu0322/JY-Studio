import { describe, expect, it } from "vitest";
import {
  buildPrototypeEnvReadinessRows,
  isGithubTokenCredentialsError,
  resolvePrototypeEnvTestDisabledTitle,
} from "@/lib/project/prototypeEnvSettingsReadiness";

describe("prototypeEnvSettingsReadiness", () => {
  it("shows LLM as default settings without unresolved label", () => {
    const rows = buildPrototypeEnvReadinessRows({
      executionSetup: null,
      connectionTestSatisfied: false,
    });
    const llm = rows.find((r) => r.key === "llm");
    expect(llm?.value).toBe("기본 설정 사용");
    expect(llm?.value).not.toBe("미해결");
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

  it("marks connection test complete when satisfied", () => {
    const rows = buildPrototypeEnvReadinessRows({
      executionSetup: { repoConnectionOk: true } as never,
      connectionTestSatisfied: true,
    });
    expect(rows.find((r) => r.key === "connectionTest")?.value).toBe("완료");
    expect(rows.find((r) => r.key === "connectionTest")?.tone).toBe("ok");
  });
});
