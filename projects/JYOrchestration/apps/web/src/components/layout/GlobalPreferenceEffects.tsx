"use client";

import { useEffect } from "react";
import { subscribeGlobalPreferences } from "@/lib/preferences/globalPreferences";

export function GlobalPreferenceEffects() {
  useEffect(() => {
    // Kept as a stable cross-tab preferences sync hook.
    // UI-only preferences were removed; we only need a re-render trigger in subscribers.
    return subscribeGlobalPreferences(() => {});
  }, []);
  return null;
}
