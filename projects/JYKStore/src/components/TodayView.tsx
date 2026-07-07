"use client";

import { useCallback } from "react";
import { PackCard } from "@/components/PackCard";
import { SectionHeader } from "@/components/SectionHeader";
import {
  mockPacks,
  getNewPacks,
  getPopularPacks,
  getPublishedPacks,
  getQuickConnectPacks,
} from "@/data/mock-packs";
import { ROUTES } from "@/lib/routes";

export function TodayView() {
  const todayPick = mockPacks.find((p) => p.packId === "easy-auth") ?? mockPacks[0];
  const quickConnect = getQuickConnectPacks(mockPacks);
  const popular = getPopularPacks(mockPacks);
  const newest = getNewPacks(mockPacks);
  const published = getPublishedPacks(mockPacks);

  const handleAdd = useCallback(() => {
    // Phase 3: persist to my-packs
  }, []);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          title="오늘의 추천 지식팩"
          subtitle="검증된 지식팩으로 반복되는 연동 지식 탐색 시간을 줄입니다."
          actionLabel="전체 보기"
          actionHref={ROUTES.search}
        />
        <PackCard pack={todayPick} onAddToLibrary={handleAdd} />
      </section>
      <section>
        <SectionHeader title="빠르게 연동 가능한 지식팩" subtitle="JYK Verified · 공개" />
        <div className="space-y-3">
          {quickConnect.map((pack) => (
            <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
          ))}
        </div>
      </section>
      <section>
        <SectionHeader title="인기 지식팩" subtitle="많이 활용된 지식팩" />
        <div className="space-y-3">
          {popular.map((pack) => (
            <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
          ))}
        </div>
      </section>
      <section>
        <SectionHeader title="신규 지식팩" subtitle="최근 업데이트" />
        <div className="space-y-3">
          {newest.map((pack) => (
            <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
          ))}
        </div>
      </section>
      <section>
        <SectionHeader
          title="카테고리별 추천"
          subtitle="인증 · 프레임워크"
          actionLabel="전체 보기"
          actionHref={ROUTES.categories}
        />
        <div className="space-y-3">
          {published.slice(0, 2).map((pack) => (
            <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
          ))}
        </div>
      </section>
    </div>
  );
}
