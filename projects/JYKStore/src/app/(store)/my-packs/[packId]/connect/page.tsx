import { ConnectPageClient } from "@/components/ConnectPageClient";
import { NotFoundState } from "@/components/NotFoundState";
import { getPackById } from "@/lib/pack-utils";
import { ROUTES } from "@/lib/routes";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function MyPackConnectPage({ params }: PageProps) {
  const { packId } = await params;
  const pack = getPackById(packId);

  if (!pack) {
    return (
      <NotFoundState
        title="지식팩을 찾을 수 없습니다."
        description="Pack ID를 확인하거나 지식팩 목록에서 다시 선택해 주세요."
        ctaLabel="지식팩 둘러보기"
        ctaHref={ROUTES.packs}
      />
    );
  }

  return <ConnectPageClient pack={pack} />;
}
