import { describe, expect, it } from "vitest";
import {
  areSampleDataOwnedFilesOnBranch,
  SAMPLE_DATA_CANONICAL_FILES,
  SAMPLE_DATA_OWNED_FILE_PATHS,
  SAMPLE_DATA_WORK_BRANCH,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";

describe("sample data canonical SoT", () => {
  it("defines a single git work branch and two repo files", () => {
    expect(SAMPLE_DATA_WORK_BRANCH).toBe("wip/data/sample-data");
    expect(SAMPLE_DATA_OWNED_FILE_PATHS).toEqual([
      SAMPLE_DATA_CANONICAL_FILES.sampleData,
      SAMPLE_DATA_CANONICAL_FILES.meetingTypes,
    ]);
  });

  it("requires both canonical files on branch (no alternate paths)", () => {
    expect(
      areSampleDataOwnedFilesOnBranch([
        SAMPLE_DATA_CANONICAL_FILES.sampleData,
        SAMPLE_DATA_CANONICAL_FILES.meetingTypes,
      ]),
    ).toBe(true);
    expect(
      areSampleDataOwnedFilesOnBranch([
        SAMPLE_DATA_CANONICAL_FILES.sampleData,
        "src/data/types/meeting.ts",
      ]),
    ).toBe(false);
    expect(areSampleDataOwnedFilesOnBranch(["src/data/sample/sampleData.ts"])).toBe(false);
  });
});
