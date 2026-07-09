import type { QuotaSummaryDto } from "@/lib/quota-service";

type QuotaTopClientsListProps = {
  clients: QuotaSummaryDto["topClients"];
};

export function QuotaTopClientsList({ clients }: QuotaTopClientsListProps) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">Top clients</h2>
      <ul className="mt-3 space-y-2">
        {clients.length === 0 ? (
          <li className="text-sm text-store-muted">데이터 없음</li>
        ) : (
          clients.map((client) => (
            <li
              key={client.clientId}
              className="rounded-xl border border-slate-100 px-3 py-2 text-xs"
            >
              <p className="font-mono text-slate-800">{client.clientId}</p>
              <p className="mt-1 text-store-muted">
                requests {client.requestCount} · exceeded {client.quotaExceededCount} · keys{" "}
                {client.uniqueApiKeyCount}
                {client.topEndpoint ? ` · ${client.topEndpoint}` : ""}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
