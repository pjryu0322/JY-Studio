import { ProviderCenterPageClient } from "@/components/ProviderCenterPageClient";
import { PROVIDER_CENTER_TAGLINE } from "@/lib/role-based-ux-copy";

export default function ProviderCenterPage() {
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">지식팩 제공자 센터</h1>
        <p className="mt-1 text-sm text-store-muted">{PROVIDER_CENTER_TAGLINE}</p>
      </div>
      <ProviderCenterPageClient />
    </div>
  );
}
