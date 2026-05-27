"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  type PrototypeEnvModalRowKey,
  type PrototypeEnvModalTableRow,
} from "@/lib/project/prototypeEnvSettingsModalRows";
import { prototypeEnvReadinessToneColors } from "@/lib/project/prototypeEnvSettingsReadiness";

const GITHUB_FINE_GRAINED_TOKEN_NEW_URL = "https://github.com/settings/personal-access-tokens/new" as const;

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
          <li>Contents: Read and write</li>
          <li>Pull requests: Read and write</li>
          <li>Metadata: 자동 포함</li>
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
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
          Cursor 계정에서 API Key를 발급한 뒤 입력합니다. 이 화면에서는 <strong>API URL을 입력하지 않습니다</strong>.
        </div>
        <HelpSubTitle>확인할 것</HelpSubTitle>
        <HelpList>
          <li>Cursor API Key가 복사 누락 없이 입력되었는지</li>
          <li>해당 키가 현재 계정에서 유효한지</li>
          <li>키 입력 후 검증(연결) 결과가 정상인지</li>
        </HelpList>
      </>
    );
  }

  return (
    <>
      <HelpTitle>연결 테스트 확인 방법</HelpTitle>
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
        연결 테스트는 저장소, GitHub Token, Cursor API Key가 저장된 뒤 실행합니다.
      </div>
      <HelpSubTitle>확인 항목</HelpSubTitle>
      <HelpList>
        <li>GitHub 저장소 접근 가능 여부</li>
        <li>GitHub Token 권한 정상 여부</li>
        <li>Cursor API 연결 가능 여부</li>
        <li>테스트 브랜치/커밋/PR 생성 경로 정상 여부</li>
      </HelpList>
      <div style={{ marginTop: 10, fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
        실패하면 표시되는 오류 메시지를 기준으로 GitHub Token 또는 Cursor API Key를 먼저 확인하세요.
      </div>
    </>
  );
}

export function PrototypeEnvSettingsModalLayout(input: {
  readonly rows: readonly PrototypeEnvModalTableRow[];
  readonly selectedRow: PrototypeEnvModalRowKey | null;
  readonly onSelectRow: (key: PrototypeEnvModalRowKey) => void;
  readonly detail: ReactNode;
  readonly footer: ReactNode;
}) {
  const [openHelpKey, setOpenHelpKey] = useState<PrototypeEnvModalRowKey | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openHelpKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenHelpKey(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("[data-prototype-env-help-trigger]")) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpenHelpKey(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openHelpKey]);

  return (
    <div
      data-testid="prototype-env-settings-modal-layout"
      style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingBottom: 12 }}>
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
                {["항목", "상태", "현재 값", "작업"].map((h) => (
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
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: selected ? "#f8fafc" : undefined,
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
                    <td style={{ padding: "10px", position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-start" }}>
                        <button
                          type="button"
                          onClick={() => input.onSelectRow(row.key)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {row.actionLabel}
                        </button>
                        <button
                          type="button"
                          aria-label={`${row.label} 도움말`}
                          aria-expanded={openHelpKey === row.key}
                          onClick={() => setOpenHelpKey((prev) => (prev === row.key ? null : row.key))}
                          data-prototype-env-help-trigger
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            color: "#475569",
                            fontWeight: 900,
                            fontSize: 12,
                            lineHeight: 1,
                            cursor: "pointer",
                          }}
                        >
                          ?
                        </button>
                      </div>
                      {openHelpKey === row.key ? (
                        <div
                          role="tooltip"
                          ref={popoverRef}
                          style={{
                            position: "absolute",
                            top: "calc(100% - 4px)",
                            right: 0,
                            width: "min(420px, calc(100vw - 48px))",
                            zIndex: 3,
                            padding: "14px 16px",
                            borderRadius: 12,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
                            wordBreak: "keep-all",
                          }}
                        >
                          <RowHelpPopover rowKey={row.key} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
