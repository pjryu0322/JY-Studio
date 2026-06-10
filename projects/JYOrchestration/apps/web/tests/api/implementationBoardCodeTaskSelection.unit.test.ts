import { describe, expect, it } from "vitest";
import { evaluateQuickRunExecutionSelectionGate } from "@/lib/prototype/implementationExecutionButtonPolicy";

describe("evaluateQuickRunExecutionSelectionGate with board runnable ids", () => {
  it("accepts selection when board runnable set includes selected sample task", () => {
    const gate = evaluateQuickRunExecutionSelectionGate({
      selectedCodeTaskIds: ["CODE-DATA-SAMPLE-001"],
      runnableCodeTaskIdsFromBoard: ["CODE-DATA-SAMPLE-001"],
    });
    expect(gate.ok).toBe(true);
    expect(gate.runnableIds).toEqual(["CODE-DATA-SAMPLE-001"]);
  });

  it("rejects when board runnable set does not include selection", () => {
    const gate = evaluateQuickRunExecutionSelectionGate({
      selectedCodeTaskIds: ["CODE-DONE-001"],
      runnableCodeTaskIdsFromBoard: ["CODE-DATA-SAMPLE-001"],
    });
    expect(gate.ok).toBe(false);
  });
});
