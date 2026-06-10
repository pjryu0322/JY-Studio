import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openActualIntegratedPreviewInNewWindow } from "@/lib/prototype/actualIntegratedPreviewOpenAction";

describe("ActualPreviewNewWindowButton", () => {
  it("8. open helper rejects diagnostic scope URLs", () => {
    const opened = openActualIntegratedPreviewInNewWindow({
      projectId: "p1",
      url: "/projects/p1/preview?scope=latest",
    });
    expect(opened).toBe(false);
  });

  it("9-10. board uses dedicated new-window open helper", () => {
    const src = readFileSync(
      join(__dirname, "../../src/components/preview/ImplementationExecutionBoardPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("openActualIntegratedPreviewInNewWindow");
    expect(src).not.toContain('mode: "codetask_result_preview"');
    expect(src).toContain('noopener,noreferrer');
  });
});
