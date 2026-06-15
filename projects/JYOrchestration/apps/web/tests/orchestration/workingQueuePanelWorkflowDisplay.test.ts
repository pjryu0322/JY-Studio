import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("workingQueuePanelWorkflowDisplay", () => {
  it("shows 담당 workflow on cards without affected area lead", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "src/components/preview/ImplementationWorkingQueuePanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("working-queue-item-meta");
    expect(panel).toContain("workingQueueItemWorkflowLabel");
    expect(panel).toContain("담당:");
    expect(panel).toContain("요청:");
    expect(panel).not.toContain("영향 영역:");
  });
});
