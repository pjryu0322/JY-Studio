import type { PlanPolicyDto } from "@/lib/plan-policy";

export function FreePlanPolicyCard({ plan }: { readonly plan: PlanPolicyDto }) {
  return (
    <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-900">현재 플랜: {plan.displayName}</h2>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
          {plan.planName}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>월 이용료: {plan.priceMonthlyKrw.toLocaleString("ko-KR")}원</div>
        <div>통화: {plan.currency}</div>
        <div>결제 필요: {plan.paymentRequired ? "필요" : "없음"}</div>
        <div>billing: {plan.billingEnabled ? "on" : "off"}</div>
        <div>enforcement: {plan.enforcement}</div>
        <div>blocking: {plan.blockingEnabled ? "on" : "off"}</div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-store-muted">{plan.description}</p>
    </div>
  );
}
