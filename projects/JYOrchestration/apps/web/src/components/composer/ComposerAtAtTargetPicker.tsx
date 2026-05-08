"use client";

import { useEffect, useRef } from "react";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";

const DEFAULT_Z = 200;

export function ComposerAtAtTargetPicker(p: {
  readonly open: boolean;
  readonly items: readonly ComposerAtAtPickerItem[];
  readonly onPick: (targets: readonly { id: string; name: string }[]) => void;
  readonly onClose: () => void;
  readonly zIndex?: number;
}) {
  if (!p.open || !p.items.length) return null;
  const z = p.zIndex ?? DEFAULT_Z;
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!p.open) return;

    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      const t = e.target as Node | null;
      if (!root || !t) return;
      if (root.contains(t)) return;
      p.onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [p.open, p.onClose]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="질문 대상 선택"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "calc(100% + 8px)",
        padding: 8,
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 18px 50px -18px rgba(15, 23, 42, 0.25)",
        zIndex: z,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {p.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => p.onPick(item.targets)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
