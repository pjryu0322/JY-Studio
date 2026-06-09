import { describe, expect, it } from "vitest";
import { isGithubReferenceAlreadyExistsErrorBody } from "@/lib/prototype/githubIntegrationBranchService";
import {
  INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
  toUserSafeIntegrationErrorMessage,
} from "@/lib/prototype/implementationIntegrationErrors";

describe("githubIntegrationBranchService", () => {
  it("detects Reference already exists from GitHub JSON body", () => {
    expect(
      isGithubReferenceAlreadyExistsErrorBody(
        JSON.stringify({
          message: "Reference already exists",
          documentation_url: "https://docs.github.com/rest/git/refs#create-a-reference",
          status: "422",
        }),
      ),
    ).toBe(true);
  });

  it("maps legacy raw HTTP branch create toast to user-safe message", () => {
    const msg = toUserSafeIntegrationErrorMessage(
      new Error(
        'integration branch 생성 실패 HTTP 422: {"message":"Reference already exists","status":"422"}',
      ),
    );
    expect(msg).toBe(INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE);
    expect(msg).not.toContain("422");
  });
});
