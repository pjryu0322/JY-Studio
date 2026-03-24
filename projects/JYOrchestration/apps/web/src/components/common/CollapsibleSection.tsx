"use client";

import { ReactNode, useEffect, useState } from "react";

type CollapsibleSectionProps = {
  title: string;
  /** 비제어: 초기 펼침 */
  defaultOpen: boolean;
  children: ReactNode;
  /** 제어 모드: 열림 상태 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 제목 옆 보조 설명 */
  subtitle?: string;
};

/**
 * 접기/펼치기 섹션 (초보자 모드에서 고급 기능 숨김용).
 */
export function CollapsibleSection({
  title,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
  children,
  subtitle,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    if (!isControlled) {
      queueMicrotask(() => {
        setInternalOpen(defaultOpen);
      });
    }
  }, [defaultOpen, isControlled]);

  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
      onOpenChange?.(next);
    }
  };

  return (
    <section
      style={{
        marginBottom: 16,
        border: "1px solid #e0e0e0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 14px",
          background: "#fafafa",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 15,
          color: "#263238",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 2,
        }}
      >
        <span>
          {open ? "▼ " : "▶ "}
          {title}
        </span>
        {subtitle ? (
          <span style={{ fontSize: 12, fontWeight: 400, color: "#78909c" }}>{subtitle}</span>
        ) : null}
      </button>
      {open ? (
        <div style={{ padding: "12px 14px 16px", borderTop: "1px solid #eeeeee" }}>{children}</div>
      ) : null}
    </section>
  );
}
