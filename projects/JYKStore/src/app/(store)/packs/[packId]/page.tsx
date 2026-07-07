import { PackDetailHero } from "@/components/PackDetailHero";
import { PackDetailSection } from "@/components/PackDetailSection";
import { PackFeatureList } from "@/components/PackFeatureList";
import { NotFoundState } from "@/components/NotFoundState";
import { getPackById } from "@/lib/pack-utils";
import { ROUTES } from "@/lib/routes";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function PackDetailPage({ params }: PageProps) {
  const { packId } = await params;
  const pack = getPackById(packId);

  if (!pack) {
    return (
      <NotFoundState
        title="지식팩을 찾을 수 없습니다."
        description="다른 지식팩을 둘러보세요."
        ctaLabel="지식팩 둘러보기"
        ctaHref={ROUTES.packs}
      />
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <PackDetailHero pack={pack} />
      <PackDetailSection title="개요">
        <p className="text-sm leading-relaxed text-slate-700">{pack.overview}</p>
      </PackDetailSection>
      <PackDetailSection title="주요 기능">
        <PackFeatureList items={pack.features} />
      </PackDetailSection>
      <PackDetailSection title="포함 지식">
        <PackFeatureList items={pack.includedKnowledge} />
      </PackDetailSection>
      <PackDetailSection title="지원 환경">
        <PackFeatureList items={pack.supportedEnvironments} />
      </PackDetailSection>
      <PackDetailSection title="사용 대상">
        <PackFeatureList items={pack.targetUsers} />
      </PackDetailSection>
      <PackDetailSection title="활용 예시">
        <PackFeatureList items={pack.useCases} />
      </PackDetailSection>
      <PackDetailSection title="버전 이력">
        <ul className="space-y-3">
          {pack.versionHistory.map((entry) => (
            <li key={entry.version} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">
                v{entry.version}{" "}
                <span className="font-normal text-store-muted">· {entry.date}</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">{entry.summary}</p>
            </li>
          ))}
        </ul>
      </PackDetailSection>
      <PackDetailSection title="제공자 정보">
        <p className="text-sm font-semibold text-slate-900">{pack.providerInfo.name}</p>
        <p className="mt-1 text-sm text-slate-700">{pack.providerInfo.description}</p>
      </PackDetailSection>
    </div>
  );
}
