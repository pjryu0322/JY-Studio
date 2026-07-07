export const RATE_LIMIT_POLICY = {
  plan: "FREE",
  enforcement: "SOFT",
  blockingEnabled: false,
  perMinuteWarning: 120,
  perDayWarning: 10000,
  description:
    "현재 JYKStore는 전체 무료 정책이며, 초과 시 차단하지 않고 운영 참고용으로만 표시합니다.",
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
