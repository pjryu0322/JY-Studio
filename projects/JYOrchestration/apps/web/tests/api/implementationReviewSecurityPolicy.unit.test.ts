import { describe, expect, it } from "vitest";
import { evaluateCodeTaskReviewSecurityPolicy } from "@/lib/prototype/implementationReviewSecurityPolicy";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

function baseTask(overrides: Partial<ImplementationCodeTaskV1> = {}): ImplementationCodeTaskV1 {
  return {
    codeTaskId: "CT-1",
    parentTaskId: "DEV-1",
    title: "작업",
    description: "",
    changeType: "unknown",
    targetHints: [],
    dependencies: [],
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    priority: "P1",
    status: "ready",
    blockers: [],
    ...overrides,
  };
}

describe("evaluateCodeTaskReviewSecurityPolicy", () => {
  it("skips ai security for simple ui component work", () => {
    const result = evaluateCodeTaskReviewSecurityPolicy({
      codeTask: baseTask({
        changeType: "component",
        title: "버튼 스타일 조정",
        candidateFiles: ["components/Button.tsx"],
      }),
    });
    expect(result.securityPolicy).toBe("skip");
    expect(["skip", "lightweight"]).toContain(result.reviewPolicy);
  });

  it("requires ai security for auth-related work", () => {
    const result = evaluateCodeTaskReviewSecurityPolicy({
      codeTask: baseTask({
        changeType: "api",
        title: "로그인 인증 API",
        candidateFiles: ["app/api/auth/login/route.ts"],
      }),
    });
    expect(result.securityPolicy).toBe("ai_required");
    expect(result.riskReasons.join(" ")).toMatch(/auth|permission|token|api/i);
  });

  it("requires review and security for db/api paths", () => {
    const result = evaluateCodeTaskReviewSecurityPolicy({
      codeTask: baseTask({
        changeType: "data",
        candidateFiles: ["app/api/users/route.ts", "prisma/schema.prisma"],
      }),
    });
    expect(result.reviewPolicy).toBe("ai_required");
    expect(["ai_required", "lightweight"]).toContain(result.securityPolicy);
  });
});
