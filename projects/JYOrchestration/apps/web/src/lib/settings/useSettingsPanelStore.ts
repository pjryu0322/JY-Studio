"use client";

import { useSyncExternalStore } from "react";
import {
  getSettingsPanelServerSnapshot,
  getSettingsPanelSnapshot,
  subscribeSettingsPanel,
  type SettingsPanelSnapshot,
} from "@/lib/settings/settingsPanelStore";

/** 설정 패널 열림·앵커 구독(단일 전역 스토어). */
export function useSettingsPanelStore(): SettingsPanelSnapshot {
  return useSyncExternalStore(subscribeSettingsPanel, getSettingsPanelSnapshot, getSettingsPanelServerSnapshot);
}
