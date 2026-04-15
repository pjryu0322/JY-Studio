"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readUiLabelsEnabled, subscribe } from "@/lib/ui-label/useUiLabel";

const ScreenLabelsContext = createContext<boolean>(false);

export function ScreenLabelsProvider({ children }: { readonly children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setVisible(readUiLabelsEnabled());
      setReady(true);
    });
    const off = subscribe(() => setVisible(readUiLabelsEnabled()));
    const onStorage = () => setVisible(readUiLabelsEnabled());
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useMemo(() => (ready ? visible : false), [ready, visible]);

  return <ScreenLabelsContext.Provider value={value}>{children}</ScreenLabelsContext.Provider>;
}

export function useShowScreenLabels(): boolean {
  return useContext(ScreenLabelsContext);
}
