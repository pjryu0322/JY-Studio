import { describe, expect, it } from "vitest";
import type { AutoGenerationCheckResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";

// Test classification logic via exported types — invoke through a minimal mirror of integration mapping.
import { mapWorkflowDispatchRemediationToIntegrationPipelineStatus } from "@/lib/prototype/githubPreviewDeploymentFailureClassifier";

function mapDispatchCheck(check: AutoGenerationCheckResultV1): string {
  if (check.key !== "actions_workflow_dispatch" || check.status !== "failed") {
    return "github_preview_operator_review_required";
  }
  return mapWorkflowDispatchRemediationToIntegrationPipelineStatus(check.remediationCode as never);
}

describe("integrationPreviewWorkflowDispatchClassification", () => {
  it("15. workflow_not_found remediation maps to workflow setup required", () => {
    expect(
      mapDispatchCheck({
        key: "actions_workflow_dispatch",
        status: "failed",
        required: true,
        remediationCode: "ensure_workflow_file",
        userSafeMessage: "x",
        operatorMessage: null,
      }),
    ).toBe("github_preview_workflow_setup_required");
  });

  it("16. invalid_dispatch_inputs maps to workflow request invalid", () => {
    expect(
      mapDispatchCheck({
        key: "actions_workflow_dispatch",
        status: "failed",
        required: true,
        remediationCode: "fix_workflow_inputs",
        userSafeMessage: "x",
        operatorMessage: null,
      }),
    ).toBe("github_preview_workflow_request_invalid");
  });

  it("17. enable_actions_permission maps to permission required", () => {
    expect(
      mapDispatchCheck({
        key: "actions_workflow_dispatch",
        status: "failed",
        required: true,
        remediationCode: "enable_actions_permission",
        userSafeMessage: "x",
        operatorMessage: null,
      }),
    ).toBe("github_preview_permission_required");
  });
});
