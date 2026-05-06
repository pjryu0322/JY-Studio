import type { ServiceDesignStage } from "@/lib/service-design/serviceDesignAiHarness";

export type ValidationResult = "ALLOW" | "FORWARD_BLOCK" | "BACKWARD_CONFIRM" | "DEFER";

export function validateStep(input: string, stage: ServiceDesignStage): ValidationResult {
  const t = input.toLowerCase();

  if (stage === "ideation" && t.includes("프로토타입")) {
    return "FORWARD_BLOCK";
  }

  if (stage === "feature-planning" && t.includes("아이디어 다시")) {
    return "BACKWARD_CONFIRM";
  }

  if (t.includes("색상") && stage !== "feature-planning") {
    return "DEFER";
  }

  return "ALLOW";
}
