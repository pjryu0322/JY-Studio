import Link from "next/link";
import { Suspense } from "react";
import { AuthRequiredCard } from "@/components/AuthRequiredCard";
import { ProviderPackEditor } from "@/components/ProviderPackEditor";
import { ProviderRequiredCard } from "@/components/ProviderRequiredCard";
import { getUserIdFromCookies } from "@/lib/auth-session";
import { getProviderProfileByUserId } from "@/lib/provider-profile-service";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function ProviderPackDetailPage({ params }: PageProps) {
  const { packId } = await params;
  const userId = await getUserIdFromCookies();

  if (!userId) {
    return (
      <div className="space-y-4">
        <Link
          href={ROUTES.provider}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
        >
          ← 제공자 센터
        </Link>
        <AuthRequiredCard />
      </div>
    );
  }

  const profile = await getProviderProfileByUserId(userId);
  if (!profile) {
    return (
      <div className="space-y-4">
        <Link
          href={ROUTES.provider}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
        >
          ← 제공자 센터
        </Link>
        <ProviderRequiredCard />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.provider}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 제공자 센터
      </Link>
      <Suspense fallback={<p className="text-sm text-store-muted">불러오는 중…</p>}>
        <ProviderPackEditor packId={packId} />
      </Suspense>
    </div>
  );
}
