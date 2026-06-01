import { describe, expect, it } from "vitest";
import { parseLlmJsonObjectWithRecovery } from "@/lib/prototype/llmJsonParseRecovery";

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
  });
});
