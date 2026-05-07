import { describe, expect, it } from "vitest";
import { PLATFORM_AI_MEMBERS_DEFAULT, normalizePlatformAiEngineModel } from "@/lib/ai/platformAiMembers";

describe("platform AI members engine/model", () => {
  it("renames feature_planning display name to AI 설계자", () => {
    const m = PLATFORM_AI_MEMBERS_DEFAULT.find((x) => x.id === "feature_planning");
    expect(m?.name).toBe("AI 설계자");
  });

  it("fills missing defaultModel for OpenAI and Cursor", () => {
    const a = normalizePlatformAiEngineModel({
      id: "x",
      name: "n",
      role: "r",
      capability: "LLM",
      persona: "",
      behaviorRules: "",
      knowledge: "",
      policy: {},
      defaultEngine: "OpenAI",
    });
    expect(a.defaultModel).toBe("GPT-5");

    const b = normalizePlatformAiEngineModel({
      id: "prototype_build",
      name: "n",
      role: "r",
      capability: "CODE",
      persona: "",
      behaviorRules: "",
      knowledge: "",
      policy: {},
      defaultEngine: "Cursor",
    });
    expect(b.defaultModel).toBe("cursor-default");
  });

  it("auto-corrects legacy invalid engine: non-prototype_build Cursor -> OpenAI", () => {
    const fixed = normalizePlatformAiEngineModel({
      id: "ideation",
      name: "n",
      role: "r",
      capability: "LLM",
      persona: "",
      behaviorRules: "",
      knowledge: "",
      policy: {},
      defaultEngine: "Cursor",
      defaultModel: "cursor-default",
    });
    expect(fixed.defaultEngine).toBe("OpenAI");
    expect(fixed.defaultModel).toBe("GPT-5");
  });

  it("default catalog uses OpenAI/GPT-5 except prototype_build Cursor/cursor-default", () => {
    const byId = new Map(PLATFORM_AI_MEMBERS_DEFAULT.map((m) => [m.id, m]));
    const proto = byId.get("prototype_build");
    expect(proto?.defaultEngine).toBe("Cursor");
    expect(proto?.defaultModel).toBe("cursor-default");

    const ideation = byId.get("ideation");
    expect(ideation?.defaultEngine).toBe("OpenAI");
    expect(ideation?.defaultModel).toBe("GPT-5");
  });
});

