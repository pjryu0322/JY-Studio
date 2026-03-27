import { describe, expect, it } from "vitest";
import { buildSpecPrompt, buildWorkspacePromptText } from "@/lib/project-spec/buildWorkspacePromptText";
import { parsePromptToSections } from "@/lib/project-spec/parsePromptToSections";
import type { Project } from "@/components/project-spec/types";

describe("parsePromptToSections", () => {
  it("parses legacy workspace prompt sections", () => {
    const text = `[프로젝트 정보]
- 프로젝트명: Demo
- 설명: Desc
- 유형: web-service

[Spec 정의 입력]
- 핵심 목표: Goal one
- In scope: In A
- In B
- Out of scope: Out
- 대상 사용자: Users
- 성공 기준: OK
`;
    const s = parsePromptToSections(text);
    expect(s.projectInfo.name).toBe("Demo");
    expect(s.projectInfo.description).toBe("Desc");
    expect(s.projectInfo.projectType).toBe("web-service");
    expect(s.coreGoals).toContain("Goal one");
    expect(s.inScope.length).toBeGreaterThanOrEqual(1);
    expect(s.extraBlocks.some((b) => b.title === "역할·지시")).toBe(false);
  });
});

describe("buildSpecPrompt", () => {
  it("embeds saved execution plan and model lens", () => {
    const t = buildSpecPrompt({
      title: "Demo",
      description: "Desc",
      planMarkdown: "## 실행 계획\n\n본문",
      modelId: "gpt-4o",
    });
    expect(t).toContain("[저장된 실행 계획");
    expect(t).toContain("본문");
    expect(t).toContain("API·데이터 모델");
  });

  it("buildWorkspacePromptText requires execution plan", () => {
    const p: Project = {
      id: "x",
      name: "Demo",
      description: "Desc",
      projectType: "web-service",
      status: "ACTIVE",
    };
    expect(() => buildWorkspacePromptText(p)).toThrow("EXECUTION_PLAN_REQUIRED");
  });
});
