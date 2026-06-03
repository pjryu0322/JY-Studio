import { describe, expect, it } from "vitest";
import {
  formatImplementationRuntimeUserPhaseKo,
  formatRuntimeStateKoForUser,
  mapRuntimeStateToUserPhase,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeGithubCentricModel";

describe("implementationRuntimeGithubCentricModel", () => {
  it("maps cursor-centric DB states to GitHub-centric phases", () => {
    expect(mapRuntimeStateToUserPhase("dispatching")).toBe("requested");
    expect(mapRuntimeStateToUserPhase("cursor_running")).toBe("requested");
    expect(mapRuntimeStateToUserPhase("github_verifying")).toBe("waiting_github");
    expect(mapRuntimeStateToUserPhase("completed")).toBe("completed");
  });

  it("formats user labels without cursor enum names", () => {
    expect(formatRuntimeStateKoForUser("dispatching")).toBe("CodeTask 실행 요청 중");
    expect(formatRuntimeStateKoForUser("cursor_running")).toBe("CodeTask 실행 중");
    expect(formatRuntimeStateKoForUser("github_verifying")).toBe("GitHub 결과 확인 중");
    expect(
      formatRuntimeStateKoForUser("github_verifying", { commitSha: "abc123" }),
    ).toBe("GitHub 커밋 확인 중");
    expect(
      formatImplementationRuntimeUserPhaseKo("waiting_github", {
        pullRequestUrl: "https://github.com/o/r/pull/1",
      }),
    ).toBe("PR 생성 확인 중");
  });
});
