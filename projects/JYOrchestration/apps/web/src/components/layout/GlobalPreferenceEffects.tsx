"use client";

import { useEffect } from "react";
import { readGlobalPreferencesSnapshot, subscribeGlobalPreferences } from "@/lib/preferences/globalPreferences";

function applyDomFromSnapshot(): void {
  if (typeof document === "undefined") return;
  const { compactMode, reduceMotion } = readGlobalPreferencesSnapshot();
  document.documentElement.dataset.jyoCompact = compactMode ? "1" : "0";
  document.documentElement.dataset.jyoReduceMotion = reduceMotion ? "1" : "0";
}

export function GlobalPreferenceEffects() {
  useEffect(() => {
    applyDomFromSnapshot();
    return subscribeGlobalPreferences(applyDomFromSnapshot);
  }, []);
  return null;
}
