import { describe, expect, it } from "vitest";
import { classifyImplementationIntentByRule } from "@/lib/prototype/implementationIntentRouterRule";

describe("classifyImplementationIntentByRule", () => {
  it("routes work plan create phrases to CREATE_WORK_PLAN", () => {
    const c = classifyImplementationIntentByRule("구현 작업안 생성해줘");
    expect(c?.targetAction).toBe("CREATE_WORK_PLAN");
    expect(c?.shouldExecuteAction).toBe(true);
    expect(c?.routerSource).toBe("rule");
  });

  it("defers work plan when user asks for review before create", () => {
    const c = classifyImplementationIntentByRule("작업안 생성 전에 누락 항목 검토해 줘");
    expect(c?.intentType).toBe("implementation_question");
    expect(c?.shouldExecuteAction).toBe(false);
  });

  it("detects mixed requirement and work plan", () => {
    const c = classifyImplementationIntentByRule("업로드는 mp3만 허용하고 구현 작업안 생성해줘");
    expect(c?.intentType).toBe("mixed");
    expect(c?.targetAction).toBe("CREATE_WORK_PLAN");
    expect(c?.requiresPreActionPatch).toBe(true);
    expect(c?.extractedRules.length).toBeGreaterThan(0);
  });
});
