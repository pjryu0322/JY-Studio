"use client";

import { MyPackCard } from "@/components/MyPackCard";
import { MyPacksEmptyState } from "@/components/MyPacksEmptyState";
import { useMyPacks } from "@/hooks/useMyPacks";

export function MyPacksPageClient() {
  const { mounted, myPacks } = useMyPacks();

  if (!mounted) {
    return <div className="min-h-[200px] rounded-2xl bg-slate-50" aria-hidden />;
  }

  if (myPacks.length === 0) {
    return <MyPacksEmptyState />;
  }

  return (
    <div className="space-y-3">
      {myPacks.map((pack) => (
        <MyPackCard key={pack.packId} pack={pack} />
      ))}
    </div>
  );
}
