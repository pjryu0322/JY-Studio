import { describe, expect, it } from "vitest";
import {
  buildBoardGateMismatchLogFields,
  evaluateIntegrationBlockedByRunnableBoardSummary,
  evaluatePrepareIntegrationPreviewStartGate,
  INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE,
  INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE,
  isSameBoardGateSummary,
  resolveImplementationIntegrationControlGate,
} from "@/lib/prototype/implementationBoardIntegrationGate";
import { INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE } from "@/lib/prototype/implementationIntegrationGate";

describe("evaluateIntegrationBlockedByRunnableBoardSummary", () => {
  it("no longer blocks integration when runnable rows remain", () => {
    const gate = evaluateIntegrationBlockedByRunnableBoardSummary({ runnableCount: 1 });
    expect(gate.ok).toBe(true);
    expect(gate.message).toBeNull();
  });
});

describe("evaluatePrepareIntegrationPreviewStartGate", () => {
  it("blocks when no integration-ready completed tasks", () => {
    const gate = evaluatePrepareIntegrationPreviewStartGate({
      totalCount: 2,
      runnableCount: 0,
      integrationReadyCount: 0,
      integrationReadyCodeTaskIds: [],
    });
    expect(gate.ok).toBe(false);
    expect(gate.message).toBe(INTEGRATION_NO_COMPLETED_TARGETS_USER_MESSAGE);
  });

  it("blocks when runnable tasks remain and not all integration-ready", () => {
    const gate = evaluatePrepareIntegrationPreviewStartGate({
      totalCount: 3,
      runnableCount: 1,
      integrationReadyCount: 2,
      integrationReadyCodeTaskIds: ["A", "B"],
    });
    expect(gate.ok).toBe(false);
    expect(gate.message).toBe(INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE);
  });

  it("allows when all executable tasks are integration-ready even if runnableCount is stale", () => {
    const gate = evaluatePrepareIntegrationPreviewStartGate({
      totalCount: 15,
      runnableCount: 1,
      integrationReadyCount: 15,
      integrationReadyCodeTaskIds: Array.from({ length: 15 }, (_, i) => `CODE-${i}`),
    });
    expect(gate.ok).toBe(true);
    expect(gate.codeTaskIds).toHaveLength(15);
  });

  it("allows when all executable tasks are integration-ready", () => {
    const gate = evaluatePrepareIntegrationPreviewStartGate({
      totalCount: 2,
      runnableCount: 0,
      integrationReadyCount: 2,
      integrationReadyCodeTaskIds: ["A", "B"],
    });
    expect(gate.ok).toBe(true);
    expect(gate.codeTaskIds).toEqual(["A", "B"]);
  });
});

describe("resolveImplementationIntegrationControlGate", () => {
  const allReady = {
    totalCount: 2,
    runnableCount: 0,
    selectedRunnableCount: 0,
    selectedRunnableCodeTaskIds: [],
    integrationReadyCount: 2,
    integrationReadyCodeTaskIds: ["A", "B"],
  };

  it("returns open_preview when preview url is ready", () => {
    const gate = resolveImplementationIntegrationControlGate({
      summary: allReady,
      previewReady: true,
      actualPreviewUrl: "https://x.test",
    });
    expect(gate.action).toBe("open_preview");
    expect(gate.enabled).toBe(true);
  });

  it("allows prepare when all integration-ready despite stale runnableCount", () => {
    const gate = resolveImplementationIntegrationControlGate({
      summary: { ...allReady, runnableCount: 1 },
    });
    expect(gate.action).toBe("prepare_integration_preview");
    expect(gate.enabled).toBe(true);
  });

  it("blocks when runnableCount > 0 and integration incomplete", () => {
    const gate = resolveImplementationIntegrationControlGate({
      summary: {
        ...allReady,
        totalCount: 3,
        integrationReadyCount: 2,
        integrationReadyCodeTaskIds: ["A", "B"],
        runnableCount: 1,
      },
    });
    expect(gate.action).toBe("blocked");
    expect(gate.enabled).toBe(false);
    expect(gate.disabledReason).toContain("미완료");
  });

  it("blocks when integrationReadyCount < totalCount", () => {
    const gate = resolveImplementationIntegrationControlGate({
      summary: {
        ...allReady,
        totalCount: 3,
        integrationReadyCount: 2,
      },
    });
    expect(gate.enabled).toBe(false);
    expect(gate.disabledReason).toBe(INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE);
  });

  it("enables prepare when all executable tasks are ready", () => {
    const gate = resolveImplementationIntegrationControlGate({ summary: allReady });
    expect(gate.action).toBe("prepare_integration_preview");
    expect(gate.enabled).toBe(true);
    expect(gate.targetCodeTaskIds).toEqual(["A", "B"]);
  });
});

describe("buildBoardGateMismatchLogFields", () => {
  it("builds mismatch fields when client and server board gate differ", () => {
    const server = {
      totalCount: 15,
      runnableCount: 0,
      selectedRunnableCount: 0,
      selectedRunnableCodeTaskIds: [],
      integrationReadyCount: 15,
      integrationReadyCodeTaskIds: ["A"],
      runnableCodeTaskIds: [],
      blockedDetails: [{ codeTaskId: "B", status: "대기", progress: "실행 가능", githubOutcomeSaved: false, commitSha: null }],
    };
    const client = { ...server, runnableCount: 1, runnableCodeTaskIds: ["B"] };
    const fields = buildBoardGateMismatchLogFields({ client, server });
    expect(fields.summariesMatch).toBe(false);
    expect(fields.runnableCodeTaskIdsMatch).toBe(false);
    expect(fields.serverRunnableCount).toBe(0);
    expect(fields.clientRunnableCount).toBe(1);
  });
});

describe("isSameBoardGateSummary", () => {
  it("detects mismatched server/client summaries", () => {
    const server = {
      totalCount: 15,
      runnableCount: 0,
      selectedRunnableCount: 0,
      selectedRunnableCodeTaskIds: [],
      integrationReadyCount: 15,
      integrationReadyCodeTaskIds: ["A"],
    };
    const client = { ...server, runnableCount: 1 };
    expect(isSameBoardGateSummary(client, server)).toBe(false);
    expect(isSameBoardGateSummary(server, server)).toBe(true);
  });
});
