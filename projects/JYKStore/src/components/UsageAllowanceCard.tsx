import type { PlanUsageSummaryDto } from "@/lib/billing-dto";

export function UsageAllowanceCard({ summary }: { readonly summary: PlanUsageSummaryDto }) {
  const { usage, allowance } = summary;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Context API 사용량</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>오늘 요청: {usage.todayContextRequests.toLocaleString("ko-KR")}</div>
          <div>이번 달 요청: {usage.monthContextRequests.toLocaleString("ko-KR")}</div>
          <div>전체 요청: {usage.totalContextRequests.toLocaleString("ko-KR")}</div>
          <div>평균 latency: {usage.averageLatencyMs}ms</div>
          <div>오늘 오류: {usage.todayErrorCount.toLocaleString("ko-KR")}</div>
          <div>이번 달 오류: {usage.monthErrorCount.toLocaleString("ko-KR")}</div>
        </dl>
      </div>

      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">이용 기준</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>일일 warning: {allowance.dailyWarning.toLocaleString("ko-KR")}</div>
          <div>월 제한: {allowance.monthlyLimit === null ? "제한 없음" : allowance.monthlyLimit.toLocaleString("ko-KR")}</div>
          <div>blocking: {allowance.blockingEnabled ? "on" : "off"}</div>
          <div>
            warning 도달:{" "}
            {allowance.dailyWarningReached ? (
              <span className="font-semibold text-amber-700">예</span>
            ) : (
              "아니오"
            )}
          </div>
        </dl>
        {allowance.dailyWarningReached ? (
          <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            일일 warning 기준을 넘었습니다. 현재 무료 정책이므로 API 호출은 차단되지 않으며 운영 참고용 표시입니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
