import { describe, expect, it } from "vitest";
import {
  getCursorBridgeAvailability,
  isCursorBridgeExecutionAvailable,
  isPlatformInternalSourcePath,
  isPathUnderJyOrchestration,
} from "@/lib/prototype/cursorBridgeRuntime";
import {
  validateBridgeResultForRealSourceGeneration,
  type CursorBridgeExecuteResult,
} from "@/lib/prototype/cursorBridgeExecution";

describe("cursorBridgeRuntime", () => {
  it("disabled when CURSOR_BRIDGE_ENABLED not true", () => {
    const availability = getCursorBridgeAvailability({ env: { CURSOR_BRIDGE_ENABLED: "false" } });
    expect(availability.available).toBe(false);
    expect(availability.status).toBe("disabled");
    expect(isCursorBridgeExecutionAvailable({ env: { CURSOR_BRIDGE_ENABLED: "false" } })).toBe(false);
  });

  it("missing_config when local enabled without cli/runner", () => {
    const availability = getCursorBridgeAvailability({
      env: {
        CURSOR_BRIDGE_ENABLED: "true",
        CURSOR_BRIDGE_USE_LOCAL: "true",
        GIT_APPLY_WORKDIR: "/tmp/repos",
      },
    });
    expect(availability.available).toBe(false);
    expect(availability.status).toBe("missing_config");
  });

  it("does not auto-enable local when endpoint missing", () => {
    const availability = getCursorBridgeAvailability({
      env: { CURSOR_BRIDGE_ENABLED: "true" },
    });
    expect(availability.available).toBe(false);
    expect(availability.mode).toBe("none");
  });

  it("available when HTTP endpoint configured", () => {
    const availability = getCursorBridgeAvailability({
      env: {
        CURSOR_BRIDGE_ENABLED: "true",
        CURSOR_BRIDGE_ENDPOINT: "http://localhost:9876",
      },
    });
    expect(availability.available).toBe(true);
    expect(availability.mode).toBe("http");
    expect(availability.endpoint).toBe("http://localhost:9876");
  });

  it("available when local cli and clone root configured", () => {
    const availability = getCursorBridgeAvailability({
      env: {
        CURSOR_BRIDGE_ENABLED: "true",
        CURSOR_BRIDGE_USE_LOCAL: "true",
        CURSOR_TARGET_REPO_CLONE_ROOT: "/repos",
        CURSOR_CLI_PATH: "/usr/bin/cursor",
      },
    });
    expect(availability.available).toBe(true);
    expect(availability.mode).toBe("local_cli");
    expect(availability.workspaceRoot).toBe("/repos");
  });

  it("isPlatformInternalSourcePath detects platform paths", () => {
    expect(isPlatformInternalSourcePath("projects/JYOrchestration/apps/web/src/a.ts")).toBe(true);
    expect(isPlatformInternalSourcePath("apps/web/src/generated/implementation-wip/x.json")).toBe(true);
    expect(isPlatformInternalSourcePath("src/app/page.tsx")).toBe(false);
    expect(isPathUnderJyOrchestration("projects/JYOrchestration/apps/web/src/a.ts")).toBe(true);
  });
});

describe("validateBridgeResultForRealSourceGeneration (legacy import)", () => {
  const base: CursorBridgeExecuteResult = {
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: "DEV-1",
    targetRepository: "owner/repo",
    commitSha: "abc123def456",
    changedFiles: ["src/a.ts"],
  };

  it("bridge ok without changedFiles returns failed validation", () => {
    const validation = validateBridgeResultForRealSourceGeneration({
      ...base,
      changedFiles: [],
    });
    expect(validation.ok).toBe(false);
  });

  it("bridge ok without commitSha returns failed validation", () => {
    const validation = validateBridgeResultForRealSourceGeneration({
      ...base,
      commitSha: undefined,
    });
    expect(validation.ok).toBe(false);
  });
});
