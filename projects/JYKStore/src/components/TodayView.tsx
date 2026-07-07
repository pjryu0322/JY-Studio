import { PackList } from "@/components/PackList";
import { SectionHeader } from "@/components/SectionHeader";
import type { TodayFeaturedPacks } from "@/lib/pack-catalog-service";
import { ROUTES, categoryDetailPath } from "@/lib/routes";

export function TodayView({ featured }: { readonly featured: TodayFeaturedPacks }) {
  const { todayPick, quickConnect, popular, newest, categoryFeatured } = featured;

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          title="오늘의 추천 지식팩"
          subtitle="검증된 지식팩으로 반복되는 연동 지식 탐색 시간을 줄입니다."
          actionLabel="전체 보기"
          actionHref={ROUTES.packs}
        />
        <PackList packs={[todayPick]} />
      </section>
      {quickConnect.length > 0 ? (
        <section>
          <SectionHeader title="빠르게 연동 가능한 지식팩" subtitle="JYK Verified · 공개" />
          <PackList packs={quickConnect} />
        </section>
      ) : null}
      {popular.length > 0 ? (
        <section>
          <SectionHeader
            title="인기 지식팩"
            subtitle="많이 활용된 지식팩"
            actionLabel="전체 보기"
            actionHref={ROUTES.packs}
          />
          <PackList packs={popular} />
        </section>
      ) : null}
      {newest.length > 0 ? (
        <section>
          <SectionHeader title="신규 지식팩" subtitle="최근 업데이트" />
          <PackList packs={newest} />
        </section>
      ) : null}
      {categoryFeatured.length > 0 ? (
        <section>
          <SectionHeader
            title="카테고리별 추천"
            subtitle="인증 · 프레임워크"
            actionLabel="전체 보기"
            actionHref={categoryDetailPath("auth")}
          />
          <PackList packs={categoryFeatured} />
        </section>
      ) : null}
    </div>
  );
}
