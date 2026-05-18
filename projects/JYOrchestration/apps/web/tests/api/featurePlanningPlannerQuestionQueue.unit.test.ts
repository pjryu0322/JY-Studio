import { describe, expect, it } from "vitest";
import {
  inferAnsweredPlannerFieldsFromUserMessage,
  nextUnansweredPlannerField,
  normalizePlannerQueueStepKey,
  resolvePlannerQuestionQueue,
} from "@/lib/featurePlanning/featurePlanningPlannerQuestionQueue";

describe("featurePlanningPlannerQuestionQueue", () => {
  it("resolves upload-style queue for 녹취 업로드", () => {
    const q = resolvePlannerQuestionQueue("녹취파일 업로드");
    expect(q[0]?.id).toBe("file_format");
    expect(q.map((x) => x.id)).toContain("file_size_max");
  });

  it("next unanswered skips answered", () => {
    const q = resolvePlannerQuestionQueue("파일 업로드");
    expect(nextUnansweredPlannerField(q, [])?.id).toBe("file_format");
    expect(nextUnansweredPlannerField(q, ["file_format"])?.id).toBe("file_size_max");
  });

  it("infers file_format from mp3/wav user message", () => {
    const q = resolvePlannerQuestionQueue("첨부파일 업로드");
    const next = nextUnansweredPlannerField(q, []);
    const inferred = inferAnsweredPlannerFieldsFromUserMessage(
      "첨부파일은 mp3, wav 형식만 허용해줘",
      next,
      q,
      []
    );
    expect(inferred).toContain("file_format");
  });

  it("normalizes step key", () => {
    expect(normalizePlannerQueueStepKey("  파일 업로드  ")).toContain("파일");
  });
});
