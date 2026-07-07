"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mockPacks } from "@/data/mock-packs";
import type { KnowledgePack } from "@/types/pack";
import {
  addStoredMyPack,
  getStoredMyPackIds,
  isStoredMyPack,
  removeStoredMyPack,
} from "@/lib/my-packs-storage";

export function useMyPacks() {
  const [mounted, setMounted] = useState(false);
  const [packIds, setPackIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setPackIds(getStoredMyPackIds());
  }, []);

  const myPacks = useMemo<KnowledgePack[]>(() => {
    return packIds
      .map((packId) => mockPacks.find((pack) => pack.packId === packId))
      .filter((pack): pack is KnowledgePack => Boolean(pack));
  }, [packIds]);

  const addMyPack = useCallback((packId: string) => {
    const next = addStoredMyPack(packId);
    setPackIds(next);
  }, []);

  const removeMyPack = useCallback((packId: string) => {
    const next = removeStoredMyPack(packId);
    setPackIds(next);
  }, []);

  const isMyPack = useCallback(
    (packId: string) => {
      if (!mounted) return false;
      return packIds.includes(packId) || isStoredMyPack(packId);
    },
    [mounted, packIds],
  );

  return {
    mounted,
    packIds,
    myPacks,
    addMyPack,
    removeMyPack,
    isMyPack,
  };
}
