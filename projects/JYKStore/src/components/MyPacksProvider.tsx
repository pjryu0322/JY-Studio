"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { KnowledgePack } from "@/types/pack";
import { addMyPackApi, fetchMyPacks, removeMyPackApi } from "@/lib/my-packs-api";

export type MyPacksContextValue = {
  mounted: boolean;
  loading: boolean;
  error: string | null;
  packIds: string[];
  myPacks: KnowledgePack[];
  refreshMyPacks: () => Promise<void>;
  addMyPack: (packId: string) => Promise<void>;
  removeMyPack: (packId: string) => Promise<void>;
  isMyPack: (packId: string) => boolean;
};

export const MyPacksContext = createContext<MyPacksContextValue | null>(null);

export function MyPacksProvider({ children }: { readonly children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myPacks, setMyPacks] = useState<KnowledgePack[]>([]);

  const refreshMyPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyPacks();
      setMyPacks(data.items);
    } catch (err) {
      setMyPacks([]);
      setError(err instanceof Error ? err.message : "내 지식팩을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    void refreshMyPacks();
  }, [refreshMyPacks]);

  const packIds = useMemo(() => myPacks.map((pack) => pack.packId), [myPacks]);

  const addMyPack = useCallback(
    async (packId: string) => {
      setError(null);
      try {
        const data = await addMyPackApi(packId);
        setMyPacks((prev) => {
          const without = prev.filter((p) => p.packId !== packId);
          return [data.item, ...without];
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "지식팩을 추가하지 못했습니다.";
        setError(message);
        throw err;
      }
    },
    [],
  );

  const removeMyPack = useCallback(async (packId: string) => {
    setError(null);
    try {
      await removeMyPackApi(packId);
      setMyPacks((prev) => prev.filter((p) => p.packId !== packId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "지식팩을 제거하지 못했습니다.";
      setError(message);
      throw err;
    }
  }, []);

  const isMyPack = useCallback(
    (packId: string) => {
      if (!mounted) return false;
      return packIds.includes(packId);
    },
    [mounted, packIds],
  );

  const value = useMemo<MyPacksContextValue>(
    () => ({
      mounted,
      loading,
      error,
      packIds,
      myPacks,
      refreshMyPacks,
      addMyPack,
      removeMyPack,
      isMyPack,
    }),
    [mounted, loading, error, packIds, myPacks, refreshMyPacks, addMyPack, removeMyPack, isMyPack],
  );

  return <MyPacksContext.Provider value={value}>{children}</MyPacksContext.Provider>;
}
