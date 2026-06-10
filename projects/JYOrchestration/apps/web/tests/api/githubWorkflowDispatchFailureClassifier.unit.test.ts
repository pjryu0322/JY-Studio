import { describe, expect, it } from "vitest";
import {
  classifyWorkflowDispatchFailure,
  mapWorkflowDispatchRemediationToIntegrationPipelineStatus,
} from "@/lib/prototype/githubPreviewDeploymentFailureClassifier";

describe("githubWorkflowDispatchFailureClassifier", () => {
  it("1-2. maps 401/403 to permission_denied", () => {
    const r401 = classifyWorkflowDispatchFailure({ status: 401 });
    expect(r401.failureKind).toBe("permission_denied");
    expect(r401.remediationCode).toBe("enable_actions_permission");

    const r403 = classifyWorkflowDispatchFailure({ status: 403 });
    expect(r403.failureKind).toBe("permission_denied");
  });

  it("3. maps 403 rate limit to rate_limited", () => {
    const r = classifyWorkflowDispatchFailure({
      status: 403,
      responseBody: { message: "API rate limit exceeded" },
      responseHeaders: { "x-ratelimit-remaining": "0" },
    });
    expect(r.failureKind).toBe("rate_limited");
    expect(r.remediationCode).toBe("retry_later");
  });

  it("4. maps 404 to workflow_not_found", () => {
    const r = classifyWorkflowDispatchFailure({ status: 404 });
    expect(r.failureKind).toBe("workflow_not_found");
    expect(r.remediationCode).toBe("ensure_workflow_file");
  });

  it("5. maps 422 missing input to invalid_dispatch_inputs", () => {
    const r = classifyWorkflowDispatchFailure({
      status: 422,
      responseBody: { message: "Required input project_id is missing" },
    });
    expect(r.failureKind).toBe("invalid_dispatch_inputs");
    expect(r.remediationCode).not.toBe("enable_actions_permission");
  });

  it("6. maps 422 ref issue to invalid_dispatch_ref", () => {
    const r = classifyWorkflowDispatchFailure({
      status: 422,
      responseBody: { message: "Invalid ref main-branch" },
    });
    expect(r.failureKind).toBe("invalid_dispatch_ref");
  });

  it("7. maps 409 to workflow_disabled", () => {
    const r = classifyWorkflowDispatchFailure({ status: 409 });
    expect(r.failureKind).toBe("workflow_disabled");
  });

  it("8. maps 5xx to github_unavailable", () => {
    const r = classifyWorkflowDispatchFailure({ status: 503 });
    expect(r.failureKind).toBe("github_unavailable");
  });

  it("9. maps unknown status to unknown", () => {
    const r = classifyWorkflowDispatchFailure({ status: 418 });
    expect(r.failureKind).toBe("unknown");
  });

  it("10. 422 does not map to enable_actions_permission pipeline status", () => {
    const r = classifyWorkflowDispatchFailure({
      status: 422,
      responseBody: { message: "Input required" },
    });
    expect(
      mapWorkflowDispatchRemediationToIntegrationPipelineStatus(r.remediationCode),
    ).toBe("github_preview_workflow_request_invalid");
  });

  it("17. permission_denied maps to github_preview_permission_required only", () => {
    expect(
      mapWorkflowDispatchRemediationToIntegrationPipelineStatus("enable_actions_permission"),
    ).toBe("github_preview_permission_required");
    expect(
      mapWorkflowDispatchRemediationToIntegrationPipelineStatus("fix_workflow_inputs"),
    ).not.toBe("github_preview_permission_required");
  });
});
