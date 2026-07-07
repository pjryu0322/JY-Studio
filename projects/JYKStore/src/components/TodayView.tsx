"use client";

import { useCallback } from "react";
import { PackList } from "@/components/PackList";
import { SectionHeader } from "@/components/SectionHeader";
import {
  getNewPacks,
  getPopularPacks,
  getPublishedPacks,
  getQuickConnectPacks,
} from "@/lib/pack-utils";
import { mockPacks } from "@/data/mock-packs";
import { ROUTES, categoryDetailPath } from "@/lib/routes";

export function TodayView() {
  const todayPick = mockPacks.find((p) => p.packId === "easy-auth") ?? mockPacks[0];
  const quickConnect = getQuickConnectPacks(mockPacks);
  const popular = getPopularPacks(mockPacks);
  const newest = getNewPacks(mockPacks);
  const published = getPublishedPacks();

  const handleAdd = useCallback(() => {
    window.alert("Phase 3에서 내 지식팩 추가 기능이 연결됩니다.");
  }, []);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          title="오늘의 추천 지식팩"
          subtitle="검증된 지식팩으로 반복되는 연동 지식 탐색 시간을 줄입니다."
          actionLabel="전체 보기"
          actionHref={ROUTES.packs}
        />
        <PackList packs={[todayPick]} onAddToLibrary={handleAdd} />
      </section>
      <section>
        <SectionHeader title="빠르게 연동 가능한 지식팩" subtitle="JYK Verified · 공개" />
        <PackList packs={quickConnect} onAddToLibrary={handleAdd} />
      </section>
      <section>
        <SectionHeader title="인기 지식팩" subtitle="많이 활용된 지식팩" actionLabel="전체 보기" actionHref={ROUTES.packs} />
        <PackList packs={popular} onAddToLibrary={handleAdd} />
      </section>
      <section>
        <SectionHeader title="신규 지식팩" subtitle="최근 업데이트" />
        <PackList packs={newest} onAddToLibrary={handleAdd} />
      </section>
      <section>
        <SectionHeader
          title="카테고리별 추천"
          subtitle="인증 · 프레임워크"
          actionLabel="전체 보기"
          actionHref={categoryDetailPath("auth")}
        />
        <PackList packs={published.slice(0, 2)} onAddToLibrary={handleAdd} />
      </section>
    </div>
  );
}
