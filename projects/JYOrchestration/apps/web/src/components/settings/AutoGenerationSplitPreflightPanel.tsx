"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { SettingsHelpPopoverContentView } from "@/components/settings/SettingsHelpPopover";
import { ConnectionCheckResultTable } from "@/components/settings/ConnectionCheckResultTable";
import {
  buildEnvcheckTableRows,
  buildPreviewPreflightTableRows,
  splitPreflightNeedsRemediation,
} from "@/lib/prototype/autoGenerationSplitPreflightDisplay";
import type { AutoGenerationSettingsConnectionTestResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { getAutoGenerationPreflightHelpContent } from "@/lib/prototype/autoGenerationPreflightHelpContent";
import { coerceNormalizedConnectionTestResult, normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

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

function summaryCardStyle(highlight: boolean): CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: highlight ? "1px solid #fcd34d" : "1px solid #e2e8f0",
    background: highlight ? "#fffbeb" : "#f8fafc",
    fontSize: 12,
    color: "#334155",
    lineHeight: 1.5,
  };
}

export function AutoGenerationSplitPreflightPanel(input: {
  readonly connectionTest: AutoGenerationSettingsConnectionTestResultV1 | null;
  readonly connectionTestAttempted?: boolean;
  readonly onFocusGithubToken?: () => void;
  readonly onRetestConnection?: () => void;
  readonly retestDisabled?: boolean;
}) {
  const coerced = (() => {
    if (input.connectionTest) return coerceNormalizedConnectionTestResult(input.connectionTest);
    if (input.connectionTestAttempted) {
      return normalizeAutoGenerationConnectionTestResult({ checkedAt: new Date().toISOString() });
    }
    return null;
  })();

  const showPlaceholder = !input.connectionTestAttempted && !input.connectionTest;
  const envRows = coerced ? buildEnvcheckTableRows(coerced) : [];
  const previewRows = coerced ? buildPreviewPreflightTableRows(coerced) : [];
  const showRemediation = splitPreflightNeedsRemediation(coerced);

  const [openHelpKey, setOpenHelpKey] = useState<string | null>(null);
  const [helpPlacement, setHelpPlacement] = useState<HelpPopoverPlacement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});

  const helpRowKey = openHelpKey?.includes(":") ? openHelpKey.split(":").slice(1).join(":") : null;

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
      if (t.closest?.("[data-split-preflight-help-trigger]")) return;
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

  const helpContent = helpRowKey
    ? getAutoGenerationPreflightHelpContent(helpRowKey as never)
    : null;

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
        maxHeight: "min(70vh, calc(100vh - 24px))",
        overflowY: "auto",
      }
    : undefined;

  const helpPortal =
    openHelpKey && helpPlacement && helpContent && typeof document !== "undefined"
      ? createPortal(
          <div ref={popoverRef} role="tooltip" data-testid="split-preflight-help-popover" style={helpPopoverStyle}>
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
    <div data-testid="auto-generation-split-preflight-panel">
      <ConnectionCheckResultTable
        title="자동 생성 기본 점검"
        testId="auto-gen-envcheck"
        rows={envRows}
        showPlaceholder={showPlaceholder}
        openHelpKey={openHelpKey}
        onToggleHelp={(k) => setOpenHelpKey((prev) => (prev === k ? null : k))}
        triggerRefs={triggerRefs}
      />
      <ConnectionCheckResultTable
        title="Preview 배포 사전점검"
        testId="auto-gen-preview-preflight"
        rows={previewRows}
        showPlaceholder={showPlaceholder}
        openHelpKey={openHelpKey}
        onToggleHelp={(k) => setOpenHelpKey((prev) => (prev === k ? null : k))}
        triggerRefs={triggerRefs}
      />
      {coerced ? (
        <div
          data-testid="auto-gen-split-status-messages"
          style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div style={summaryCardStyle(!coerced.autoGenerationReady)}>
            <strong>기본 연결 상태:</strong> {coerced.sectionSummaries.basicConnection}
          </div>
          <div style={summaryCardStyle(coerced.envcheck.some((c) => c.required && c.status === "failed"))}>
            <strong>자동 생성 기본 점검:</strong> {coerced.sectionSummaries.envcheck}
          </div>
          <div
            style={summaryCardStyle(
              !coerced.previewDeploymentReady && coerced.autoGenerationReady,
            )}
          >
            <strong>Preview 배포 사전점검:</strong> {coerced.sectionSummaries.previewDeploymentPreflight}
          </div>
        </div>
      ) : null}
      {showRemediation ? (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={btnStyle} onClick={() => input.onFocusGithubToken?.()}>
            GitHub Token 재설정
          </button>
          <button
            type="button"
            style={btnStyle}
            onClick={() => setOpenHelpKey("auto-gen-preview-preflight:actions_workflow_dispatch")}
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
