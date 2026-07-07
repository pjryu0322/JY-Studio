"use client";

import type { KnowledgePack } from "@/types/pack";
import { PackCard } from "@/components/PackCard";

export function PackList(p: {
  readonly packs: readonly KnowledgePack[];
  readonly onAddToLibrary?: (packId: string) => void;
}) {
  if (!p.packs.length) {
    return null;
  }
  return (
    <div className="space-y-3">
      {p.packs.map((pack) => (
        <PackCard key={pack.packId} pack={pack} onAddToLibrary={p.onAddToLibrary} />
      ))}
    </div>
  );
}
