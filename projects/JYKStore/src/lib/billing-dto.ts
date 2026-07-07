import type { PlanPolicyDto } from "@/lib/plan-policy";

export type PlanUsageSummaryDto = {
  generatedAt: string;
  clientId: string;
  plan: PlanPolicyDto;
  usage: {
    todayContextRequests: number;
    monthContextRequests: number;
    totalContextRequests: number;
    todayErrorCount: number;
    monthErrorCount: number;
    averageLatencyMs: number;
  };
  allowance: {
    blockingEnabled: boolean;
    dailyWarning: number;
    monthlyLimit: number | null;
    dailyWarningReached: boolean;
    monthlyLimitReached: boolean;
  };
  billing: {
    billingEnabled: boolean;
    paymentRequired: boolean;
    currentAmountKrw: number;
    nextBillingAt: string | null;
    message: string;
  };
};

export type AdminPlanOverviewDto = {
  generatedAt: string;
  plan: PlanPolicyDto;
  totalApiKeys: number;
  totalContextRequestsToday: number;
  totalContextRequestsMonth: number;
  totalClientsApprox: number;
  billingEnabled: boolean;
  paymentRequired: boolean;
};
