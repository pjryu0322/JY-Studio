"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SettingsHelpPopoverContentView } from "@/components/settings/SettingsHelpPopover";
import {
  buildAutoGenerationPreflightTableRows,
  preflightHasRemediationBlockers,
  type AutoGenerationPreflightTableRow,
} from "@/lib/prototype/autoGenerationPreflightDisplay";
import { getGithubPreflightHelpContent } from "@/lib/prototype/githubProviderPreflightHelp";
import type { GithubProviderPreflightResultV1 } from "@/lib/prototype/githubProviderPreflightTypes";
import { prototypeEnvReadinessToneColors } from "@/lib/project/prototypeEnvSettingsReadiness";

const HELP_POPOVER_Z_INDEX = 70;

type HelpPopoverPlacement = Readonly<{
  readonly top: number;
  readonly left: number;
  readonly width: number;
}>;

function computeHelpPopoverPlacement(trigger: HTMLElement, popoverHeight: number): HelpPopoverPlacement {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(420, window.innerWidth - 24);
  let left = rect.right - width;
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  const gap = 8;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
  const spaceAbove = rect.top - gap - 12;
  let top = rect.bottom + gap;
  if (popoverHeight > spaceBelow && spaceAbove > spaceBelow) {
    top = Math.max(12, rect.top - popoverHeight - gap);
  }
  top = Math.max(12, Math.min(top, window.innerHeight - popoverHeight - 12));
  return { top, left, width };
}

export function AutoGenerationPreflightPanel(input: {
  readonly preflight: GithubProviderPreflightResultV1 | null;
  readonly onFocusGithubToken?: () => void;
  readonly onOpenActionsPermissionGuide?: () => void;
  readonly onRetestConnection?: () => void;
  readonly retestDisabled?: boolean;
}) {
  const rows = buildAutoGenerationPreflightTableRows({ preflight: input.preflight });
  const showRemediation = preflightHasRemediationBlockers(input.preflight);

  const [openHelpKey, setOpenHelpKey] = useState<AutoGenerationPreflightTableRow["key"] | null>(null);
  const [helpPlacement, setHelpPlacement] = useState<HelpPopoverPlacement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});

  const repositionHelpPopover = useCallback(() => {
    if (!openHelpKey) {
      setHelpPlacement(null);
      return;
    }
    const trigger = triggerRefs.current[openHelpKey];
    if (!trigger) return;
    const measuredHeight = popoverRef.current?.offsetHeight ?? 320;
    setHelpPlacement(computeHelpPopoverPlacement(trigger, measuredHeight));
  }, [openHelpKey]);

  useLayoutEffect(() => {
    repositionHelpPopover();
  }, [openHelpKey, repositionHelpPopover]);

  useLayoutEffect(() => {
    if (!openHelpKey) return;
    const popover = popoverRef.current;
    if (!popover) return;
    const observer = new ResizeObserver(() => repositionHelpPopover());
    observer.observe(popover);
    return () => observer.disconnect();
  }, [openHelpKey, repositionHelpPopover]);

  useEffect(() => {
    if (!openHelpKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpenHelpKey(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("[data-auto-gen-preflight-help-trigger]")) return;
      if (popoverRef.current?.contains(t)) return;
      setOpenHelpKey(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openHelpKey]);

  const helpContent = openHelpKey ? getGithubPreflightHelpContent(openHelpKey) : null;

  const helpPopoverStyle: CSSProperties | undefined = helpPlacement
    ? {
        position: "fixed",
        top: helpPlacement.top,
        left: helpPlacement.left,
        width: helpPlacement.width,
        zIndex: HELP_POPOVER_Z_INDEX,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: "#fff",
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
        wordBreak: "keep-all",
        maxHeight: "min(70vh, calc(100vh - 24px))",
        overflowY: "auto",
      }
    : undefined;

  const helpPortal =
    openHelpKey && helpPlacement && helpContent && typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            ref={popoverRef}
            data-testid={`auto-gen-preflight-help-${openHelpKey}`}
            style={helpPopoverStyle}
          >
            <SettingsHelpPopoverContentView {...helpContent} />
          </div>,
          document.body,
        )
      : null;

  const btnStyle: CSSProperties = {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
    cursor: "pointer",
  };

  return (
    <div data-testid="auto-generation-preflight-panel" style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>자동 생성 사전점검</div>
      {!input.preflight ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          연결 테스트를 실행하면 Preview 배포에 필요한 GitHub 권한을 함께 확인합니다.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                {["항목", "상태", "현재 값/결과", "도움말"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 10px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#64748b",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const colors = prototypeEnvReadinessToneColors(row.statusTone);
                return (
                  <tr key={row.key} data-testid={`auto-gen-preflight-row-${row.key}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "#334155" }}>{row.label}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontWeight: 800, color: colors.color }}>{row.status}</span>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        color: "#475569",
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.currentValue}
                    >
                      {row.currentValue}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button
                        type="button"
                        ref={(el) => {
                          triggerRefs.current[row.key] = el;
                        }}
                        aria-label={`${row.label} 도움말`}
                        aria-expanded={openHelpKey === row.key}
                        data-auto-gen-preflight-help-trigger
                        onClick={() => setOpenHelpKey((prev) => (prev === row.key ? null : row.key))}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          border: "1px solid #cbd5e1",
                          background: openHelpKey === row.key ? "#f1f5f9" : "#fff",
                          color: "#475569",
                          fontWeight: 900,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        ?
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showRemediation ? (
        <div
          data-testid="auto-gen-preflight-remediation-actions"
          style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          <button type="button" style={btnStyle} onClick={() => input.onFocusGithubToken?.()}>
            GitHub Token 재설정
          </button>
          <button
            type="button"
            style={btnStyle}
            onClick={() => {
              setOpenHelpKey("actions_workflow_dispatch");
              input.onOpenActionsPermissionGuide?.();
            }}
          >
            권한 설정 가이드
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={input.retestDisabled}
            onClick={() => input.onRetestConnection?.()}
          >
            연결 테스트 다시 실행
          </button>
        </div>
      ) : null}
      {helpPortal}
    </div>
  );
}
