"use client";

import type { KnowledgePack } from "@/types/pack";
import { PackCard } from "@/components/PackCard";

export function PackList({ packs }: { readonly packs: readonly KnowledgePack[] }) {
  if (!packs.length) {
    return null;
  }
  return (
    <div className="space-y-3">
      {packs.map((pack) => (
        <PackCard key={pack.packId} pack={pack} />
      ))}
    </div>
  );
}
