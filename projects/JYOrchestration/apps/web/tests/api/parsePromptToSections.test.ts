import { describe, expect, it } from "vitest";
import { buildWorkspacePromptText } from "@/lib/project-spec/buildWorkspacePromptText";
import { parsePromptToSections } from "@/lib/project-spec/parsePromptToSections";
import type { Project } from "@/components/project-spec/types";

describe("parsePromptToSections", () => {
  it("parses buildWorkspacePromptText output", () => {
    const p: Project = {
      id: "x",
      name: "Demo",
      description: "Desc",
      projectType: "web-service",
      status: "ACTIVE",
      specCoreGoals: "Goal one",
      specScopeIn: "In A\n- In B",
      specScopeOut: "Out",
      specTargetUsers: "Users",
      specSuccessCriteria: "OK",
    };
    const text = buildWorkspacePromptText(p);
    const s = parsePromptToSections(text);
    expect(s.projectInfo.name).toBe("Demo");
    expect(s.projectInfo.description).toBe("Desc");
    expect(s.projectInfo.projectType).toBe("web-service");
    expect(s.coreGoals).toContain("Goal one");
    expect(s.inScope.length).toBeGreaterThanOrEqual(1);
    expect(s.extraBlocks.some((b) => b.title === "역할·지시")).toBe(true);
  });
});
