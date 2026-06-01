import { describe, expect, it } from "vitest";
import {
  normalizeLlmCodeTaskPlanRoot,
  parseLlmJsonObjectWithRecovery,
  safeLlmResponsePreviewStart,
} from "@/lib/prototype/llmJsonParseRecovery";

const SAMPLE_OBJECT = { version: "implementation_code_task_plan_v1", tasks: [{ codeTaskId: "A" }] };

describe("parseLlmJsonObjectWithRecovery", () => {
  it("5-1: parses direct JSON", () => {
    const raw = JSON.stringify(SAMPLE_OBJECT);
    const result = parseLlmJsonObjectWithRecovery(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe("direct_json_parse");
    expect((result.value as { version?: string }).version).toBe("implementation_code_task_plan_v1");
  });

  it("5-2: unwraps markdown json fence", () => {
    const raw = "```json\n" + JSON.stringify(SAMPLE_OBJECT) + "\n```";
    const result = parseLlmJsonObjectWithRecovery(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe("markdown_fence_unwrapped");
  });

  it("5-3: extracts first JSON object from surrounding text", () => {
    const raw = `Here is the refined plan:\n${JSON.stringify(SAMPLE_OBJECT)}\nDone.`;
    const result = parseLlmJsonObjectWithRecovery(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe("first_json_object_extracted");
  });

  it("5-4: fails safely without storing raw body", () => {
    const result = parseLlmJsonObjectWithRecovery("not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toMatch(/json_parse_failed|no_json_object_found/);
    expect(result.previewHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rawLength).toBe(8);
    expect(result.attempts.length).toBeGreaterThanOrEqual(3);
    expect(result.extractFailureReason).toBe("no_json_object_in_response");
    expect(result.attempts.map((a) => a.strategy)).toEqual([
      "direct_json_parse",
      "markdown_fence_unwrapped",
      "first_json_object_extracted",
    ]);
  });

  it("records extract failure reason for unbalanced JSON", () => {
    const result = parseLlmJsonObjectWithRecovery('{"tasks": [');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.extractFailureReason).toBe("unbalanced_json_object");
    expect(result.attempts.some((a) => a.outcome === "unbalanced_json_object")).toBe(true);
  });

  it("safeLlmResponsePreviewStart caps at 100 chars", () => {
    const long = "a".repeat(200);
    expect(safeLlmResponsePreviewStart(long).length).toBe(100);
  });
});

describe("normalizeLlmCodeTaskPlanRoot", () => {
  const task = { codeTaskId: "C1", parentTaskId: "P1" };

  it("accepts root.codeTasks", () => {
    const out = normalizeLlmCodeTaskPlanRoot({ codeTasks: [task] });
    expect(out?.normalizeSource).toBe("root.codeTasks");
    expect(out?.value.tasks).toHaveLength(1);
  });

  it("accepts root.plan.tasks", () => {
    const out = normalizeLlmCodeTaskPlanRoot({ plan: { tasks: [task] } });
    expect(out?.normalizeSource).toBe("root.plan.tasks");
    expect(out?.value.tasks).toHaveLength(1);
  });

  it("accepts root.plan.codeTasks", () => {
    const out = normalizeLlmCodeTaskPlanRoot({ plan: { codeTasks: [task] } });
    expect(out?.normalizeSource).toBe("root.plan.codeTasks");
    expect(out?.value.tasks).toHaveLength(1);
  });
});
