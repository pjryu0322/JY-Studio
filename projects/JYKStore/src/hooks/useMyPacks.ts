"use client";

import { useContext } from "react";
import { MyPacksContext } from "@/components/MyPacksProvider";

export function useMyPacks() {
  const context = useContext(MyPacksContext);

  if (!context) {
    throw new Error("useMyPacks must be used within MyPacksProvider");
  }

  return context;
}
