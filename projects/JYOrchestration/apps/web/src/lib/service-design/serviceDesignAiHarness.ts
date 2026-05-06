export type AiRoleMode = "PRIMARY" | "SUPPORT" | "ADVISORY" | "GATE" | "BLOCKED";

export type ServiceDesignStage = "ideation" | "service-flow" | "feature-planning";

export const SERVICE_DESIGN_AI = {
  ideation: {
    primary: "planner",
    support: ["analyst"],
  },
  "service-flow": {
    primary: "analyst",
    support: ["planner"],
  },
  "feature-planning": {
    primary: "feature_designer",
    support: ["analyst", "designer"],
  },
} as const;
