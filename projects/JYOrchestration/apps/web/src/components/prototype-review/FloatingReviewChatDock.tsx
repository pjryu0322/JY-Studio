"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

const STORAGE_KEY = "jyo-prototype-review-floating-chat-dock";

const MARGIN = 12;
const MIN_W = 300;
const MIN_H = 220;
const TOOLBAR_H = 40;

type DockPersist = {
  x: number;
  y: number;
  w: number;
  h: number;
  surfaceAlpha: number;
  minimized: boolean;
};

const DEFAULT_ALPHA = 0.92;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function loadPersist(): Partial<DockPersist> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<DockPersist>;
  } catch {
    return null;
  }
}

function savePersist(p: DockPersist) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function FloatingReviewChatDock(p: {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly children: (surfaceAlpha: number) => ReactNode;
}) {
  const saved = useRef(loadPersist());
  const [d, setD] = useState<DockPersist>(() => ({
    x: typeof saved.current?.x === "number" ? saved.current.x : MARGIN,
    y: typeof saved.current?.y === "number" ? saved.current.y : MARGIN,
    w: typeof saved.current?.w === "number" ? saved.current.w : 408,
    h: typeof saved.current?.h === "number" ? saved.current.h : 500,
    surfaceAlpha: typeof saved.current?.surfaceAlpha === "number" ? saved.current.surfaceAlpha : DEFAULT_ALPHA,
    minimized: Boolean(saved.current?.minimized),
  }));

  const dragRef = useRef<{ mx: number; my: number; x: number; y: number } | null>(null);
  const resizeRef = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 컴포넌트 인스턴스당 1회 배치(Strict Mode 재마운트 시 ref 초기화됨) */
  const positionedRef = useRef(false);

  const boundsFor = useCallback(() => {
    const el = p.containerRef.current;
    if (!el) return { rw: 800, rh: 600 };
    const r = el.getBoundingClientRect();
    return { rw: r.width, rh: r.height };
  }, [p.containerRef]);

  const clampDock = useCallback(
    (next: DockPersist): DockPersist => {
      const { rw, rh } = boundsFor();
      if (rw < MIN_W + 24 || rh < MIN_H + 24) return next;
      const w = clamp(next.w, MIN_W, rw - 2 * MARGIN);
      const h = clamp(next.h, MIN_H, rh - 2 * MARGIN);
      const x = clamp(next.x, MARGIN, rw - w - MARGIN);
      const y = clamp(next.y, MARGIN, rh - h - MARGIN);
      return { ...next, x, y, w, h };
    },
    [boundsFor],
  );

  /** 저장 좌표 보정 또는 최초 우하단 배치 */
  useLayoutEffect(() => {
    const el = p.containerRef.current;
    if (!el || positionedRef.current) return;
    positionedRef.current = true;
    const hadSavedXY =
      saved.current != null &&
      typeof saved.current.x === "number" &&
      typeof saved.current.y === "number" &&
      !Number.isNaN(saved.current.x) &&
      !Number.isNaN(saved.current.y);
    if (hadSavedXY) {
      setD((prev) => clampDock(prev));
    } else {
      setD((prev) => {
        const { rw, rh } = boundsFor();
        const w = clamp(prev.w, MIN_W, rw - 2 * MARGIN);
        const h = clamp(prev.h, MIN_H, rh - 2 * MARGIN);
        const x = clamp(rw - w - MARGIN, MARGIN, rw - w - MARGIN);
        const y = clamp(rh - h - MARGIN, MARGIN, rh - h - MARGIN);
        return { ...prev, x, y, w, h };
      });
    }
  }, [boundsFor, clampDock, p.containerRef]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => savePersist(d), 200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [d]);

  useEffect(() => {
    const el = p.containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setD((prev) => clampDock(prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.containerRef, clampDock]);

  const onToolbarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragRef.current = { mx: e.clientX, my: e.clientY, x: d.x, y: d.y };
      const onMove = (ev: MouseEvent) => {
        const st = dragRef.current;
        if (!st) return;
        const dx = ev.clientX - st.mx;
        const dy = ev.clientY - st.my;
        setD((prev) => clampDock({ ...prev, x: st.x + dx, y: st.y + dy }));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [d.x, d.y, clampDock],
  );

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = { mx: e.clientX, my: e.clientY, w: d.w, h: d.h };
      const onMove = (ev: MouseEvent) => {
        const st = resizeRef.current;
        if (!st) return;
        const dw = ev.clientX - st.mx;
        const dh = ev.clientY - st.my;
        setD((prev) => {
          const { rw, rh } = boundsFor();
          const maxW = rw - prev.x - MARGIN;
          const maxH = rh - prev.y - MARGIN;
          return clampDock({
            ...prev,
            w: clamp(st.w + dw, MIN_W, maxW),
            h: clamp(st.h + dh, MIN_H, maxH),
          });
        });
      };
      const onUp = () => {
        resizeRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [d.w, d.h, boundsFor, clampDock],
  );

  const toolbarAlpha = Math.min(1, Math.max(0.12, d.surfaceAlpha));
  const toolbar: CSSProperties = {
    height: TOOLBAR_H,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 8px 0 10px",
    borderBottom: `1px solid ${t.border}`,
    background: `rgba(255, 255, 255, ${toolbarAlpha})`,
    cursor: "grab",
    userSelect: "none",
    boxSizing: "border-box",
  };

  const outer: CSSProperties = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.minimized ? TOOLBAR_H : d.h,
    zIndex: 30,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    borderRadius: t.radiusLg,
    overflow: "hidden",
    boxShadow: "0 16px 48px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.06)",
  };

  const body: CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  };

  return (
    <div style={outer} aria-label="검토 대화 플로팅 창">
      <div style={toolbar} onMouseDown={onToolbarMouseDown} role="toolbar" aria-label="창 도구 모음">
        <span style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary, flexShrink: 0 }}>검토 대화</span>
        <span
          style={{ fontSize: 10, color: t.textMuted, flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}
          title="이 줄을 드래그하면 창을 이동합니다"
        >
          · 드래그로 이동
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, fontSize: 11, color: t.textMuted }}>
          투명도
          <input
            type="range"
            min={35}
            max={100}
            step={1}
            value={Math.round(d.surfaceAlpha * 100)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setD((prev) => ({ ...prev, surfaceAlpha: clamp(v / 100, 0.35, 1) }));
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="창 배경 투명도"
            style={{ width: 72 }}
          />
        </label>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setD((prev) => ({ ...prev, minimized: !prev.minimized }))}
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: t.radiusMd,
            border: `1px solid ${t.border}`,
            background: `rgba(248, 250, 252, ${Math.min(1, toolbarAlpha + 0.06)})`,
            cursor: "pointer",
            color: t.textPrimary,
          }}
        >
          {d.minimized ? "펼치기" : "최소화"}
        </button>
      </div>

      {!d.minimized ? (
        <div style={body}>
          {p.children(d.surfaceAlpha)}
          <button
            type="button"
            aria-label="창 크기 조절"
            onMouseDown={onResizeMouseDown}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 18,
              height: 18,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "nwse-resize",
              color: t.textMuted,
              fontSize: 11,
              lineHeight: 1,
              zIndex: 2,
            }}
          >
            ◢
          </button>
        </div>
      ) : null}
    </div>
  );
}
