import { describe, expect, it } from "vitest";
import {
  assertMvpReferenceSnapshotIdCount,
  normalizeReferenceSnapshotIds,
  ReferenceSnapshotSelectionValidationError,
} from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";

describe("projectReferenceSelectionValidation", () => {
  it("rejects more than one snapshot id for MVP", () => {
    expect(() => assertMvpReferenceSnapshotIdCount(["a", "b"])).toThrow(ReferenceSnapshotSelectionValidationError);
  });

  it("normalizes snapshot id array", () => {
    expect(normalizeReferenceSnapshotIds([" a ", "", "a"])).toEqual(["a"]);
  });
});
