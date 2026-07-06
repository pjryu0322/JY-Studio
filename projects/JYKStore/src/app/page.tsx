"use client";

import { useCallback, useMemo, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { PackCard } from "@/components/PackCard";
import { SectionHeader } from "@/components/SectionHeader";
import {
  MOCK_KNOWLEDGE_PACKS,
  STORE_CATEGORIES,
  getNewPacks,
  getPacksByCategory,
  getPopularPacks,
  getPublishedPacks,
  getQuickConnectPacks,
} from "@/data/mock-packs";
import type { BottomTabId } from "@/types/knowledge-pack";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<BottomTabId>("today");
  const [libraryIds, setLibraryIds] = useState<ReadonlySet<string>>(() => new Set());

  const todayPick = useMemo(
    () => MOCK_KNOWLEDGE_PACKS.find((p) => p.packId === "easy-auth") ?? MOCK_KNOWLEDGE_PACKS[0],
    [],
  );
  const quickConnect = useMemo(() => getQuickConnectPacks(MOCK_KNOWLEDGE_PACKS), []);
  const popular = useMemo(() => getPopularPacks(MOCK_KNOWLEDGE_PACKS), []);
  const newest = useMemo(() => getNewPacks(MOCK_KNOWLEDGE_PACKS), []);
  const published = useMemo(() => getPublishedPacks(MOCK_KNOWLEDGE_PACKS), []);

  const handleAdd = useCallback((packId: string) => {
    setLibraryIds((prev) => new Set([...prev, packId]));
  }, []);

  const tabPanel = (() => {
    switch (activeTab) {
      case "search":
        return (
          <div className="rounded-2xl border border-dashed border-store-border bg-white p-8 text-center text-sm text-store-muted">
            검색 화면은 다음 단계에서 연결됩니다.
          </div>
        );
      case "categories":
        return (
          <div className="space-y-4">
            {STORE_CATEGORIES.map((cat) => {
              const items = getPacksByCategory(MOCK_KNOWLEDGE_PACKS, cat);
              if (!items.length) return null;
              return (
                <section key={cat}>
                  <SectionHeader title={cat} subtitle={`${items.length}개 지식팩`} />
                  <div className="space-y-3">
                    {items.map((pack) => (
                      <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        );
      case "library":
        return (
          <div className="space-y-3">
            <SectionHeader title="내 지식팩" subtitle={`${libraryIds.size}개 추가됨`} />
            {libraryIds.size === 0 ? (
              <p className="rounded-2xl bg-white p-6 text-center text-sm text-store-muted">
                홈에서 지식팩을 추가하면 여기에 표시됩니다.
              </p>
            ) : (
              MOCK_KNOWLEDGE_PACKS.filter((p) => libraryIds.has(p.packId)).map((pack) => (
                <PackCard key={pack.packId} pack={pack} />
              ))
            )}
          </div>
        );
      case "account":
        return (
          <div className="rounded-2xl bg-white p-6 text-sm text-slate-700 shadow-card">
            <h2 className="text-lg font-bold">계정</h2>
            <p className="mt-2 text-store-muted">
              API Key 발급, Pack ID 복사, 연동 예시 코드는 향후 단계에서 제공됩니다.
            </p>
          </div>
        );
      default:
        return (
          <div className="space-y-8">
            <section>
              <SectionHeader title="오늘의 추천 지식팩" subtitle="에디터 추천" actionLabel="더 보기" />
              {todayPick ? <PackCard pack={todayPick} onAddToLibrary={handleAdd} /> : null}
            </section>
            <section>
              <SectionHeader title="빠르게 연동 가능한 지식팩" subtitle="Verified · Published" />
              <div className="space-y-3">
                {quickConnect.map((pack) => (
                  <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
                ))}
              </div>
            </section>
            <section>
              <SectionHeader title="인기 지식팩" />
              <div className="space-y-3">
                {popular.map((pack) => (
                  <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
                ))}
              </div>
            </section>
            <section>
              <SectionHeader title="신규 지식팩" />
              <div className="space-y-3">
                {newest.map((pack) => (
                  <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
                ))}
              </div>
            </section>
            <section>
              <SectionHeader title="카테고리별 추천" subtitle="인증 · 프레임워크" />
              <div className="space-y-3">
                {published.slice(0, 2).map((pack) => (
                  <PackCard key={pack.packId} pack={pack} onAddToLibrary={handleAdd} />
                ))}
              </div>
            </section>
          </div>
        );
    }
  })();

  return (
    <MobileShell activeTab={activeTab} onTabChange={setActiveTab}>
      {tabPanel}
    </MobileShell>
  );
}
