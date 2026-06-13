import { describe, expect, it } from "vitest";
import { buildImplementationControlPlaneSnapshot } from "@/lib/prototype/implementationControlPlaneSnapshot";

describe("buildImplementationControlPlaneSnapshot", () => {
  it("aligns board totals with selection summary executable count", () => {
    const summary = {
      totalCount: 15,
      runnableCount: 0,
      selectedRunnableCount: 0,
      selectedRunnableCodeTaskIds: [],
      integrationReadyCount: 15,
      integrationReadyCodeTaskIds: ["A"],
    };
    const snapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      selectionSummary: summary,
    });
    expect(snapshot?.board.totalExecutableCodeTaskCount).toBe(15);
    expect(snapshot?.integration.enabled).toBe(true);
    expect(snapshot?.primaryAction.enabled).toBe(true);
  });
});
