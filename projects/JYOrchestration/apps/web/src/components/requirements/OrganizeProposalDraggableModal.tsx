"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Pos = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function OrganizeProposalDraggableModal({
  open,
  onClose,
  busy,
  showRegenerate,
  regenerateDisabled,
  onRegenerate,
  onStart,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly busy: boolean;
  readonly showRegenerate: boolean;
  readonly regenerateDisabled: boolean;
  readonly onRegenerate: () => void;
  readonly onStart: () => void;
  readonly children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const center = useCallback(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const w = Math.min(520, window.innerWidth - 24);
    const h = 360;
    return {
      x: clamp(Math.round((window.innerWidth - w) / 2), 8, Math.max(8, window.innerWidth - w - 8)),
      y: clamp(Math.round((window.innerHeight - h) / 3), 8, Math.max(8, window.innerHeight - 120)),
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setPos(center());
  }, [open, center]);

  const boundsDrag = useCallback(() => {
    const el = dialogRef.current;
    if (!el || typeof window === "undefined") return { minX: 8, minY: 8, maxX: 8, maxY: 8 };
    const rect = el.getBoundingClientRect();
    const margin = 8;
    return {
      minX: margin,
      minY: margin,
      maxX: Math.max(margin, window.innerWidth - rect.width - margin),
      maxY: Math.max(margin, window.innerHeight - rect.height - margin),
    };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragRef.current.moved = true;
      const { minX, minY, maxX, maxY } = boundsDrag();
      setPos({
        x: clamp(dragRef.current.originX + dx, minX, maxX),
        y: clamp(dragRef.current.originY + dy, minY, maxY),
      });
    },
    [boundsDrag]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    dragRef.current.moved = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [onPointerMove]);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("button")) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [endDrag, onPointerMove, pos.x, pos.y]
  );

  useEffect(() => {
    return () => endDrag();
  }, [endDrag]);

  const headerCursor = useMemo(() => ({ cursor: busy ? "default" : "grab" as const }), [busy]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="배경 닫기"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 80,
          border: 0,
          padding: 0,
          margin: 0,
          background: "rgba(15, 23, 42, 0.45)",
          cursor: "pointer",
        }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="정리 요청"
        style={{
          position: "fixed",
          zIndex: 81,
          left: pos.x,
          top: pos.y,
          width: "min(520px, calc(100vw - 24px))",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 30px 80px -30px rgba(15, 23, 42, 0.45)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          onPointerDown={onHeaderPointerDown}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "12px 14px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            userSelect: "none",
            touchAction: "none",
            ...headerCursor,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 0.4 }}>드래그하여 이동</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>정리 요청</span>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 999,
              width: 36,
              height: 36,
              fontSize: 18,
              lineHeight: 1,
              fontWeight: 800,
              color: "#475569",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 16, fontSize: 14, color: "#334155", lineHeight: 1.55 }}>{children}</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "flex-end",
            padding: "12px 16px 16px",
            borderTop: "1px solid #f1f5f9",
            background: "#fff",
          }}
        >
          {showRegenerate ? (
            <button
              type="button"
              disabled={busy || regenerateDisabled}
              onClick={(e) => {
                e.stopPropagation();
                if (dragRef.current.moved) return;
                onRegenerate();
              }}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 900,
                cursor: busy || regenerateDisabled ? "not-allowed" : "pointer",
                opacity: busy || regenerateDisabled ? 0.55 : 1,
                color: "#334155",
              }}
            >
              재생성
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              if (dragRef.current.moved) return;
              onStart();
            }}
            style={{
              border: "1px solid #0f766e",
              background: "#0f766e",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
              color: "#fff",
            }}
          >
            시작
          </button>
        </div>
      </div>
    </>
  );
}
