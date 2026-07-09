import type { QuotaSummaryDto } from "@/lib/quota-service";

type QuotaPolicyCardProps = {
  policy: QuotaSummaryDto["policy"];
};

export function QuotaPolicyCard({ policy }: QuotaPolicyCardProps) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">Quota policy</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
        <div>
          <dt className="text-store-muted">Plan</dt>
          <dd className="font-semibold">{policy.plan}</dd>
        </div>
        <div>
          <dt className="text-store-muted">Enforcement</dt>
          <dd className="font-semibold">{policy.enforcement}</dd>
        </div>
        <div>
          <dt className="text-store-muted">Per minute</dt>
          <dd className="font-semibold">{policy.perMinuteRequests}</dd>
        </div>
        <div>
          <dt className="text-store-muted">Per day</dt>
          <dd className="font-semibold">{policy.perDayRequests}</dd>
        </div>
      </dl>
    </section>
  );
}
