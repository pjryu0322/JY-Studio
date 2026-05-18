import { describe, expect, it } from "vitest";
import {
  canonicalOpenAiUiModel,
  deriveProjectAiAgentUiState,
  persistPrefsFromUi,
  projectAiAgentEngineChoices,
  projectAiAgentModelWhenEngineChanges,
} from "@/lib/workspace-ai/projectAiAgentEngineModel";

describe("projectAiAgentEngineModel", () => {
  it("non-developer engine choices exclude Cursor", () => {
    expect(projectAiAgentEngineChoices("ideation")).toEqual(["USER_DEFAULT", "OPENAI"]);
    expect(projectAiAgentEngineChoices("prototype_build")).toEqual(["USER_DEFAULT", "OPENAI", "CURSOR"]);
  });

  it("flags invalid Cursor on non-developer", () => {
    const st = deriveProjectAiAgentUiState({
      catalogKey: "ideation",
      graphEnginePreference: "USER_DEFAULT",
      memberAiProvider: "cursor",
      memberAiModelOverride: "cursor-default",
    });
    expect(st.invalidCursorOnNonDeveloper).toBe(true);
    expect(st.uiEngine).toBe("OPENAI");
  });

  it("developer OpenAI maps graph to USER_DEFAULT and stores openai on member", () => {
    const p = persistPrefsFromUi({
      catalogKey: "prototype_build",
      uiEngine: "OPENAI",
      uiModel: "o3",
    });
    expect(p.graphEnginePreference).toBe("USER_DEFAULT");
    expect(p.aiProvider).toBe("openai");
    expect(p.aiModelOverride).toBe("o3");
  });

  it("developer Cursor pins graph CURSOR", () => {
    const p = persistPrefsFromUi({
      catalogKey: "prototype_build",
      uiEngine: "CURSOR",
      uiModel: "cursor-default",
    });
    expect(p.graphEnginePreference).toBe("CURSOR");
    expect(p.aiProvider).toBe("cursor");
    expect(p.aiModelOverride).toBe("cursor-default");
  });

  it("LLM OpenAI maps graph OPENAI", () => {
    const p = persistPrefsFromUi({
      catalogKey: "ideation",
      uiEngine: "OPENAI",
      uiModel: "GPT-4.1",
    });
    expect(p.graphEnginePreference).toBe("OPENAI");
    expect(p.aiProvider).toBe("openai");
    expect(p.aiModelOverride).toBe("GPT-4.1");
  });

  it("canonicalOpenAiUiModel normalizes legacy ids", () => {
    expect(canonicalOpenAiUiModel("gpt-5")).toBe("GPT-5");
    expect(canonicalOpenAiUiModel("unknown")).toBe("GPT-5");
  });

  it("projectAiAgentModelWhenEngineChanges resets by policy", () => {
    expect(projectAiAgentModelWhenEngineChanges("ideation", "USER_DEFAULT", "GPT-4.1")).toBe("USER_DEFAULT");
    expect(projectAiAgentModelWhenEngineChanges("prototype_build", "CURSOR", "GPT-5")).toBe("cursor-default");
  });
});
