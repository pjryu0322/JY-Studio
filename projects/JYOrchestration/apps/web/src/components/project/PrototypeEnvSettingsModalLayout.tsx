"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  type PrototypeEnvModalRowKey,
  type PrototypeEnvModalTableRow,
} from "@/lib/project/prototypeEnvSettingsModalRows";
import { prototypeEnvReadinessToneColors } from "@/lib/project/prototypeEnvSettingsReadiness";
import {
  GITHUB_TOKEN_CORE_PERMISSION_LINES,
  GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_GUIDE_INTRO,
  GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_PERMISSION_LINES,
} from "@/lib/prototype/githubProviderPermissionGuide";

const GITHUB_FINE_GRAINED_TOKEN_NEW_URL = "https://github.com/settings/personal-access-tokens/new" as const;
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

function HelpTitle({ children }: { readonly children: ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>{children}</div>;
}

function HelpSubTitle({ children }: { readonly children: ReactNode }) {
  return <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: "#334155" }}>{children}</div>;
}

function HelpList({ children }: { readonly children: ReactNode }) {
  return (
    <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
      {children}
    </ul>
  );
}

function RowHelpPopover({ rowKey }: { readonly rowKey: PrototypeEnvModalRowKey }) {
  if (rowKey === "repo") {
    return (
      <>
        <HelpTitle>GitHub 저장소 확인 방법</HelpTitle>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
          GitHub 저장소 주소에서 <strong>owner/repo</strong> 부분만 입력합니다.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
          예: <code style={{ fontSize: 12 }}>https://github.com/pjryu0322/aiproject</code> →{" "}
          <code style={{ fontSize: 12 }}>pjryu0322/aiproject</code>
        </div>
        <HelpSubTitle>확인할 것</HelpSubTitle>
        <HelpList>
          <li>저장소가 실제로 존재하는지</li>
          <li>현재 GitHub 계정이 저장소에 접근 가능한지</li>
          <li>private 저장소라면 GitHub Token에 접근 권한이 있는지</li>
        </HelpList>
      </>
    );
  }

  if (rowKey === "token") {
    return (
      <>
        <HelpTitle>GitHub Token 발급 방법</HelpTitle>
        <HelpList>
          <li>GitHub 우측 상단 프로필 아이콘 클릭</li>
          <li>Settings</li>
          <li>Developer settings</li>
          <li>Personal access tokens</li>
          <li>Fine-grained tokens</li>
          <li>Generate new token</li>
        </HelpList>

        <HelpSubTitle>권장 설정</HelpSubTitle>
        <HelpList>
          <li>Repository access: Only select repositories</li>
          <li>Repository: 현재 프로젝트 저장소</li>
          {GITHUB_TOKEN_CORE_PERMISSION_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </HelpList>

        <HelpSubTitle>Preview 자동 설정(선택)</HelpSubTitle>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55, marginTop: 6 }}>
          {GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_GUIDE_INTRO.split("\n").map((line) => (
            <p key={line} style={{ margin: "0 0 6px" }}>
              {line}
            </p>
          ))}
        </div>
        <HelpList>
          {GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_PERMISSION_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </HelpList>

        <HelpSubTitle>오류가 나면 확인</HelpSubTitle>
        <HelpList>
          <li>토큰 만료 여부</li>
          <li>토큰 복사 누락 여부</li>
          <li>다른 GitHub 계정의 토큰인지</li>
          <li>저장소 권한이 있는지</li>
          <li>조직 저장소라면 SSO 승인 여부</li>
        </HelpList>

        <a
          href={GITHUB_FINE_GRAINED_TOKEN_NEW_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#0f172a",
            fontSize: 12,
            fontWeight: 900,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          GitHub Token 발급 화면 열기
        </a>
      </>
    );
  }

  if (rowKey === "cursor") {
    return (
      <>
        <HelpTitle>Cursor API Key 확인 방법</HelpTitle>
        <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.65 }}>
          Cursor 웹사이트 → 왼쪽 메뉴 Integrations → API Key 또는 Access Token 확인/생성 → Cursor API Key 입력 → 검증
        </div>
      </>
    );
  }

  return null;
}

export function PrototypeEnvSettingsModalLayout(input: {
  readonly rows: readonly PrototypeEnvModalTableRow[];
  readonly selectedRow: PrototypeEnvModalRowKey | null;
  readonly onSelectRow: (key: PrototypeEnvModalRowKey) => void;
  readonly detail: ReactNode;
  readonly belowTable?: ReactNode;
  readonly footer: ReactNode;
}) {
  const [openHelpKey, setOpenHelpKey] = useState<PrototypeEnvModalRowKey | null>(null);
  const [helpPlacement, setHelpPlacement] = useState<HelpPopoverPlacement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Partial<Record<PrototypeEnvModalRowKey, HTMLButtonElement | null>>>({});

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
    const onScrollOrResize = () => repositionHelpPopover();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
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
      if (t.closest?.("[data-prototype-env-help-trigger]")) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpenHelpKey(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openHelpKey]);

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

  const helpPopoverPortal =
    openHelpKey && helpPlacement && typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            ref={popoverRef}
            data-testid={`prototype-env-help-popover-${openHelpKey}`}
            style={helpPopoverStyle}
          >
            <RowHelpPopover rowKey={openHelpKey} />
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      data-testid="prototype-env-settings-modal-layout"
      style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>기본 연결 상태</div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                {["항목", "상태", "현재 값", "도움말"].map((h) => (
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
              {input.rows.map((row) => {
                const colors = prototypeEnvReadinessToneColors(row.statusTone);
                const selected = input.selectedRow === row.key;
                return (
                  <tr
                    key={row.key}
                    data-testid={`prototype-env-modal-row-${row.key}`}
                    role="button"
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => input.onSelectRow(row.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        input.onSelectRow(row.key);
                      }
                    }}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: selected ? "#f8fafc" : undefined,
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "10px", fontWeight: 700, color: "#334155" }}>{row.label}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontWeight: 800, color: colors.color }}>{row.status}</span>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        color: "#475569",
                        maxWidth: 220,
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenHelpKey((prev) => (prev === row.key ? null : row.key));
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        data-prototype-env-help-trigger
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          border: "1px solid #cbd5e1",
                          background: openHelpKey === row.key ? "#f1f5f9" : "#fff",
                          color: "#475569",
                          fontWeight: 900,
                          fontSize: 12,
                          lineHeight: 1,
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
        {input.belowTable ?? null}
        {input.detail ? (
          <div
            data-testid="prototype-env-modal-detail"
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fafafa",
            }}
          >
            {input.detail}
          </div>
        ) : null}
      </div>
      <div
        data-testid="prototype-env-modal-footer"
        style={{
          flexShrink: 0,
          borderTop: "1px solid #e2e8f0",
          paddingTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {input.footer}
      </div>
      {helpPopoverPortal}
    </div>
  );
}
