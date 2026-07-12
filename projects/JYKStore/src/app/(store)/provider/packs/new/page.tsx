import Link from "next/link";
import { AuthRequiredCard } from "@/components/AuthRequiredCard";
import { ProviderRequiredCard } from "@/components/ProviderRequiredCard";
import { getUserIdFromCookies } from "@/lib/auth-session";
import {
  createClientId,
  JYKSTORE_CLIENT_ID_COOKIE,
} from "@/lib/client-identity";
import { ensureProviderProfileForAccount } from "@/lib/provider-profile-service";
import {
  PROVIDER_PACK_NEW_BLOCKED_BODY,
  PROVIDER_PACK_NEW_BLOCKED_TITLE,
  PROVIDER_PAYLOAD_IMPORT_PREP_HINT,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ProviderPackNewPage() {
  const userId = await getUserIdFromCookies();

  if (!userId) {
    return <AuthRequiredCard />;
  }

  const jar = await cookies();
  const clientId = jar.get(JYKSTORE_CLIENT_ID_COOKIE)?.value ?? createClientId();
  const ensured = await ensureProviderProfileForAccount({ userId, clientId });
  if (!ensured.ok) {
    return <ProviderRequiredCard />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h1 className="text-lg font-bold text-slate-900">{PROVIDER_PACK_NEW_BLOCKED_TITLE}</h1>
        <p className="mt-2 text-sm leading-relaxed text-store-muted">
          {PROVIDER_PACK_NEW_BLOCKED_BODY}
        </p>
        <p className="mt-2 text-xs text-store-muted">{PROVIDER_PAYLOAD_IMPORT_PREP_HINT}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={ROUTES.provider}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
          >
            Provider Center로 돌아가기
          </Link>
          <Link
            href={`${ROUTES.provider}#provider-packs`}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-store-border px-4 text-sm font-semibold text-slate-800"
          >
            기존 지식팩 관리
          </Link>
        </div>
      </div>
    </div>
  );
}
