import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import {
  parseEnginePreferenceKey,
  type WorkspaceAiEnginePreferenceKey,
} from "@/lib/workspace-ai/workspaceAiEnginePreference";

/** 프로젝트 AI Agent 탭 UI — 엔진 3종 */
export type ProjectAiAgentUiEngine = "USER_DEFAULT" | "OPENAI" | "CURSOR";

/** UI 모델 값(저장 시 `aiModelOverride` 문자열과 정렬) */
export type ProjectAiAgentUiModel = "USER_DEFAULT" | "GPT-5" | "GPT-4.1" | "o3" | "cursor-default";

export const PROJECT_AI_OPENAI_MODELS: readonly ProjectAiAgentUiModel[] = ["GPT-5", "GPT-4.1", "o3"];

const OPENAI_MODEL_CANON = new Map<string, ProjectAiAgentUiModel>([
  ["gpt-5", "GPT-5"],
  ["gpt5", "GPT-5"],
  ["gpt-5.1", "GPT-5"],
  ["gpt-4.1", "GPT-4.1"],
  ["gpt4.1", "GPT-4.1"],
  ["o3", "o3"],
]);

export function isPrototypeBuildCatalogKey(catalogKey: WorkspaceAiMemberId): boolean {
  return catalogKey === "prototype_build";
}

export function canonicalOpenAiUiModel(raw: string | null | undefined): ProjectAiAgentUiModel {
  const t = String(raw ?? "").trim();
  if (!t) return "GPT-5";
  const u = t.toUpperCase();
  if (u === "GPT-5" || u === "GPT5") return "GPT-5";
  if (u === "GPT-4.1" || u === "GPT4.1") return "GPT-4.1";
  if (u === "O3") return "o3";
  const lowered = t.toLowerCase();
  return OPENAI_MODEL_CANON.get(lowered) ?? "GPT-5";
}

export function projectAiAgentEngineChoices(catalogKey: WorkspaceAiMemberId): readonly ProjectAiAgentUiEngine[] {
  if (isPrototypeBuildCatalogKey(catalogKey)) {
    return ["USER_DEFAULT", "OPENAI", "CURSOR"];
  }
  return ["USER_DEFAULT", "OPENAI"];
}

/** 그래프/멤버 저장값 → UI 상태(비정상 Cursor는 OPENAI+GPT-5로 표시하고 경고 플래그) */
export function deriveProjectAiAgentUiState(input: {
  readonly catalogKey: WorkspaceAiMemberId;
  readonly graphEnginePreference: string | null | undefined;
  readonly memberAiProvider: string | null | undefined;
  readonly memberAiModelOverride: string | null | undefined;
}): {
  readonly uiEngine: ProjectAiAgentUiEngine;
  readonly uiModel: ProjectAiAgentUiModel;
  readonly invalidCursorOnNonDeveloper: boolean;
} {
  const graphKey = parseEnginePreferenceKey(input.graphEnginePreference) ?? "USER_DEFAULT";
  const prov = String(input.memberAiProvider ?? "").trim().toLowerCase();
  const isDev = isPrototypeBuildCatalogKey(input.catalogKey);

  const memberLooksCursor = prov === "cursor";
  const graphLooksCursor = graphKey === "CURSOR";

  if (!isDev && (memberLooksCursor || graphLooksCursor)) {
    return {
      uiEngine: "OPENAI",
      uiModel: "GPT-5",
      invalidCursorOnNonDeveloper: true,
    };
  }

  if (isDev) {
    if (graphLooksCursor) {
      return {
        uiEngine: "CURSOR",
        uiModel: "cursor-default",
        invalidCursorOnNonDeveloper: false,
      };
    }
    if (prov === "openai") {
      return {
        uiEngine: "OPENAI",
        uiModel: canonicalOpenAiUiModel(input.memberAiModelOverride),
        invalidCursorOnNonDeveloper: false,
      };
    }
    return {
      uiEngine: "USER_DEFAULT",
      uiModel: "USER_DEFAULT",
      invalidCursorOnNonDeveloper: false,
    };
  }

  // LLM 카탈로그 — Claude/Gemini 등은 OpenAI UI로 접어서 편집 유도
  if (graphKey === "USER_DEFAULT") {
    if (prov === "openai") {
      return {
        uiEngine: "OPENAI",
        uiModel: canonicalOpenAiUiModel(input.memberAiModelOverride),
        invalidCursorOnNonDeveloper: false,
      };
    }
    return {
      uiEngine: "USER_DEFAULT",
      uiModel: "USER_DEFAULT",
      invalidCursorOnNonDeveloper: false,
    };
  }

  if (graphKey === "OPENAI" || graphKey === "ANTHROPIC" || graphKey === "GEMINI") {
    return {
      uiEngine: "OPENAI",
      uiModel: canonicalOpenAiUiModel(input.memberAiModelOverride),
      invalidCursorOnNonDeveloper: false,
    };
  }

  return {
    uiEngine: "USER_DEFAULT",
    uiModel: "USER_DEFAULT",
    invalidCursorOnNonDeveloper: false,
  };
}

/** 엔진 변경 시 모델 자동 보정(요구사항 §7) */
export function projectAiAgentModelWhenEngineChanges(
  catalogKey: WorkspaceAiMemberId,
  nextEngine: ProjectAiAgentUiEngine,
  prevModel: ProjectAiAgentUiModel
): ProjectAiAgentUiModel {
  if (nextEngine === "USER_DEFAULT") return "USER_DEFAULT";
  if (nextEngine === "CURSOR") return "cursor-default";
  // OPENAI
  if (prevModel === "GPT-5" || prevModel === "GPT-4.1" || prevModel === "o3") return prevModel;
  return "GPT-5";
}

export type PersistedAgentPrefs = {
  readonly graphEnginePreference: WorkspaceAiEnginePreferenceKey;
  readonly aiProvider: string | null;
  readonly aiModelOverride: string | null;
};

/** UI → DB: WorkspaceAiMember.enginePreference + ProjectMember aiProvider / aiModelOverride */
export function persistPrefsFromUi(input: {
  readonly catalogKey: WorkspaceAiMemberId;
  readonly uiEngine: ProjectAiAgentUiEngine;
  readonly uiModel: ProjectAiAgentUiModel;
}): PersistedAgentPrefs {
  const isDev = isPrototypeBuildCatalogKey(input.catalogKey);

  if (!isDev && input.uiEngine === "CURSOR") {
    return {
      graphEnginePreference: "OPENAI",
      aiProvider: "openai",
      aiModelOverride: "GPT-5",
    };
  }

  if (input.uiEngine === "USER_DEFAULT") {
    return { graphEnginePreference: "USER_DEFAULT", aiProvider: null, aiModelOverride: null };
  }

  if (input.uiEngine === "CURSOR") {
    return { graphEnginePreference: "CURSOR", aiProvider: "cursor", aiModelOverride: "cursor-default" };
  }

  // OPENAI
  const model =
    input.uiModel === "GPT-5" || input.uiModel === "GPT-4.1" || input.uiModel === "o3" ? input.uiModel : "GPT-5";

  if (isDev) {
    return {
      graphEnginePreference: "USER_DEFAULT",
      aiProvider: "openai",
      aiModelOverride: model,
    };
  }

  return {
    graphEnginePreference: "OPENAI",
    aiProvider: "openai",
    aiModelOverride: model,
  };
}
