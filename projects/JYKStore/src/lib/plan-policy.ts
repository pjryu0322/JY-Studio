export const FREE_PLAN_POLICY = {
  planId: "free",
  planName: "Free",
  displayName: "전체 무료",
  priceMonthlyKrw: 0,
  currency: "KRW",
  billingEnabled: false,
  paymentRequired: false,
  enforcement: "SOFT",
  blockingEnabled: false,
  contextApiMonthlyLimit: null,
  contextApiDailyWarning: 10000,
  contextApiMinuteWarning: 120,
  providerPackLimit: null,
  myPackLimit: null,
  apiKeyLimit: null,
  description:
    "현재 JYKStore는 전체 무료 정책으로 운영됩니다. 사용량은 운영 참고용으로만 집계되며 API 호출은 차단하지 않습니다.",
  futurePaidExpansionReady: true,
} as const;

export type PlanPolicyDto = {
  planId: string;
  planName: string;
  displayName: string;
  priceMonthlyKrw: number;
  currency: string;
  billingEnabled: boolean;
  paymentRequired: boolean;
  enforcement: string;
  blockingEnabled: boolean;
  contextApiMonthlyLimit: number | null;
  contextApiDailyWarning: number;
  contextApiMinuteWarning: number;
  providerPackLimit: number | null;
  myPackLimit: number | null;
  apiKeyLimit: number | null;
  description: string;
  futurePaidExpansionReady: boolean;
};

export function getFreePlanPolicyDto(): PlanPolicyDto {
  return {
    planId: FREE_PLAN_POLICY.planId,
    planName: FREE_PLAN_POLICY.planName,
    displayName: FREE_PLAN_POLICY.displayName,
    priceMonthlyKrw: FREE_PLAN_POLICY.priceMonthlyKrw,
    currency: FREE_PLAN_POLICY.currency,
    billingEnabled: FREE_PLAN_POLICY.billingEnabled,
    paymentRequired: FREE_PLAN_POLICY.paymentRequired,
    enforcement: FREE_PLAN_POLICY.enforcement,
    blockingEnabled: FREE_PLAN_POLICY.blockingEnabled,
    contextApiMonthlyLimit: FREE_PLAN_POLICY.contextApiMonthlyLimit,
    contextApiDailyWarning: FREE_PLAN_POLICY.contextApiDailyWarning,
    contextApiMinuteWarning: FREE_PLAN_POLICY.contextApiMinuteWarning,
    providerPackLimit: FREE_PLAN_POLICY.providerPackLimit,
    myPackLimit: FREE_PLAN_POLICY.myPackLimit,
    apiKeyLimit: FREE_PLAN_POLICY.apiKeyLimit,
    description: FREE_PLAN_POLICY.description,
    futurePaidExpansionReady: FREE_PLAN_POLICY.futurePaidExpansionReady,
  };
}
