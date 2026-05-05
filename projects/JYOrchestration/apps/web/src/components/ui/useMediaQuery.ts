"use client";

import { useSyncExternalStore } from "react";

function subscribeMediaQuery(query: string, onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getMediaQuerySnapshot(query: string): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
}

/**
 * SSR·하이드레이션 안전 `matchMedia`.
 * 서버 및 클라이언트 첫 페인트는 `getServerSnapshot`(false)과 일치해야 하므로,
 * 좁은 화면이라도 마운트 후에만 `true`로 바뀝니다.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => subscribeMediaQuery(query, cb),
    () => getMediaQuerySnapshot(query),
    () => false,
  );
}

