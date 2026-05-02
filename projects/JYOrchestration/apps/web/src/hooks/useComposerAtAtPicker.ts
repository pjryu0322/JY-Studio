"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import {
  mergeComposerAtAtPick,
  normalizeComposerAtAtPickerItems,
  parseComposerAtAtTrigger,
} from "@/lib/composer/composerAtAtPicker";

export function useComposerAtAtPicker(options: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly items?: readonly ComposerAtAtPickerItem[] | undefined;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const normalizedItems = useMemo(
    () => normalizeComposerAtAtPickerItems(options.items ?? []),
    [options.items],
  );
  const hasItems = normalizedItems.length > 0;
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [lastAtAtIndex, setLastAtAtIndex] = useState<number | null>(null);

  const closeTargetPicker = useCallback(() => {
    setTargetPickerOpen(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- @@ 트리거는 value에서 파생 */
  useEffect(() => {
    if (!hasItems) {
      setTargetPickerOpen(false);
      setLastAtAtIndex(null);
      return;
    }
    const { open, lastIndex } = parseComposerAtAtTrigger(options.value);
    if (!open) {
      setTargetPickerOpen(false);
      setLastAtAtIndex(null);
      return;
    }
    setLastAtAtIndex(lastIndex);
    setTargetPickerOpen(true);
  }, [options.value, hasItems]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { value, onChange, textareaRef } = options;
  const pickTargetItem = useCallback(
    (targets: readonly { id: string; name: string }[]) => {
      if (!targets.length || lastAtAtIndex === null || lastAtAtIndex < 0) return;
      const merged = mergeComposerAtAtPick(value, lastAtAtIndex, targets);
      onChange(merged);
      setTargetPickerOpen(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [lastAtAtIndex, value, onChange, textareaRef],
  );

  return {
    targetPickerOpen: targetPickerOpen && hasItems,
    normalizedTargetPickerItems: normalizedItems,
    lastAtAtIndex,
    closeTargetPicker,
    pickTargetItem,
  };
}
