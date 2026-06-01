import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const resolveProviderMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    executionSetup: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

vi.mock("@/lib/prisma/executionSetupSplitColumnsHeal", () => ({
  withExecutionSetupSchemaHealRetry: (fn: () => unknown) => fn(),
}));

vi.mock("@/lib/prototype/implementationCodeTaskPlanLlmProvider", () => ({
  resolveLlmCodeTaskRefinementProviderContext: (...args: unknown[]) => resolveProviderMock(...args),
}));

import { resolveProjectCodeTaskRefinementSettings } from "@/lib/prototype/resolveProjectCodeTaskRefinementSettings.server";

describe("resolveProjectCodeTaskRefinementSettings.server", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    resolveProviderMock.mockReset();
  });

  it("7-1: reflects DB enable=true and project planner key without exposing key", async () => {
    findUniqueMock.mockResolvedValue({ enableLlmCodeTaskRefinement: true });
    resolveProviderMock.mockResolvedValue({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      providerSource: "project_execution_setup",
    });

    const settings = await resolveProjectCodeTaskRefinementSettings({
      projectId: "p1",
      actorUserId: "u1",
    });

    expect(settings.enableLlmCodeTaskRefinement).toBe(true);
    expect(settings.hasOpenaiPlannerApiKey).toBe(true);
    expect(settings.providerSource).toBe("project_execution_setup");
    expect(JSON.stringify(settings)).not.toContain("sk-test");
  });

  it("7-2: server DB settings drive enabled decision regardless of client payload", async () => {
    findUniqueMock.mockResolvedValue({ enableLlmCodeTaskRefinement: true });
    resolveProviderMock.mockResolvedValue({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      providerSource: "project_execution_setup",
    });

    const settings = await resolveProjectCodeTaskRefinementSettings({
      projectId: "p1",
      actorUserId: "u1",
    });

    expect(settings.enableLlmCodeTaskRefinement).toBe(true);
    expect(settings.hasOpenaiPlannerApiKey).toBe(true);
  });

  it("7-4: enable=false skips even when key exists", async () => {
    findUniqueMock.mockResolvedValue({ enableLlmCodeTaskRefinement: false });
    resolveProviderMock.mockResolvedValue({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      providerSource: "project_execution_setup",
    });

    const settings = await resolveProjectCodeTaskRefinementSettings({
      projectId: "p1",
      actorUserId: "u1",
    });

    expect(settings.enableLlmCodeTaskRefinement).toBe(false);
    expect(settings.hasOpenaiPlannerApiKey).toBe(true);
  });

  it("7-5: enable=true with no key yields missing provider", async () => {
    findUniqueMock.mockResolvedValue({ enableLlmCodeTaskRefinement: true });
    resolveProviderMock.mockResolvedValue({
      apiKey: null,
      model: "gpt-4o-mini",
      providerSource: "none",
    });

    const settings = await resolveProjectCodeTaskRefinementSettings({
      projectId: "p1",
      actorUserId: "u1",
    });

    expect(settings.enableLlmCodeTaskRefinement).toBe(true);
    expect(settings.hasOpenaiPlannerApiKey).toBe(false);
    expect(settings.providerSource).toBe("none");
  });
});
