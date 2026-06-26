"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGraphMobileUx } from "@/components/project-graph/useGraphMobileUx";
import { usePlatformRailCollapsed } from "@/components/layout/platformTopNav/usePlatformRailCollapsed";
import { platformRailOverlayLeftInsetPx } from "@/lib/layout/platformTopNavConstants";
import { uiTokens as t } from "@/components/ui/tokens";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const PRESERVE_RAIL_MODAL_HTML_ATTR = "data-jyo-preserve-platform-rail-modal";

export function ProjectKnowledgeGraphModalShell(p: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly onOpenNewWindow?: () => void;
  /** true면 플랫폼 좌측 레일 영역은 dim/클릭 차단 없이 유지 */
  readonly preservePlatformRail?: boolean;
  readonly children: ReactNode;
}) {
  const graphMobileUx = useGraphMobileUx();
  const [railCollapsed] = usePlatformRailCollapsed();
  const [portalReady, setPortalReady] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        p.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  useEffect(() => {
    if (!p.open) return;
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) return;
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [p.open]);

  const fullscreen = graphMobileUx;
  const railInset =
    p.preservePlatformRail && !fullscreen ? platformRailOverlayLeftInsetPx(railCollapsed) : 0;

  useEffect(() => {
    if (!portalReady || typeof document === "undefined") return;
    const root = document.documentElement;
    if (p.open && p.preservePlatformRail && railInset > 0) {
      root.setAttribute(PRESERVE_RAIL_MODAL_HTML_ATTR, "1");
      return () => root.removeAttribute(PRESERVE_RAIL_MODAL_HTML_ATTR);
    }
    root.removeAttribute(PRESERVE_RAIL_MODAL_HTML_ATTR);
    return undefined;
  }, [p.open, p.preservePlatformRail, portalReady, railInset]);

  if (!p.open || !portalReady || typeof document === "undefined") return null;

  const modalTree = (
    <div
      role="presentation"
      data-testid="project-knowledge-graph-modal-backdrop"
      data-rail-inset={railInset > 0 ? String(railInset) : undefined}
      style={{
        position: "fixed",
        ...(railInset > 0 ? { left: railInset, top: 0, right: 0, bottom: 0 } : { inset: 0 }),
        zIndex: 48,
        background: "rgba(15,23,42,0.45)",
      }}
      onClick={p.onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        onClick={(ev) => ev.stopPropagation()}
        style={{
          position: "fixed",
          ...(fullscreen
            ? { inset: 0, width: "100vw", height: "100dvh", borderRadius: 0 }
            : railInset > 0
              ? {
                  left: railInset + 16,
                  top: 16,
                  right: 16,
                  bottom: 16,
                  borderRadius: 16,
                }
              : {
                  left: "5vw",
                  top: "5vh",
                  width: "90vw",
                  height: "90vh",
                  borderRadius: 16,
                }),
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          border: `1px solid ${t.border}`,
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderBottom: `1px solid ${t.border}`,
            background: "#f8fafc",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>{p.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {p.onOpenNewWindow ? (
              <button
                type="button"
                onClick={p.onOpenNewWindow}
                aria-label="새창으로 열기"
                style={headerBtnStyle}
              >
                새창으로 열기 ↗
              </button>
            ) : null}
            <button type="button" onClick={p.onClose} aria-label="닫기" style={headerBtnStyle}>
              ✕
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: fullscreen ? 8 : 12 }}>
          {p.children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalTree, document.body);
}

const headerBtnStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
};
