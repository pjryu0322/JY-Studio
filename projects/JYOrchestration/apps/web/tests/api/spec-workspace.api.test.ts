import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC_GENERATION_USER_TEMPLATE } from "@/lib/project-spec/buildWorkspacePromptText";
import {
  apiFetch,
  apiLogin,
  getSeedProjectId,
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
} from "./helpers";

describe("spec workspace API", () => {
  it("[SPEC-WS-001] aiRequest는 클라이언트 prompt/content를 무시하고 저장된 workspace 데이터만 사용", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(cookie);

    const patchRes = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/spec-workspace`, {
      method: "PATCH",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Workspace Source Test ${Date.now()}`,
        description: "workspace saved description",
        projectType: "web-service",
        specCoreGoals: "workspace goal",
        specScopeIn: "- in-scope-a\n- in-scope-b",
        specScopeOut: "- out-scope-a",
        specTargetUsers: "- owner",
        specSuccessCriteria: "- success-metric",
        executionPlanMarkdown: "## Saved plan\n\n- step for spec workspace test",
        specPromptTemplate: DEFAULT_SPEC_GENERATION_USER_TEMPLATE,
        specPromptPreset: "default",
      }),
    });
    expect(patchRes.status).toBe(200);

    const aiRes = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/spec-workspace`, {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "aiRequest",
        model: "gpt-4o-mini",
        prompt: "MALICIOUS_CLIENT_PROMPT_SHOULD_NOT_BE_USED",
        content: "MALICIOUS_CLIENT_CONTENT_SHOULD_NOT_BE_USED",
      }),
    });
    expect([200, 502, 503].includes(aiRes.status)).toBe(true);

    const wsRes = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/spec-workspace`, {
      cookie,
    });
    expect(wsRes.status).toBe(200);
    const wsJson = (await wsRes.json()) as {
      success?: boolean;
      data?: {
        prompts?: Array<{ promptText?: string }>;
        specPromptConfig?: { templatePrompt?: string; preset?: string };
      };
    };
    expect(wsJson.success).toBe(true);
    expect(wsJson.data?.specPromptConfig?.templatePrompt).toBeTruthy();
    expect(Array.isArray(wsJson.data?.prompts)).toBe(true);
    expect((wsJson.data?.prompts?.length ?? 0) > 0).toBe(true);
    const latestPrompt = wsJson.data?.prompts?.[0]?.promptText ?? "";
    expect(latestPrompt).toContain("workspace goal");
    expect(latestPrompt).not.toContain("MALICIOUS_CLIENT_PROMPT_SHOULD_NOT_BE_USED");
    expect(latestPrompt).not.toContain("MALICIOUS_CLIENT_CONTENT_SHOULD_NOT_BE_USED");
  });
});
