"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { uiTokens as t } from "@/components/ui/tokens";
import type { WorkflowStepMeta } from "@/lib/workflow/workflowStepMeta";

export type MobileStepSelectorItem = WorkflowStepMeta & {
  readonly href: string;
  readonly active: boolean;
};

export function MobileStepSelector({
  items,
  trailingSlot,
}: {
  readonly items: readonly MobileStepSelectorItem[];
  readonly trailingSlot?: ReactNode;
}) {
  const showScreenLabels = useShowScreenLabels();
  const [open, setOpen] = useState(false);

  const activeLabel = useMemo(() => {
    return items.find((x) => x.active)?.label ?? "단계";
  }, [items]);

  return (
    <div aria-label="프로젝트 워크플로 및 관리" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="단계 메뉴 열기"
        className="relative"
        style={{
          position: "relative",
          minWidth: 0,
          border: 0,
          background: "transparent",
          padding: 0,
          margin: 0,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <ScreenLabel label="공통-상단내비-워크플로우-현재단계" visible={showScreenLabels} />
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            whiteSpace: "normal",
            lineHeight: 1.2,
            maxHeight: "2.4em",
          }}
        >
          {activeLabel}
        </div>
      </button>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {trailingSlot}
      </div>

      {open ? (
        <>
          <button
            type="button"
            aria-label="단계 변경 메뉴 닫기"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 76,
              border: 0,
              padding: 0,
              margin: 0,
              background: "rgba(15, 23, 42, 0.35)",
              cursor: "pointer",
            }}
          />
          <aside
            role="dialog"
            aria-label="프로젝트 단계 변경"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "min(320px, 84vw)",
              zIndex: 77,
              background: "#fff",
              borderRight: `1px solid ${t.border}`,
              boxShadow: "10px 0 40px rgba(15, 23, 42, 0.16)",
              display: "flex",
              flexDirection: "column",
              padding: "14px 14px max(14px, env(safe-area-inset-bottom, 0px))",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>단계 변경</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ border: 0, background: "transparent", color: t.textMuted, fontWeight: 900, cursor: "pointer", padding: "6px 8px", fontSize: 13 }}
              >
                닫기
              </button>
            </div>
            <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
              {items.map((item) => (
                <span key={item.stepId} className="relative">
                  <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      padding: "11px 14px",
                      borderRadius: 12,
                      textDecoration: "none",
                      border: item.active ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                      background: item.active ? `${t.primary}14` : "#fff",
                      color: "#0f172a",
                      fontSize: 14,
                      fontWeight: 800,
                      boxSizing: "border-box",
                    }}
                    aria-current={item.active ? "page" : undefined}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                    {item.active ? <span style={{ fontSize: 12, fontWeight: 900, color: t.primary }}>현재</span> : null}
                  </Link>
                </span>
              ))}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

