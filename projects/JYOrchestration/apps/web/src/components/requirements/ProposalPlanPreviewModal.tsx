"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";

type Pos = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function ProposalPlanPreviewModal({
  open,
  title,
  markdown,
  busy,
  onClose,
  onRegenerate,
  onConfirm,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly markdown: string;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onRegenerate: () => void;
  readonly onConfirm: () => void;
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
    const w = Math.min(window.innerWidth * 0.92, 720);
    const margin = 8;
    return {
      x: clamp(Math.round((window.innerWidth - w) / 2), margin, Math.max(margin, window.innerWidth - w - margin)),
      y: clamp(Math.round(window.innerHeight * 0.06), margin, Math.max(margin, window.innerHeight - 160)),
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const headerCursor = useMemo(() => ({ cursor: busy ? "default" : ("grab" as const) }), [busy]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="배경 닫기"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 82,
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
        aria-label="기획안 미리보기"
        style={{
          position: "fixed",
          zIndex: 83,
          left: pos.x,
          top: pos.y,
          width: "min(92vw, 720px)",
          maxHeight: "min(88vh, 900px)",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 24px 64px -20px rgba(15, 23, 42, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          onPointerDown={onHeaderPointerDown}
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
            background: "#f8fafc",
            userSelect: "none",
            touchAction: "none",
            ...headerCursor,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 0.3 }}>드래그하여 이동</span>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", lineHeight: 1.35 }}>{title}</div>
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
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 18px" }}>
          <RequirementsAiMessageMarkdown text={markdown} variant="default" />
        </div>
        <div
          style={{
            padding: "12px 16px 16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "flex-end",
            flexShrink: 0,
            background: "#fff",
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              if (dragRef.current.moved) return;
              onClose();
            }}
            style={{
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 900,
              color: "#334155",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            닫기
          </button>
          <button
            type="button"
            disabled={busy}
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
              color: "#334155",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            재생성
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              if (dragRef.current.moved) return;
              onConfirm();
            }}
            style={{
              border: "1px solid #0f766e",
              background: "#ecfdf5",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 900,
              color: "#065f46",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            확정
          </button>
        </div>
      </div>
    </>
  );
}
