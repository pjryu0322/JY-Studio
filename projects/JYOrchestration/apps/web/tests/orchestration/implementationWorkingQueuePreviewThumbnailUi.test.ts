import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("implementation working queue preview thumbnail UI", () => {
  it("renders thumbnail beside queue item description", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "src/components/preview/ImplementationWorkingQueuePanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("working-queue-item-preview-thumb");
    expect(panel).toContain("working-queue-filter-status");
    expect(panel).toContain("working-queue-filter-content");
    expect(panel).toContain("working-queue-item-download");
    expect(panel).not.toContain("보완요청을 승인하기 전까지");
    expect(panel).not.toMatch(/<h2[^>]*>[\s\S]*작업대기/);
  });
});
