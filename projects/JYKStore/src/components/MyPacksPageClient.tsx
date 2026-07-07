"use client";

import { MyPackCard } from "@/components/MyPackCard";
import { MyPacksEmptyState } from "@/components/MyPacksEmptyState";
import { useMyPacks } from "@/hooks/useMyPacks";

export function MyPacksPageClient() {
  const { mounted, loading, myPacks, error } = useMyPacks();

  if (!mounted || loading) {
    return <div className="min-h-[200px] rounded-2xl bg-slate-50" aria-hidden />;
  }

  if (error && myPacks.length === 0) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
        {error}
      </div>
    );
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
