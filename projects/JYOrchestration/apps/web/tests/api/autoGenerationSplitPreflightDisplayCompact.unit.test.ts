import { describe, expect, it } from "vitest";
import {
  buildEnvcheckTableRows,
  compactEnvcheckDisplayValue,
} from "@/lib/prototype/autoGenerationSplitPreflightDisplay";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("autoGenerationSplitPreflightDisplayCompact", () => {
  it("uses short passed labels for envcheck rows", () => {
    expect(compactEnvcheckDisplayValue("branch_create", "passed")).toBe("생성됨");
    expect(compactEnvcheckDisplayValue("file_write", "passed")).toBe("완료");
    expect(compactEnvcheckDisplayValue("pull_request_create_or_update", "passed")).toBe("생성/갱신됨");
  });

  it("preserves detail message on table rows", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      checkedAt: new Date().toISOString(),
      envcheck: [
        {
          key: "branch_create",
          status: "passed",
          required: true,
          userSafeMessage: "envcheck branch가 생성되었습니다.",
          operatorMessage: null,
          remediationCode: "none",
        },
        {
          key: "file_write",
          status: "passed",
          required: true,
          userSafeMessage: "임시 파일 생성/수정이 완료되었습니다.",
          operatorMessage: null,
          remediationCode: "none",
        },
        {
          key: "pull_request_create_or_update",
          status: "passed",
          required: true,
          userSafeMessage: "envcheck PR이 생성 또는 갱신되었습니다.",
          operatorMessage: null,
          remediationCode: "none",
        },
      ],
    });
    const rows = buildEnvcheckTableRows(result);
    const branch = rows.find((r) => r.key === "branch_create");
    expect(branch?.currentValue).toBe("생성됨");
    expect(branch?.detailMessage).toBe("envcheck branch가 생성되었습니다.");
  });
});
