import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { TodayView } from "@/components/TodayView";
import { getStoreAuthSessionFromCookies } from "@/lib/auth-session";
import { listTodayFeaturedPacks } from "@/lib/pack-catalog-service";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getStoreAuthSessionFromCookies();
  if (!session) {
    redirect(ROUTES.login);
  }

  const featured = await listTodayFeaturedPacks();

  if (!featured) {
    return (
      <EmptyState
        title="공개된 지식팩을 준비 중입니다."
        description="제공자가 검수·승인한 지식팩이 공개되면 여기에 표시됩니다."
        ctaLabel="지식팩 둘러보기"
        ctaHref={ROUTES.packs}
      />
    );
  }

  return <TodayView featured={featured} />;
}
