"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiFixedViewportScrimButtonStyle } from "@/components/ui/fixedViewportScrimStyle";
import { uiTokens as t } from "@/components/ui/tokens";

/**
 * 좌·중·우 + 모바일 드로어 분할(기능 정리 등). 채팅 단일 작업공간은 `WorkspaceShell`을 사용합니다.
 */
export function WorkspaceSplitShell({
  sidebar,
  main,
  rightPanel,
  bottomBar,
  isDesktop,
  mobileSidebarOpen,
  mobileRightOpen,
  onCloseMobileSidebar,
  onCloseMobileRight,
  mobileToggleSidebar,
  mobileToggleRight,
}: {
  readonly sidebar: ReactNode;
  readonly main: ReactNode;
  readonly rightPanel: ReactNode;
  readonly bottomBar: ReactNode;
  readonly isDesktop: boolean;
  readonly mobileSidebarOpen: boolean;
  readonly mobileRightOpen: boolean;
  readonly onCloseMobileSidebar: () => void;
  readonly onCloseMobileRight: () => void;
  readonly mobileToggleSidebar: () => void;
  readonly mobileToggleRight: () => void;
}) {
  const rowStyle: CSSProperties = isDesktop
    ? {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
      }
    : {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      };

  const mobileDrawerScrim = uiFixedViewportScrimButtonStyle(40);

  const drawerBase: CSSProperties = {
    position: "fixed",
    top: 0,
    bottom: 0,
    width: "min(92vw, 300px)",
    maxWidth: "100%",
    zIndex: 41,
    background: t.bgCard,
    boxShadow: t.shadowModal,
    display: "flex",
    flexDirection: "column",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        border: `1px solid ${t.border}`,
        borderRadius: t.radiusLg,
        overflow: "hidden",
        background: t.bgCard,
      }}
    >
      {!isDesktop ? (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            gap: 8,
            padding: "8px 10px",
            borderBottom: `1px solid ${t.border}`,
            background: "#fafafa",
          }}
        >
          <button
            type="button"
            onClick={mobileToggleSidebar}
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgCard,
              cursor: "pointer",
            }}
          >
            사이드바
          </button>
          <button
            type="button"
            onClick={mobileToggleRight}
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgCard,
              cursor: "pointer",
            }}
          >
            결과
          </button>
        </div>
      ) : null}

      <div style={rowStyle}>
        {isDesktop ? (
          <>
            {sidebar}
            {main}
            {rightPanel}
          </>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{main}</div>
            {mobileSidebarOpen ? (
              <>
                <button type="button" aria-label="사이드바 닫기" style={mobileDrawerScrim} onClick={onCloseMobileSidebar} />
                <div style={{ ...drawerBase, left: 0, borderRight: `1px solid ${t.border}` }}>{sidebar}</div>
              </>
            ) : null}
            {mobileRightOpen ? (
              <>
                <button type="button" aria-label="결과 패널 닫기" style={mobileDrawerScrim} onClick={onCloseMobileRight} />
                <div style={{ ...drawerBase, right: 0, borderLeft: `1px solid ${t.border}` }}>{rightPanel}</div>
              </>
            ) : null}
          </>
        )}
      </div>

      {bottomBar}
    </div>
  );
}
