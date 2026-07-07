import type { KnowledgePack, KnowledgePackPricing } from "@/types/pack";

function formatUsage(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatRating(rating: number): string {
  if (rating <= 0) return "—";
  return rating.toFixed(1);
}

function pricingLabel(pricing: KnowledgePackPricing): string {
  switch (pricing) {
    case "FREE":
      return "무료";
    case "PAID":
      return "유료";
    case "ENTERPRISE":
      return "엔터프라이즈";
  }
}

export function PackMetaGrid({ pack }: { readonly pack: KnowledgePack }) {
  const items = [
    { label: "평점", value: `★ ${formatRating(pack.rating)}` },
    { label: "사용", value: `${formatUsage(pack.usageCount)}회` },
    { label: "버전", value: `v${pack.version}` },
    { label: "업데이트", value: pack.updatedAt },
    { label: "가격", value: pricingLabel(pack.pricing) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-store-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
