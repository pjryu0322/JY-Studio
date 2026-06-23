"use client";

import { useCallback, useEffect, useState } from "react";

export type ProjectGraphContextMenuState =
  | Readonly<{ readonly open: false }>
  | Readonly<{ readonly open: true; readonly kind: "node"; readonly nodeId: string; readonly x: number; readonly y: number }>
  | Readonly<{ readonly open: true; readonly kind: "canvas"; readonly x: number; readonly y: number }>;

export function useProjectGraphContextMenu() {
  const [menu, setMenu] = useState<ProjectGraphContextMenuState>({ open: false });
  const [actionSheetNodeId, setActionSheetNodeId] = useState<string | null>(null);

  const close = useCallback(() => {
    setMenu({ open: false });
    setActionSheetNodeId(null);
  }, []);

  const openNodeMenu = useCallback((nodeId: string, x: number, y: number) => {
    const id = nodeId.trim();
    if (!id) return;
    setActionSheetNodeId(null);
    setMenu({ open: true, kind: "node", nodeId: id, x, y });
  }, []);

  const openCanvasMenu = useCallback((x: number, y: number) => {
    setActionSheetNodeId(null);
    setMenu({ open: true, kind: "canvas", x, y });
  }, []);

  const openNodeActionSheet = useCallback((nodeId: string) => {
    const id = nodeId.trim();
    if (!id) return;
    setMenu({ open: false });
    setActionSheetNodeId(id);
  }, []);

  useEffect(() => {
    if (!menu.open && !actionSheetNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu.open, actionSheetNodeId, close]);

  return {
    menu,
    actionSheetNodeId,
    openNodeMenu,
    openCanvasMenu,
    openNodeActionSheet,
    close,
  };
}
