"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type ChatTextSelectionBubble = Readonly<{
  readonly text: string;
  readonly left: number;
  readonly top: number;
}>;

export function useChatTextSelectionToolbar(input: {
  readonly enabled: boolean;
  readonly minLength?: number;
}): {
  readonly chatRootRef: RefObject<HTMLDivElement | null>;
  readonly selectionToolbarRef: RefObject<HTMLDivElement | null>;
  readonly selectionBubble: ChatTextSelectionBubble | null;
  readonly clearSelectionBubble: () => void;
  readonly dismissSelectionToolbar: () => void;
} {
  const minLength = input.minLength ?? 2;
  const chatRootRef = useRef<HTMLDivElement | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<ChatTextSelectionBubble | null>(null);

  const clearSelectionBubble = useCallback(() => setSelectionBubble(null), []);

  const dismissSelectionToolbar = useCallback(() => {
    setSelectionBubble(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!input.enabled || !selectionBubble) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const node = e.target as Node | null;
      if (!node) return;
      if (selectionToolbarRef.current?.contains(node)) return;
      dismissSelectionToolbar();
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [input.enabled, selectionBubble, dismissSelectionToolbar]);

  useEffect(() => {
    if (!input.enabled || !selectionBubble) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dismissSelectionToolbar();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [input.enabled, selectionBubble, dismissSelectionToolbar]);

  useEffect(() => {
    if (!input.enabled || !selectionBubble) return;
    const root = chatRootRef.current;
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        if (selectionBubble) dismissSelectionToolbar();
        return;
      }
      if (!root || sel.rangeCount === 0) {
        if (selectionBubble) dismissSelectionToolbar();
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        if (selectionBubble) dismissSelectionToolbar();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [input.enabled, selectionBubble, dismissSelectionToolbar]);

  useEffect(() => {
    if (!input.enabled) return;
    const onMouseUp = () => {
      window.requestAnimationFrame(() => {
        const root = chatRootRef.current;
        const sel = window.getSelection();
        if (!root || !sel || sel.isCollapsed) {
          setSelectionBubble(null);
          return;
        }
        if (sel.rangeCount === 0) {
          setSelectionBubble(null);
          return;
        }
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) {
          setSelectionBubble(null);
          return;
        }
        const text = sel.toString().replace(/\u00a0/g, " ").trim();
        if (text.length < minLength) {
          setSelectionBubble(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        setSelectionBubble({
          text,
          left: rect.left + rect.width / 2,
          top: rect.top,
        });
      });
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [input.enabled, minLength]);

  useEffect(() => {
    if (!input.enabled) return;
    const root = chatRootRef.current;
    if (!root) return;
    const onScroll = () => setSelectionBubble(null);
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [input.enabled, selectionBubble?.text]);

  return {
    chatRootRef,
    selectionToolbarRef,
    selectionBubble,
    clearSelectionBubble,
    dismissSelectionToolbar,
  };
}
