import { cookies } from "next/headers";
import { Suspense } from "react";
import { AuthRequiredCard } from "@/components/AuthRequiredCard";
import { ProviderPackEditor } from "@/components/ProviderPackEditor";
import { ProviderRequiredCard } from "@/components/ProviderRequiredCard";
import { getUserIdFromCookies } from "@/lib/auth-session";
import {
  createClientId,
  JYKSTORE_CLIENT_ID_COOKIE,
} from "@/lib/client-identity";
import { ensureProviderProfileForAccount } from "@/lib/provider-profile-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function ProviderPackDetailPage({ params }: PageProps) {
  const { packId } = await params;
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
    <Suspense fallback={<p className="text-sm text-store-muted">불러오는 중…</p>}>
      <ProviderPackEditor packId={packId} />
    </Suspense>
  );
}
