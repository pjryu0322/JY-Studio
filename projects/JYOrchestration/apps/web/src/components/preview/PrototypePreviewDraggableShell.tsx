"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Position = { readonly x: number; readonly y: number };

function clampPosition(x: number, y: number, width: number, height: number): Position {
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxX = Math.max(pad, vw - width - pad);
  const maxY = Math.max(pad, vh - height - pad);
  return { x: Math.min(maxX, Math.max(pad, x)), y: Math.min(maxY, Math.max(pad, y)) };
}

export function PrototypePreviewDraggableShell({
  open,
  onClose,
  title,
  children,
  modalWidth = "min(960px, calc(100vw - 32px))",
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  /** CSS width for the dialog panel (e.g. min(1180px, calc(100vw - 20px))) */
  readonly modalWidth?: string;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 24 });
  const dragRef = useRef<{ pointerId: number; originX: number; originY: number; startX: number; startY: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const el = modalRef.current;
      const w = el?.offsetWidth ?? Math.min(960, window.innerWidth - 32);
      const h = el?.offsetHeight ?? 420;
      const { x, y } = clampPosition((window.innerWidth - w) / 2, 24, w, h);
      setPosition({ x, y });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const el = modalRef.current;
    if (!el) return;
    dragRef.current = {
      pointerId: e.pointerId,
      originX: position.x,
      originY: position.y,
      startX: e.clientX,
      startY: e.clientY,
    };
    try {
      headerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const box = modalRef.current;
      const w = box?.offsetWidth ?? 960;
      const h = box?.offsetHeight ?? 400;
      const nx = drag.originX + (ev.clientX - drag.startX);
      const ny = drag.originY + (ev.clientY - drag.startY);
      setPosition(clampPosition(nx, ny, w, h));
    };

    const onUp = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        headerRef.current?.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 48,
        background: "rgba(15,23,42,0.45)",
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(ev) => ev.stopPropagation()}
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          width: modalWidth,
          maxHeight: "min(106vh, 1035px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          background: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
          overflow: "hidden",
        }}
      >
        <div
          ref={headerRef}
          onPointerDown={onHeaderPointerDown}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            cursor: "grab",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
              fontSize: 12.5,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ padding: 16, overflowY: "auto", flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}
