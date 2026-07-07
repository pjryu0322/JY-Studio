import type { Prisma } from "@prisma/client";
import type { AdminPlanOverviewDto, PlanUsageSummaryDto } from "@/lib/billing-dto";
import { getFreePlanPolicyDto } from "@/lib/plan-policy";
import { prisma } from "@/lib/prisma";

const contextApiWhere: Prisma.ApiUsageLogWhereInput = {
  AND: [
    { endpoint: { contains: "/api/v1/packs/" } },
    { endpoint: { contains: "/context" } },
  ],
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function isError(statusCode: number): boolean {
  return statusCode >= 400;
}

export async function getAccountPlanSummary(clientId: string): Promise<PlanUsageSummaryDto> {
  const plan = getFreePlanPolicyDto();
  const todayStart = startOfToday();
  const monthStart = startOfMonth();

  const logs = await prisma.apiUsageLog.findMany({
    where: contextApiWhere,
    select: { statusCode: true, latencyMs: true, createdAt: true },
  });

  let todayContextRequests = 0;
  let monthContextRequests = 0;
  let todayErrorCount = 0;
  let monthErrorCount = 0;
  let latencySum = 0;
  let latencyCount = 0;

  for (const log of logs) {
    const isToday = log.createdAt >= todayStart;
    const isMonth = log.createdAt >= monthStart;
    const errored = isError(log.statusCode);

    if (isToday) {
      todayContextRequests += 1;
      if (errored) todayErrorCount += 1;
    }
    if (isMonth) {
      monthContextRequests += 1;
      if (errored) monthErrorCount += 1;
    }
    if (typeof log.latencyMs === "number") {
      latencySum += log.latencyMs;
      latencyCount += 1;
    }
  }

  const totalContextRequests = logs.length;
  const dailyWarning = plan.contextApiDailyWarning;
  const monthlyLimit = plan.contextApiMonthlyLimit;

  return {
    generatedAt: new Date().toISOString(),
    clientId,
    plan,
    usage: {
      todayContextRequests,
      monthContextRequests,
      totalContextRequests,
      todayErrorCount,
      monthErrorCount,
      averageLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
    },
    allowance: {
      blockingEnabled: plan.blockingEnabled,
      dailyWarning,
      monthlyLimit,
      dailyWarningReached: todayContextRequests >= dailyWarning,
      monthlyLimitReached: monthlyLimit !== null && monthContextRequests >= monthlyLimit,
    },
    billing: {
      billingEnabled: plan.billingEnabled,
      paymentRequired: plan.paymentRequired,
      currentAmountKrw: 0,
      nextBillingAt: null,
      message: "현재 전체 무료 정책으로 청구가 발생하지 않습니다.",
    },
  };
}

export async function getAdminPlanOverview(): Promise<AdminPlanOverviewDto> {
  const plan = getFreePlanPolicyDto();
  const todayStart = startOfToday();
  const monthStart = startOfMonth();

  const [totalApiKeys, totalContextRequestsToday, totalContextRequestsMonth, distinctApiKeys] =
    await Promise.all([
      prisma.apiKey.count(),
      prisma.apiUsageLog.count({
        where: { AND: [contextApiWhere, { createdAt: { gte: todayStart } }] },
      }),
      prisma.apiUsageLog.count({
        where: { AND: [contextApiWhere, { createdAt: { gte: monthStart } }] },
      }),
      prisma.apiUsageLog.findMany({
        where: { apiKeyId: { not: null } },
        distinct: ["apiKeyId"],
        select: { apiKeyId: true },
      }),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    plan,
    totalApiKeys,
    totalContextRequestsToday,
    totalContextRequestsMonth,
    totalClientsApprox: distinctApiKeys.length,
    billingEnabled: plan.billingEnabled,
    paymentRequired: plan.paymentRequired,
  };
}
