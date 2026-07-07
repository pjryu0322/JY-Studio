import { FREE_PLAN_POLICY } from "@/lib/plan-policy";

export const RATE_LIMIT_POLICY = {
  plan: FREE_PLAN_POLICY.planName.toUpperCase(),
  enforcement: FREE_PLAN_POLICY.enforcement,
  blockingEnabled: FREE_PLAN_POLICY.blockingEnabled,
  perMinuteWarning: FREE_PLAN_POLICY.contextApiMinuteWarning,
  perDayWarning: FREE_PLAN_POLICY.contextApiDailyWarning,
  description: FREE_PLAN_POLICY.description,
} as const;

export type RateLimitPolicyDto = {
  plan: string;
  enforcement: string;
  blockingEnabled: boolean;
  perMinuteWarning: number;
  perDayWarning: number;
  description: string;
};

export function getRateLimitPolicyDto(): RateLimitPolicyDto {
  return {
    plan: RATE_LIMIT_POLICY.plan,
    enforcement: RATE_LIMIT_POLICY.enforcement,
    blockingEnabled: RATE_LIMIT_POLICY.blockingEnabled,
    perMinuteWarning: RATE_LIMIT_POLICY.perMinuteWarning,
    perDayWarning: RATE_LIMIT_POLICY.perDayWarning,
    description: RATE_LIMIT_POLICY.description,
  };
}
