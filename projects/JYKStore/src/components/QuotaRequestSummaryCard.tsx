type QuotaRequestSummaryCardProps = {
  totalRequests: number;
  quotaExceededCount: number;
};

export function QuotaRequestSummaryCard({
  totalRequests,
  quotaExceededCount,
}: QuotaRequestSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">요청 요약</h2>
      <p className="mt-2 text-sm text-slate-800">
        총 요청 <span className="font-bold">{totalRequests}</span> · 429/초과{" "}
        <span className="font-bold text-red-700">{quotaExceededCount}</span>
      </p>
    </section>
  );
}
