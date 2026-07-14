import type { KnowledgePack, KnowledgePackPricing } from "@/types/pack";
import { packLanguageDisplayLabel } from "@/lib/pack-language";

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
  const items: Array<{ label: string; value: string }> = [
    { label: "버전", value: `v${pack.version}` },
    { label: "업데이트", value: pack.updatedAt },
    { label: "가격", value: pricingLabel(pack.pricing) },
  ];

  if (pack.language === "ko" || pack.language === "en") {
    items.push({ label: "언어", value: packLanguageDisplayLabel(pack.language) });
  }

  if (pack.rating > 0) {
    items.unshift({ label: "평점", value: `★ ${pack.rating.toFixed(1)}` });
  }

  // Hide ambiguous zero usage; show only meaningful positive counts.
  if (pack.usageCount > 0) {
    items.push({
      label: "사용",
      value: pack.usageCount >= 1000 ? `${(pack.usageCount / 1000).toFixed(1)}k회` : `${pack.usageCount}회`,
    });
  }

  return (
    <dl className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-store-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
