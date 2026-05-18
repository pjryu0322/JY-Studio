import { beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskExecutionRun: {
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import { persistScmBlockReasonOnRun } from "@/lib/ai-team-runtime/scmBlockReason";

describe("persistScmBlockReasonOnRun", () => {
  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue({});
  });

  it("skips empty or whitespace-only reason", async () => {
    await persistScmBlockReasonOnRun("run-1", "  ");
    await persistScmBlockReasonOnRun("run-1", "");
    expect(update).not.toHaveBeenCalled();
  });

  it("persists trimmed reason to evaluationReason only", async () => {
    await persistScmBlockReasonOnRun("run-1", "  auto-merge disabled  ");
    expect(update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { evaluationReason: "auto-merge disabled" },
    });
  });

  it("truncates reason to 8000 characters", async () => {
    const long = "x".repeat(9000);
    await persistScmBlockReasonOnRun("run-2", long);
    expect(update).toHaveBeenCalledWith({
      where: { id: "run-2" },
      data: { evaluationReason: "x".repeat(8000) },
    });
  });
});
