import { describe, expect, it } from "vitest";

import { summarizeOpenAiHttpErrorBody } from "@/lib/ai/openAiChatCompletions";

describe("summarizeOpenAiHttpErrorBody", () => {
  it("extracts OpenAI error type and message from JSON body", () => {
    const raw = JSON.stringify({
      error: { type: "invalid_request_error", message: "Model not found", code: "model_not_found" },
    });
    const s = summarizeOpenAiHttpErrorBody(400, raw);
    expect(s).toContain("HTTP 400");
    expect(s).toContain("invalid_request_error");
    expect(s).toContain("Model not found");
  });

  it("falls back to truncated body when not JSON", () => {
    const s = summarizeOpenAiHttpErrorBody(502, "upstream timeout");
    expect(s).toContain("HTTP 502");
    expect(s).toContain("upstream");
  });
});
