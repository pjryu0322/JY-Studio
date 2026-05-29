import { describe, expect, it } from "vitest";
import {
  getCursorBridgeAvailability,
  isCursorBridgeExecutionAvailable,
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

  it("missing_config when endpoint and local cli config missing", () => {
    const availability = getCursorBridgeAvailability({
      env: { CURSOR_BRIDGE_ENABLED: "true", CURSOR_BRIDGE_USE_LOCAL: "true" },
    });
    expect(availability.available).toBe(false);
    expect(availability.status).toBe("missing_config");
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

  it("available when local workspace and cli configured", () => {
    const availability = getCursorBridgeAvailability({
      env: {
        CURSOR_BRIDGE_ENABLED: "true",
        CURSOR_BRIDGE_USE_LOCAL: "true",
        CURSOR_WORKSPACE_ROOT: "/repo",
        CURSOR_CLI_PATH: "/usr/bin/cursor",
      },
    });
    expect(availability.available).toBe(true);
    expect(availability.mode).toBe("local_cli");
    expect(availability.workspaceRoot).toBe("/repo");
  });

  it("isPathUnderJyOrchestration allows orchestration paths only", () => {
    expect(isPathUnderJyOrchestration("projects/JYOrchestration/apps/web/src/a.ts")).toBe(true);
    expect(isPathUnderJyOrchestration("package.json")).toBe(false);
  });
});

describe("validateBridgeResultForRealSourceGeneration", () => {
  const base: CursorBridgeExecuteResult = {
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: "DEV-1",
    commitSha: "abc123def456",
    changedFiles: ["projects/JYOrchestration/apps/web/src/a.ts"],
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

  it("bridge ok with wip-stub sha returns failed validation", () => {
    const validation = validateBridgeResultForRealSourceGeneration({
      ...base,
      commitSha: "wip-stub-123",
    });
    expect(validation.ok).toBe(false);
  });

  it("bridge ok with changedFiles and commitSha returns completed validation", () => {
    const validation = validateBridgeResultForRealSourceGeneration(base);
    expect(validation.ok).toBe(true);
  });
});
