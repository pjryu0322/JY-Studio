import { describe, expect, it } from "vitest";
import {
  GITHUB_TOKEN_CORE_PERMISSION_LINES,
  GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_GUIDE_INTRO,
  GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_PERMISSION_LINES,
} from "@/lib/prototype/githubProviderPermissionGuide";
import { deriveAutoGenerationReadyFromConnectionTest } from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("githubTokenPermissionGuidePagesAdmin", () => {
  it("22. core connection test does not require Pages/Admin permissions", () => {
    const passed = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      previewDeploymentPreflight: [
        { key: "pages_status_read", status: "failed", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "add_pages_admin_permissions" },
      ],
    });
    expect(deriveAutoGenerationReadyFromConnectionTest(passed)).toBe(true);
  });

  it("17. preview auto configure guide mentions Pages and Administration", () => {
    expect(GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_PERMISSION_LINES.join(" ")).toContain("Pages");
    expect(GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_PERMISSION_LINES.join(" ")).toContain("Administration");
    expect(GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_GUIDE_INTRO).toContain("GitHub Actions");
    expect(GITHUB_TOKEN_CORE_PERMISSION_LINES.join(" ")).not.toContain("Administration");
  });
});
