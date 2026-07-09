import type { QuotaSummaryDto } from "@/lib/quota-service";

type QuotaTopEndpointsListProps = {
  endpoints: QuotaSummaryDto["topEndpoints"];
};

export function QuotaTopEndpointsList({ endpoints }: QuotaTopEndpointsListProps) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">Top endpoints</h2>
      <ul className="mt-3 space-y-2">
        {endpoints.map((item) => (
          <li
            key={item.endpoint}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs"
          >
            <span className="min-w-0 break-all font-mono text-slate-800">{item.endpoint}</span>
            <span className="shrink-0 font-bold text-slate-700">{item.requestCount}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
