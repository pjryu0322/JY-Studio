import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/messenger/resolveUserOpenAiKey", () => ({
  resolveUserOpenAiApiKey: vi.fn(),
}));

vi.mock("@/lib/ai/openAiEnv", () => ({
  resolveOpenAiApiKeyFromEnv: vi.fn(),
  resolveOpenAiModelFromEnv: vi.fn(() => "gpt-4o-mini"),
}));

vi.mock("@/lib/ai/openAiChatCompletions", () => ({
  postOpenAiChatCompletion: vi.fn(),
}));

import { generateKnowledgePackDraft } from "@/lib/knowledge-packs/knowledgePackDraftService";
import { resolveUserOpenAiApiKey } from "@/lib/messenger/resolveUserOpenAiKey";
import { resolveOpenAiApiKeyFromEnv } from "@/lib/ai/openAiEnv";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";

const gridInput = {
  productName: "GridPack",
  category: "GRID" as const,
  agents: ["AI_DEVELOPER"] as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateKnowledgePackDraft", () => {
  it("uses Mock fallback when no API key is available", async () => {
    vi.mocked(resolveUserOpenAiApiKey).mockResolvedValue({ key: null, source: "missing" });
    vi.mocked(resolveOpenAiApiKeyFromEnv).mockReturnValue("");

    const r = await generateKnowledgePackDraft(gridInput, { userId: "user-1" });

    expect(r.fallbackUsed).toBe(true);
    expect(r.mode).toBe("MOCK_FALLBACK");
    expect(r.provider).toBe("MOCK");
    expect(r.diagnostics?.length).toBeGreaterThan(0);
    expect(String(r.diagnostics?.[0] ?? "")).toMatch(/Mock|OPENAI_API_KEY|연동/i);
  });

  it("fallback result includes KnowledgePackDraftResult text fields", async () => {
    vi.mocked(resolveUserOpenAiApiKey).mockResolvedValue({ key: null, source: "missing" });
    vi.mocked(resolveOpenAiApiKeyFromEnv).mockReturnValue("");

    const r = await generateKnowledgePackDraft(gridInput, { userId: "user-1" });

    expect(r.summary.trim().length).toBeGreaterThan(0);
    expect(r.implementationGuidelines).toMatch(/Grid|그리드|조회/i);
    expect(typeof r.references).toBe("string");
    expect(r.sourceCandidates.trim().length).toBeGreaterThan(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("GRID input yields grid-oriented implementation guidance", async () => {
    vi.mocked(resolveUserOpenAiApiKey).mockResolvedValue({ key: null, source: "missing" });
    vi.mocked(resolveOpenAiApiKeyFromEnv).mockReturnValue("");

    const r = await generateKnowledgePackDraft(gridInput, { userId: "u" });
    expect(r.capabilities).toMatch(/정렬|필터|페이지/i);
  });

  it("AUTH input includes Secret/Token/Redirect-related content", async () => {
    vi.mocked(resolveUserOpenAiApiKey).mockResolvedValue({ key: null, source: "missing" });
    vi.mocked(resolveOpenAiApiKeyFromEnv).mockReturnValue("");

    const r = await generateKnowledgePackDraft(
      { productName: "OAuth", category: "AUTH", agents: ["AI_DEVELOPER"] },
      { userId: "u" }
    );
    const blob = `${r.forbiddenPatterns}\n${r.constraints}`;
    expect(blob).toMatch(/Secret|Redirect|Token|프론트/i);
  });

  it("includes diagnostics on LLM failure fallback", async () => {
    vi.mocked(resolveUserOpenAiApiKey).mockResolvedValue({ key: "sk-test", source: "test" });
    vi.mocked(postOpenAiChatCompletion).mockResolvedValue({ ok: false, code: "HTTP_500", message: "upstream" });

    const r = await generateKnowledgePackDraft(gridInput, { userId: "u" });
    expect(r.fallbackUsed).toBe(true);
    expect(r.diagnostics?.some((d) => d.includes("LLM") || d.includes("Mock"))).toBe(true);
  });

  it("references, sourceCandidates, and warnings are non-empty for mock path", async () => {
    vi.mocked(resolveUserOpenAiApiKey).mockResolvedValue({ key: null, source: "missing" });
    vi.mocked(resolveOpenAiApiKeyFromEnv).mockReturnValue("");

    const r = await generateKnowledgePackDraft(
      {
        productName: "WithUrls",
        category: "API",
        agents: ["AI_DEVELOPER"],
        productUrl: "https://p.example",
        officialDocsUrl: "https://d.example",
      },
      { userId: "u" }
    );

    expect(r.references).toContain("https://p.example");
    expect(r.sourceCandidates.trim()).not.toBe("");
    expect(r.warnings.join("\n")).toMatch(/라이선스|보안/i);
  });

  it("uses LLM path when OpenAI returns valid JSON", async () => {
    vi.mocked(resolveUserOpenAiApiKey).mockResolvedValue({ key: "sk-test", source: "test" });
    vi.mocked(postOpenAiChatCompletion).mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        summary: "LLM_UNIQUE_SUMMARY_XYZ",
        licenseNotes: "LLM license line",
      }),
    });

    const r = await generateKnowledgePackDraft(gridInput, { userId: "u" });
    expect(r.fallbackUsed).toBe(false);
    expect(r.provider).toBe("OPENAI");
    expect(r.mode).toBe("LLM");
    expect(r.summary).toContain("LLM_UNIQUE_SUMMARY_XYZ");
    expect(r.licenseNotes).toContain("LLM license line");
  });
});
